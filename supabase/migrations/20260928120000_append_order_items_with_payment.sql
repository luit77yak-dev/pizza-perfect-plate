-- Allow the existing public-order append flow to record the payment method selected for a complement.
CREATE OR REPLACE FUNCTION public.append_public_order_items_with_payment(
  p_order_id uuid,
  p_customer_phone text,
  p_items jsonb,
  p_payment_method public.payment_method
)
RETURNS TABLE(
  order_id uuid,
  order_number integer,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  status public.order_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento obrigatória';
  END IF;

  UPDATE public.orders
  SET payment_method = p_payment_method,
      updated_at = now()
  WHERE id = p_order_id
    AND regexp_replace(customer_phone, '\D', '', 'g')
        = regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')
    AND status IN ('RECEIVED', 'CONFIRMED', 'PREPARING', 'READY');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou não pode receber complemento';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.append_public_order_items(
    p_order_id,
    p_customer_phone,
    p_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) TO anon, authenticated;
