-- Restrict order mutations to the fields the current panel actually needs.
-- Staff members change status through a controlled RPC; managers may still perform
-- direct order updates for future administrative workflows.
DROP POLICY IF EXISTS orders_staff_update ON public.orders;

CREATE POLICY orders_manager_update
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_org_manager(organization_id))
WITH CHECK (public.is_org_manager(organization_id));

DROP POLICY IF EXISTS status_hist_staff_insert ON public.order_status_history;

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_organization_id uuid,
  p_status public.order_status,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_staff(p_organization_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.orders
  SET status = p_status,
      updated_at = now()
  WHERE id = p_order_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  INSERT INTO public.order_status_history (
    organization_id,
    order_id,
    status,
    note
  )
  VALUES (
    p_organization_id,
    p_order_id,
    p_status,
    NULLIF(trim(COALESCE(p_note, '')), '')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, uuid, public.order_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, uuid, public.order_status, text) TO authenticated;
