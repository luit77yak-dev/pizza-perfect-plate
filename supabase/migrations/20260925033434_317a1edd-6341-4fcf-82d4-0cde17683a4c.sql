CREATE OR REPLACE FUNCTION public.get_public_order_status(p_order_id uuid, p_customer_phone text)
RETURNS TABLE(order_id uuid, order_number integer, status order_status, fulfillment fulfillment_type, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.order_number, o.status, o.fulfillment, o.created_at, o.updated_at
  FROM public.orders o
  WHERE o.id = p_order_id
    AND length(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')) >= 8
    AND regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_status(uuid, text) TO anon, authenticated;