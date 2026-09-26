-- Prevent tenant reassignment after a row has been created.
-- organization_id is the tenant boundary and must remain immutable.
CREATE OR REPLACE FUNCTION public.prevent_organization_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_members',
    'organization_settings',
    'categories',
    'product_sizes',
    'products',
    'product_prices',
    'product_crusts',
    'product_addons',
    'coupons',
    'delivery_zones',
    'drivers',
    'store_hours',
    'special_hours',
    'orders',
    'order_items',
    'order_item_addons',
    'order_status_history',
    'loyalty_accounts',
    'loyalty_transactions',
    'audit_logs'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS prevent_organization_id_change_%1$s ON public.%1$I',
      t
    );

    EXECUTE format(
      'CREATE TRIGGER prevent_organization_id_change_%1$s
       BEFORE UPDATE ON public.%1$I
       FOR EACH ROW
       EXECUTE FUNCTION public.prevent_organization_id_change()',
      t
    );
  END LOOP;
END $$;
