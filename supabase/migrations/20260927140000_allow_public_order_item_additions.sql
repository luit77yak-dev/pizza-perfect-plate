-- Allow a customer to append items to an existing public order while it is still being processed.
-- Allowed statuses: RECEIVED, CONFIRMED, PREPARING and READY.
-- OUT_FOR_DELIVERY, DELIVERED and CANCELLED are locked.
CREATE OR REPLACE FUNCTION public.append_public_order_items(
  p_order_id uuid,
  p_customer_phone text,
  p_items jsonb
)
RETURNS TABLE(
  order_id uuid,
  order_number integer,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  status order_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item jsonb;
  v_addon jsonb;
  v_addon_row record;
  v_product record;
  v_second_product record;
  v_second_product_name text;
  v_size record;
  v_second_size_price numeric(10,2);
  v_base_price numeric(10,2);
  v_unit_price numeric(10,2);
  v_quantity integer;
  v_crust_id uuid;
  v_crust_price numeric(10,2) := 0;
  v_crust_name text;
  v_addon_total numeric(10,2);
  v_product_id uuid;
  v_second_product_id uuid;
  v_size_id uuid;
  v_is_half boolean;
  v_item_id uuid;
  v_added_subtotal numeric(10,2) := 0;
  v_new_subtotal numeric(10,2);
  v_new_total numeric(10,2);
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um item';
  END IF;

  SELECT
    o.id,
    o.organization_id,
    o.order_number,
    o.customer_phone,
    o.fulfillment,
    o.status,
    o.subtotal,
    o.delivery_fee,
    o.total
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND regexp_replace(o.customer_phone, '\D', '', 'g')
        = regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status NOT IN ('RECEIVED', 'CONFIRMED', 'PREPARING', 'READY') THEN
    RAISE EXCEPTION 'Este pedido não pode mais receber novos itens';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = v_order.organization_id
      AND o.active
      AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_second_product_id := NULLIF(v_item->>'second_product_id', '')::uuid;
    v_size_id := NULLIF(v_item->>'size_id', '')::uuid;
    v_crust_id := NULLIF(v_item->>'crust_id', '')::uuid;
    v_is_half := COALESCE((v_item->>'is_half')::boolean, false);
    v_size := NULL;
    v_second_size_price := NULL;
    v_second_product_name := NULL;
    v_crust_price := 0;
    v_crust_name := NULL;
    v_quantity := GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::integer, 1)));

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Produto inválido';
    END IF;

    SELECT p.*
      INTO v_product
    FROM public.products p
    WHERE p.id = v_product_id
      AND p.organization_id = v_order.organization_id
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
      FROM public.products p
      WHERE p.id = v_second_product_id
        AND p.organization_id = v_order.organization_id
        AND p.active
        AND p.available
        AND p.deleted_at IS NULL;

      IF NOT FOUND OR NOT v_second_product.allow_half THEN
        RAISE EXCEPTION 'Segundo produto inválido';
      END IF;

      IF v_second_product_id = v_product_id THEN
        RAISE EXCEPTION 'As duas metades devem ser válidas';
      END IF;

      v_second_product_name := v_second_product.name;
    ELSE
      IF v_second_product_id IS NOT NULL THEN
        RAISE EXCEPTION 'Segundo produto não permitido neste item';
      END IF;
    END IF;

    v_base_price := COALESCE(v_product.base_price, 0);

    IF v_size_id IS NOT NULL THEN
      SELECT pp.price, ps.name
        INTO v_size
      FROM public.product_prices pp
      JOIN public.product_sizes ps ON ps.id = pp.size_id
      WHERE pp.product_id = v_product_id
        AND pp.organization_id = v_order.organization_id
        AND pp.size_id = v_size_id
        AND ps.organization_id = v_order.organization_id
        AND ps.active;

      IF FOUND THEN
        v_base_price := COALESCE(v_size.price, v_base_price);
      ELSE
        RAISE EXCEPTION 'Tamanho inválido para o produto';
      END IF;

      IF v_is_half THEN
        SELECT pp.price
          INTO v_second_size_price
        FROM public.product_prices pp
        JOIN public.product_sizes ps ON ps.id = pp.size_id
        WHERE pp.product_id = v_second_product_id
          AND pp.organization_id = v_order.organization_id
          AND pp.size_id = v_size_id
          AND ps.organization_id = v_order.organization_id
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
      CASE COALESCE(
        (SELECT half_pizza_pricing_rule
         FROM public.organization_settings
         WHERE organization_id = v_order.organization_id),
        'highest_half'
      )
        WHEN 'average_halves' THEN
          v_base_price := round((v_base_price + v_second_size_price) / 2, 2);
        WHEN 'fixed_price' THEN
          SELECT half_pizza_fixed_price
            INTO v_base_price
          FROM public.organization_settings
          WHERE organization_id = v_order.organization_id;
          v_base_price := COALESCE(v_base_price, GREATEST(v_base_price, v_second_size_price));
        ELSE
          v_base_price := GREATEST(v_base_price, v_second_size_price);
      END CASE;
    END IF;

    v_addon_total := 0;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons', '[]'::jsonb)) LOOP
      SELECT a.id, a.name, a.price
        INTO v_addon_row
      FROM public.product_addons a
      WHERE a.id = NULLIF(v_addon->>'id', '')::uuid
        AND a.organization_id = v_order.organization_id
        AND a.active
        AND EXISTS (
          SELECT 1
          FROM public.product_addon_links l
          WHERE l.addon_id = a.id
            AND l.organization_id = v_order.organization_id
            AND (l.product_id = v_product_id OR l.product_id = v_second_product_id)
        );

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Adicional inválido para o produto';
      END IF;

      v_addon_total := v_addon_total + COALESCE(v_addon_row.price, 0);
    END LOOP;

    IF v_crust_id IS NOT NULL THEN
      SELECT c.price, c.name
        INTO v_crust_price, v_crust_name
      FROM public.product_crusts c
      WHERE c.id = v_crust_id
        AND c.organization_id = v_order.organization_id
        AND c.active;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Borda inválida';
      END IF;
    END IF;

    v_unit_price := round(
      v_base_price
      + COALESCE(v_crust_price, 0)
      + v_addon_total,
      2
    );

    v_added_subtotal := v_added_subtotal + (v_unit_price * v_quantity);

    INSERT INTO public.order_items (
      organization_id, order_id, product_id, product_name, second_product_id,
      second_product_name, is_half, size_id, size_name, crust_id, crust_name,
      crust_price, unit_price, quantity, total_price, notes
    ) VALUES (
      v_order.organization_id, v_order.id, v_product_id, v_product.name,
      v_second_product_id, v_second_product_name,
      v_is_half, v_size_id,
      CASE WHEN v_size_id IS NOT NULL THEN v_size.name ELSE NULL END,
      v_crust_id, v_crust_name,
      round(COALESCE(v_crust_price, 0), 2),
      v_unit_price,
      v_quantity,
      round(v_unit_price * v_quantity, 2),
      NULLIF(trim(v_item->>'notes'), '')
    )
    RETURNING id INTO v_item_id;

    FOR v_addon IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'addons', '[]'::jsonb)) LOOP
      SELECT a.name, a.price
        INTO v_addon_row
      FROM public.product_addons a
      WHERE a.id = NULLIF(v_addon->>'id', '')::uuid
        AND a.organization_id = v_order.organization_id
        AND a.active
        AND EXISTS (
          SELECT 1
          FROM public.product_addon_links l
          WHERE l.addon_id = a.id
            AND l.organization_id = v_order.organization_id
            AND (l.product_id = v_product_id OR l.product_id = v_second_product_id)
        );

      INSERT INTO public.order_item_addons (
        organization_id, order_item_id, addon_id, name, price, quantity
      )
      INSERT INTO public.order_item_addons (
        organization_id, order_item_id, addon_id, name, price, quantity
      ) VALUES (
        v_order.organization_id,
        v_item_id,
        NULLIF(v_addon->>'id', '')::uuid,
        v_addon_row.name,
        round(v_addon_row.price, 2),
        v_quantity
      );
    END LOOP;
  END LOOP;

  v_new_subtotal := round(COALESCE(v_order.subtotal, 0) + v_added_subtotal, 2);
  v_new_total := round(v_new_subtotal + COALESCE(v_order.delivery_fee, 0), 2);

  UPDATE public.orders
  SET subtotal = v_new_subtotal,
      total = v_new_total,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number,
    v_new_subtotal,
    COALESCE(v_order.delivery_fee, 0),
    v_new_total,
    v_order.status;
END;
$$;

REVOKE ALL ON FUNCTION public.append_public_order_items(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_public_order_items(uuid, text, jsonb) TO anon, authenticated;
