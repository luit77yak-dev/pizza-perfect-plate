-- Apply the minimum order amount only to delivery orders.
-- Pickup orders are allowed below the store minimum.

-- Align public order pricing with the storefront for half-pizza fixed-price fallback.
-- When no fixed price is configured, the frontend falls back to the selected size prices,
-- not the products' base_price values.
-- Harden public order creation: server-side price and snapshot calculation.
CREATE OR REPLACE FUNCTION public.create_public_order(p_order jsonb)
RETURNS TABLE(order_id uuid, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := NULLIF(p_order->>'organization_id','')::uuid;
  v_order_id uuid;
  v_number integer;
  v_fulfillment fulfillment_type := COALESCE((p_order->>'fulfillment')::fulfillment_type, 'DELIVERY');
  v_payment payment_method := COALESCE((p_order->>'payment_method')::payment_method, 'CASH');
  v_name text := trim(COALESCE(p_order->>'customer_name',''));
  v_phone text := trim(COALESCE(p_order->>'customer_phone',''));
  v_delivery_fee numeric(10,2) := 0;
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_zone_id uuid;
  v_neighborhood text := trim(COALESCE(p_order->>'address_neighborhood',''));
  v_idempotency text := NULLIF(trim(p_order->>'idempotency_key'),'');
  v_zone record;
  v_item jsonb;
  v_item_id uuid;
  v_addon jsonb;
  v_addon_row record;
  v_product record;
  v_second_product record;
  v_size record;
  v_second_size_price numeric(10,2);
  v_base_price numeric(10,2);
  v_unit_price numeric(10,2);
  v_quantity integer;
  v_crust_id uuid;
  v_crust record;
  v_addon_total numeric(10,2);
  v_product_id uuid;
  v_second_product_id uuid;
  v_size_id uuid;
  v_is_half boolean;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Loja inválida'; END IF;
  IF v_name = '' OR v_phone = '' THEN RAISE EXCEPTION 'Nome e telefone são obrigatórios'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = v_org AND active AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  IF v_idempotency IS NOT NULL THEN
    SELECT o.id, o.order_number
      INTO v_order_id, v_number
    FROM orders o
    WHERE o.organization_id = v_org
      AND o.idempotency_key = v_idempotency;

    IF v_order_id IS NOT NULL THEN
      RETURN QUERY SELECT v_order_id, v_number;
      RETURN;
    END IF;
  END IF;

  IF jsonb_typeof(p_order->'items') <> 'array'
     OR jsonb_array_length(p_order->'items') = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item';
  END IF;

  IF v_fulfillment = 'DELIVERY' THEN
    SELECT * INTO v_zone
    FROM delivery_zones
    WHERE organization_id = v_org
      AND active
      AND EXISTS (
        SELECT 1
        FROM unnest(neighborhoods) n
        WHERE lower(trim(n)) = lower(v_neighborhood)
      )
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bairro não atendido';
    END IF;

    v_zone_id := v_zone.id;
    v_delivery_fee := round(COALESCE(v_zone.delivery_fee, 0), 2);
  END IF;

  v_number := next_order_number(v_org);

  INSERT INTO orders (
    organization_id, order_number, customer_name, customer_phone, fulfillment,
    payment_method, status, subtotal, discount, delivery_fee, total,
    delivery_zone_id, address_street, address_number, address_complement,
    address_neighborhood, address_reference, notes, idempotency_key, is_demo, source
  ) VALUES (
    v_org, v_number, v_name, v_phone, v_fulfillment, v_payment, 'RECEIVED',
    0, 0, v_delivery_fee, v_delivery_fee, v_zone_id,
    NULLIF(trim(p_order->>'address_street'), ''),
    NULLIF(trim(p_order->>'address_number'), ''),
    NULLIF(trim(p_order->>'address_complement'), ''),
    NULLIF(v_neighborhood, ''),
    NULLIF(trim(p_order->>'address_reference'), ''),
    NULLIF(trim(p_order->>'notes'), ''),
    v_idempotency, (SELECT demo_mode FROM organizations WHERE id = v_org), 'PUBLIC'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order->'items') LOOP
    v_product_id := NULLIF(v_item->>'product_id','')::uuid;
    v_second_product_id := NULLIF(v_item->>'second_product_id','')::uuid;
    v_size_id := NULLIF(v_item->>'size_id','')::uuid;
    v_crust_id := NULLIF(v_item->>'crust_id','')::uuid;
    v_is_half := COALESCE((v_item->>'is_half')::boolean, false);
    v_size := NULL;
    v_second_size_price := NULL;
    v_crust := NULL;
    v_quantity := GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::integer, 1)));

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;

    SELECT p.*
      INTO v_product
    FROM products p
    WHERE p.id = v_product_id
      AND p.organization_id = v_org
      AND p.active
      AND p.available
      AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;

    IF v_is_half THEN
      IF NOT v_product.allow_half OR v_second_product_id IS NULL THEN
        RAISE EXCEPTION 'Meia pizza inválida';
      END IF;

      SELECT p.*
        INTO v_second_product
      FROM products p
      WHERE p.id = v_second_product_id
        AND p.organization_id = v_org
        AND p.active
        AND p.available
        AND p.deleted_at IS NULL;

      IF NOT FOUND OR NOT v_second_product.allow_half THEN
        RAISE EXCEPTION 'Segundo produto inválido';
      END IF;

      IF v_second_product_id = v_product_id THEN
        RAISE EXCEPTION 'As duas metades devem ser válidas';
      END IF;
    ELSE
      IF v_second_product_id IS NOT NULL THEN
        RAISE EXCEPTION 'Segundo produto não permitido neste item';
      END IF;
    END IF;

    v_base_price := COALESCE(v_product.base_price, 0);

    IF v_size_id IS NOT NULL THEN
      SELECT pp.price, ps.name
        INTO v_size
      FROM product_prices pp
      JOIN product_sizes ps ON ps.id = pp.size_id
      WHERE pp.product_id = v_product_id
        AND pp.organization_id = v_org
        AND pp.size_id = v_size_id
        AND ps.organization_id = v_org
        AND ps.active;

      IF FOUND THEN
        v_base_price := COALESCE(v_size.price, v_base_price);
      ELSE
        RAISE EXCEPTION 'Tamanho inválido para o produto';
      END IF;

      IF v_is_half THEN
        SELECT pp.price
          INTO v_second_size_price
        FROM product_prices pp
        JOIN product_sizes ps ON ps.id = pp.size_id
        WHERE pp.product_id = v_second_product_id
          AND pp.organization_id = v_org
          AND pp.size_id = v_size_id
          AND ps.organization_id = v_org
          AND ps.active;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Tamanho inválido para a segunda metade';
        END IF;
      END IF;
    ELSE
      IF v_is_half THEN
        v_second_size_price := COALESCE(v_second_product.base_price, 0);
      END IF;
    END IF;

    IF v_is_half THEN
      CASE COALESCE((SELECT half_pizza_pricing_rule FROM organization_settings WHERE organization_id = v_org), 'highest_half')
        WHEN 'average_halves' THEN
          v_base_price := round((v_base_price + v_second_size_price) / 2, 2);
        WHEN 'fixed_price' THEN
          SELECT half_pizza_fixed_price INTO v_base_price
          FROM organization_settings
          WHERE organization_id = v_org;
          v_base_price := COALESCE(v_base_price, GREATEST(v_base_price, v_second_size_price));
        ELSE
          v_base_price := GREATEST(v_base_price, v_second_size_price);
      END CASE;
    END IF;

    v_addon_total := 0;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons','[]'::jsonb)) LOOP
      SELECT a.id, a.name, a.price
        INTO v_addon_row
      FROM product_addons a
      WHERE a.id = NULLIF(v_addon->>'id','')::uuid
        AND a.organization_id = v_org
        AND a.active
        AND EXISTS (
          SELECT 1
          FROM product_addon_links l
          WHERE l.addon_id = a.id
            AND l.organization_id = v_org
            AND (l.product_id = v_product_id OR l.product_id = v_second_product_id)
        );

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Adicional inválido para o produto';
      END IF;

      v_addon_total := v_addon_total + COALESCE(v_addon_row.price, 0);
    END LOOP;

    IF v_crust_id IS NOT NULL THEN
      SELECT c.*
        INTO v_crust
      FROM product_crusts c
      WHERE c.id = v_crust_id
        AND c.organization_id = v_org
        AND c.active;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Borda inválida';
      END IF;
    ELSE
      v_crust := NULL;
    END IF;

    v_unit_price := round(
      v_base_price
      + COALESCE(v_crust.price, 0)
      + v_addon_total,
      2
    );

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);

    INSERT INTO order_items (
      organization_id, order_id, product_id, product_name, second_product_id,
      second_product_name, is_half, size_id, size_name, crust_id, crust_name,
      crust_price, unit_price, quantity, total_price, notes
    ) VALUES (
      v_org, v_order_id, v_product_id, v_product.name, 
      v_second_product_id, CASE WHEN v_is_half THEN v_second_product.name ELSE NULL END,
      v_is_half, v_size_id, CASE WHEN v_size_id IS NOT NULL THEN v_size.name ELSE NULL END,
      v_crust_id, CASE WHEN v_crust_id IS NOT NULL THEN v_crust.name ELSE NULL END,
      round(COALESCE(v_crust.price, 0), 2), v_unit_price, v_quantity,
      round(v_unit_price * v_quantity, 2),
      NULLIF(trim(v_item->>'notes'), '')
    ) RETURNING id INTO v_item_id;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons','[]'::jsonb)) LOOP
      SELECT a.name, a.price
        INTO v_addon_row
      FROM product_addons a
      WHERE a.id = NULLIF(v_addon->>'id','')::uuid
        AND a.organization_id = v_org
        AND a.active
        AND EXISTS (
          SELECT 1
          FROM product_addon_links l
          WHERE l.addon_id = a.id
            AND l.organization_id = v_org
            AND (l.product_id = v_product_id OR l.product_id = v_second_product_id)
        );

      INSERT INTO order_item_addons (
        organization_id, order_item_id, addon_id, name, price, quantity
      ) VALUES (
        v_org, v_item_id, NULLIF(v_addon->>'id','')::uuid,
        v_addon_row.name, round(v_addon_row.price, 2), v_quantity
      );
    END LOOP;
  END LOOP;

  IF v_fulfillment = 'DELIVERY'
     AND COALESCE(NULLIF(p_order->>'subtotal','')::numeric, v_subtotal) <
         COALESCE(
           (SELECT min_order_amount FROM organization_settings WHERE organization_id = v_org),
           0
         ) THEN
    RAISE EXCEPTION 'Pedido abaixo do mínimo da loja';
  END IF;

  v_total := round(v_subtotal + v_delivery_fee, 2);

  UPDATE orders
  SET subtotal = v_subtotal,
      delivery_fee = v_delivery_fee,
      total = v_total
  WHERE id = v_order_id;

  RETURN QUERY SELECT v_order_id, v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(jsonb) TO anon, authenticated;
