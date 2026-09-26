-- Public visitors may only read prices belonging to an active organization.
DROP POLICY IF EXISTS prices_read ON public.product_prices;

CREATE POLICY prices_read
ON public.product_prices
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = product_prices.organization_id
      AND o.active
      AND o.deleted_at IS NULL
  )
);
