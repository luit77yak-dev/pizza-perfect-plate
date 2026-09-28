-- The tracking RPC previously returned only status metadata.
-- That made the customer tracking panel show 0 items after reload
-- and prevented the panel from reflecting appended items.
--
-- Keep the same RPC name/signature, but expose the read-only order
-- snapshot needed by the public tracking UI.

DROP FUNCTION IF EXISTS public.get_public_order_status(uuid, text);

CREATE OR REPLACE FUNCTION public.get_public_order_status(
  p_order_id uuid,
  p_customer_phone text
)
RETURNS TABLE(
  order_id uuid,
  order_number integer,
  status public.order_status,
  fulfillment public.fulfillment_type,
  created_at timestamptz,
  updated_at timestamptz,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  items jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.status,
    o.fulfillment,
    o.created_at,
    o.updated_at,
    o.subtotal,
    o.delivery_fee,
    o.total,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'lineId', oi.id::text,
            'productId', oi.product_id,
            'productName', oi.product_name,
            'imageUrl', (
              SELECT p.image_url
              FROM public.products AS p
              WHERE p.id = oi.product_id
              LIMIT 1
            ),
            'secondProductId', oi.second_product_id,
            'secondProductName', oi.second_product_name,
            'isHalf', oi.is_half,
            'sizeId', oi.size_id,
            'sizeName', oi.size_name,
            'crustId', oi.crust_id,
            'crustName', oi.crust_name,
            'crustPrice', oi.crust_price,
            'addons', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', COALESCE(oia.addon_id, oia.id),
                    'name', oia.name,
                    'price', oia.price
                  )
                  ORDER BY oia.created_at
                )
                FROM public.order_item_addons AS oia
                WHERE oia.order_item_id = oi.id
              ),
              '[]'::jsonb
            ),
            'complements', '[]'::jsonb,
            'quantity', oi.quantity,
            'notes', oi.notes,
            'unitPrice', oi.unit_price
          )
          ORDER BY oi.created_at
        )
        FROM public.order_items AS oi
        WHERE oi.order_id = o.id
      ),
      '[]'::jsonb
    ) AS items
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND regexp_replace(o.customer_phone, '\\D', '', 'g')
        = regexp_replace(COALESCE(p_customer_phone, ''), '\\D', '', 'g')
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_status(uuid, text) TO anon, authenticated;
