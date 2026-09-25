-- Keep already-provisioned databases in sync with the hardened public order function.
CREATE OR REPLACE FUNCTION public.create_public_order(p_order jsonb)
RETURNS TABLE(order_id uuid, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := (p_order->>'organization_id')::uuid;
  v_order_id uuid;
  v_number integer;
  v_fulfillment fulfillment_type := COALESCE((p_order->>'fulfillment')::fulfillment_type, 'DELIVERY');
  v_payment payment_method := COALESCE((p_order->>'payment_method')::payment_method, 'CASH');
  v_name text := trim(COALESCE(p_order->>'customer_name',''));
  v_phone text := trim(COALESCE(p_order->>'customer_phone',''));
  v_subtotal numeric := COALESCE((p_order->>'subtotal')::numeric, 0);
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_zone_id uuid;
  v_neighborhood text := trim(COALESCE(p_order->>'address_neighborhood',''));
  v_idempotency text := p_order->>'idempotency_key';
  v_zone record;
  v_item jsonb;
  v_item_id uuid;
  v_addon jsonb;
  v_addon_row record;
  v_product_id uuid;
  v_second_product_id uuid;
  v_addon_id uuid;
BEGIN
  IF v_name = '' OR v_phone = '' THEN RAISE EXCEPTION 'Nome e telefone são obrigatórios'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org AND active AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;
  IF v_idempotency IS NOT NULL THEN
    SELECT id, order_number INTO v_order_id, v_number FROM orders
    WHERE organization_id = v_org AND idempotency_key = v_idempotency;
    IF v_order_id IS NOT NULL THEN RETURN QUERY SELECT v_order_id, v_number; RETURN; END IF;
  END IF;

  IF v_fulfillment = 'DELIVERY' THEN
    SELECT * INTO v_zone FROM delivery_zones
    WHERE organization_id = v_org AND active
      AND EXISTS (SELECT 1 FROM unnest(neighborhoods) n WHERE lower(trim(n)) = lower(v_neighborhood))
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bairro não atendido'; END IF;
    v_zone_id := v_zone.id;
    v_delivery_fee := v_zone.delivery_fee;
  END IF;

  IF v_subtotal < COALESCE((SELECT min_order_amount FROM organization_settings WHERE organization_id = v_org),0) THEN
    RAISE EXCEPTION 'Pedido abaixo do mínimo da loja';
  END IF;

  v_total := v_subtotal + v_delivery_fee;
  v_number := next_order_number(v_org);

  INSERT INTO orders (
    organization_id, order_number, customer_name, customer_phone, fulfillment,
    payment_method, status, subtotal, discount, delivery_fee, total,
    delivery_zone_id, address_street, address_number, address_complement,
    address_neighborhood, address_reference, notes, idempotency_key, is_demo, source
  ) VALUES (
    v_org, v_number, v_name, v_phone, v_fulfillment, v_payment, 'RECEIVED',
    v_subtotal, 0, v_delivery_fee, v_total, v_zone_id,
    NULLIF(trim(p_order->>'address_street'), ''),
    NULLIF(trim(p_order->>'address_number'), ''),
    NULLIF(trim(p_order->>'address_complement'), ''),
    NULLIF(v_neighborhood, ''),
    NULLIF(trim(p_order->>'address_reference'), ''),
    NULLIF(trim(p_order->>'notes'), ''),
    v_idempotency, (SELECT demo_mode FROM organizations WHERE id=v_org), 'PUBLIC'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order->'items','[]'::jsonb)) LOOP
    v_product_id := NULLIF(v_item->>'product_id','')::uuid;
    v_second_product_id := NULLIF(v_item->>'second_product_id','')::uuid;

    IF v_product_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM products
      WHERE id = v_product_id AND organization_id = v_org AND active AND available AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;

    IF v_second_product_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM products
      WHERE id = v_second_product_id AND organization_id = v_org AND active AND available AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Segundo produto inválido';
    END IF;

    INSERT INTO order_items (
      organization_id, order_id, product_id, product_name, second_product_id,
      second_product_name, is_half, size_id, size_name, crust_id, crust_name,
      crust_price, unit_price, quantity, total_price, notes
    ) VALUES (
      v_org, v_order_id, v_product_id, v_item->>'product_name',
      v_second_product_id, NULLIF(v_item->>'second_product_name',''),
      COALESCE((v_item->>'is_half')::boolean,false),
      NULLIF(v_item->>'size_id','')::uuid, NULLIF(v_item->>'size_name',''),
      NULLIF(v_item->>'crust_id','')::uuid, NULLIF(v_item->>'crust_name',''),
      COALESCE((v_item->>'crust_price')::numeric,0), COALESCE((v_item->>'unit_price')::numeric,0),
      GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::integer,1))),
      COALESCE((v_item->>'unit_price')::numeric,0) * GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::integer,1))),
      NULLIF(v_item->>'notes','')
    ) RETURNING id INTO v_item_id;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons','[]'::jsonb)) LOOP
      v_addon_id := NULLIF(v_addon->>'id','')::uuid;

      SELECT a.name, a.price
      INTO v_addon_row
      FROM product_addons a
      WHERE a.id = v_addon_id
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

      INSERT INTO order_item_addons (organization_id, order_item_id, addon_id, name, price, quantity)
      VALUES (
        v_org, v_item_id, v_addon_id, v_addon_row.name, v_addon_row.price,
        GREATEST(1, COALESCE((v_item->>'quantity')::integer,1))
      );
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_order(jsonb) TO anon, authenticated;
