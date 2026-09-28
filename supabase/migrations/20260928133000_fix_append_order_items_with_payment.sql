-- Fix the public complement flow without changing its RPC contract.
-- The previous implementation referenced "status" without a table alias,
-- which conflicts with the RETURNS TABLE output parameter named status.
-- It also relied on SELECT * from another RPC. Keep the same signature and
-- explicitly map the six returned columns.

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

  UPDATE public.orders AS o
  SET
    payment_method = p_payment_method,
    updated_at = now()
  WHERE o.id = p_order_id
    AND regexp_replace(o.customer_phone, '\D', '', 'g')
        = regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g')
    AND o.status IN (
      'RECEIVED',
      'CONFIRMED',
      'PREPARING',
      'READY'
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou não pode receber complemento';
  END IF;

  RETURN QUERY
  SELECT
    appended.order_id::uuid,
    appended.order_number::integer,
    appended.subtotal::numeric,
    appended.delivery_fee::numeric,
    appended.total::numeric,
    appended.status::public.order_status
  FROM public.append_public_order_items(
    p_order_id,
    p_customer_phone,
    p_items
  ) AS appended;
END;
$$;

REVOKE ALL ON FUNCTION public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) TO anon, authenticated;
