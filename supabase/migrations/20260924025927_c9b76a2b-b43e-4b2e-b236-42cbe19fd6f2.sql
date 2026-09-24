CREATE TYPE public.app_role AS ENUM ('OWNER','ADMIN','ATTENDANT','KITCHEN','DRIVER','CUSTOMER');
CREATE TYPE public.order_status AS ENUM ('RECEIVED','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED');
CREATE TYPE public.coupon_type AS ENUM ('PERCENTAGE','FIXED','FREE_DELIVERY');
CREATE TYPE public.fulfillment_type AS ENUM ('DELIVERY','PICKUP');
CREATE TYPE public.payment_method AS ENUM ('CASH','PIX','CARD_ON_DELIVERY','CARD_ON_SITE');
CREATE TYPE public.product_kind AS ENUM ('PIZZA','SIMPLE');
CREATE TYPE public.half_pizza_rule AS ENUM ('highest_half','average_halves','fixed_price');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  demo_mode boolean NOT NULL DEFAULT false,
  order_counter integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'CUSTOMER',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, role)
);
CREATE INDEX idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX idx_org_members_org ON public.organization_members (organization_id);

CREATE TABLE public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations ON DELETE CASCADE,
  description text,
  whatsapp_phone text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  logo_url text,
  favicon_url text,
  hero_image_url text,
  hero_title text,
  hero_subtitle text,
  hero_cta_label text,
  primary_color text NOT NULL DEFAULT '25 85% 45%',
  secondary_color text NOT NULL DEFAULT '150 30% 25%',
  font_family text NOT NULL DEFAULT 'Sora',
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_methods public.payment_method[] NOT NULL DEFAULT ARRAY['CASH','PIX','CARD_ON_DELIVERY']::public.payment_method[],
  delivery_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  pickup_instructions text,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  estimated_delivery_minutes integer NOT NULL DEFAULT 45,
  estimated_pickup_minutes integer NOT NULL DEFAULT 25,
  half_pizza_pricing_rule public.half_pizza_rule NOT NULL DEFAULT 'highest_half',
  half_pizza_fixed_price numeric(10,2),
  loyalty_points_per_currency numeric(10,2) NOT NULL DEFAULT 1,
  scheduling_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid()
      AND m.active AND m.role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['OWNER','ADMIN','ATTENDANT','KITCHEN','DRIVER']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['OWNER','ADMIN']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.next_order_number(_org uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.organizations SET order_counter = order_counter + 1
  WHERE id = _org RETURNING order_counter INTO n;
  RETURN n;
END; $$;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_categories_org ON public.categories (organization_id);

CREATE TABLE public.product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  slices integer,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sizes_org ON public.product_sizes (organization_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  kind public.product_kind NOT NULL DEFAULT 'SIMPLE',
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  allow_half boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_products_org ON public.products (organization_id);
CREATE INDEX idx_products_category ON public.products (category_id);

CREATE TABLE public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES public.product_sizes ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, size_id)
);
CREATE INDEX idx_prices_org ON public.product_prices (organization_id);

CREATE TABLE public.product_crusts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crusts_org ON public.product_crusts (organization_id);

CREATE TABLE public.product_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_addons_org ON public.product_addons (organization_id);

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  type public.coupon_type NOT NULL,
  value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE INDEX idx_coupons_org ON public.coupons (organization_id);

CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  neighborhoods text[] NOT NULL DEFAULT '{}',
  minimum_order numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  estimated_minutes integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zones_org ON public.delivery_zones (organization_id);

CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_drivers_org ON public.drivers (organization_id);

CREATE TABLE public.store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, weekday)
);
CREATE INDEX idx_hours_org ON public.store_hours (organization_id);

CREATE TABLE public.special_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  date date NOT NULL,
  opens_at time,
  closes_at time,
  closed boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, date)
);
CREATE INDEX idx_special_hours_org ON public.special_hours (organization_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  order_number integer NOT NULL,
  customer_user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  fulfillment public.fulfillment_type NOT NULL DEFAULT 'DELIVERY',
  payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  status public.order_status NOT NULL DEFAULT 'RECEIVED',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons ON DELETE SET NULL,
  coupon_code text,
  delivery_zone_id uuid REFERENCES public.delivery_zones ON DELETE SET NULL,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_reference text,
  notes text,
  driver_id uuid REFERENCES public.drivers ON DELETE SET NULL,
  idempotency_key text,
  is_demo boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'PUBLIC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, order_number),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX idx_orders_org ON public.orders (organization_id);
CREATE INDEX idx_orders_customer ON public.orders (customer_user_id);
CREATE INDEX idx_orders_status ON public.orders (organization_id, status);
CREATE INDEX idx_orders_created ON public.orders (organization_id, created_at DESC);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders ON DELETE CASCADE,
  product_id uuid REFERENCES public.products ON DELETE SET NULL,
  product_name text NOT NULL,
  second_product_id uuid REFERENCES public.products ON DELETE SET NULL,
  second_product_name text,
  is_half boolean NOT NULL DEFAULT false,
  size_id uuid REFERENCES public.product_sizes ON DELETE SET NULL,
  size_name text,
  crust_id uuid REFERENCES public.product_crusts ON DELETE SET NULL,
  crust_name text,
  crust_price numeric(10,2) NOT NULL DEFAULT 0,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON public.order_items (order_id);
CREATE INDEX idx_order_items_org ON public.order_items (organization_id);

CREATE TABLE public.order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items ON DELETE CASCADE,
  addon_id uuid REFERENCES public.product_addons ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_item_addons_item ON public.order_item_addons (order_item_id);
CREATE INDEX idx_item_addons_org ON public.order_item_addons (organization_id);

CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by uuid REFERENCES auth.users ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_hist_order ON public.order_status_history (order_id);
CREATE INDEX idx_status_hist_org ON public.order_status_history (organization_id);

CREATE TABLE public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  phone text,
  points_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_loyalty_org_user ON public.loyalty_accounts (organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_loyalty_org ON public.loyalty_accounts (organization_id);

CREATE TABLE public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders ON DELETE SET NULL,
  points integer NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_tx_account ON public.loyalty_transactions (loyalty_account_id);
CREATE INDEX idx_loyalty_tx_org ON public.loyalty_transactions (organization_id);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users ON DELETE SET NULL,
  actor_label text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org ON public.audit_logs (organization_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','profiles','organization_members','organization_settings','categories','product_sizes','products','product_prices','product_crusts','product_addons','coupons','delivery_zones','drivers','store_hours','special_hours','orders','loyalty_accounts']
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT SELECT ON public.organizations, public.organization_settings, public.categories,
  public.product_sizes, public.products, public.product_prices, public.product_crusts,
  public.product_addons, public.delivery_zones, public.store_hours, public.special_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.organization_settings,
  public.categories, public.product_sizes, public.products, public.product_prices,
  public.product_crusts, public.product_addons, public.delivery_zones, public.store_hours,
  public.special_hours, public.coupons, public.drivers, public.orders, public.order_items,
  public.order_item_addons, public.order_status_history, public.loyalty_accounts,
  public.loyalty_transactions, public.audit_logs, public.profiles,
  public.organization_members TO authenticated;
GRANT ALL ON public.organizations, public.organization_settings, public.categories,
  public.product_sizes, public.products, public.product_prices, public.product_crusts,
  public.product_addons, public.delivery_zones, public.store_hours, public.special_hours,
  public.coupons, public.drivers, public.orders, public.order_items, public.order_item_addons,
  public.order_status_history, public.loyalty_accounts, public.loyalty_transactions,
  public.audit_logs, public.profiles, public.organization_members TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_crusts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_public_read ON public.organizations FOR SELECT TO anon, authenticated
  USING (active AND deleted_at IS NULL);
CREATE POLICY org_manager_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_manager(id)) WITH CHECK (public.is_org_manager(id));

CREATE POLICY settings_public_read ON public.organization_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_manager_write ON public.organization_settings FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY members_self_read ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_staff(organization_id));
CREATE POLICY members_manager_write ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY categories_read ON public.categories FOR SELECT TO anon, authenticated
  USING ((active AND deleted_at IS NULL) OR public.is_org_staff(organization_id));
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY sizes_read ON public.product_sizes FOR SELECT TO anon, authenticated
  USING (active OR public.is_org_staff(organization_id));
CREATE POLICY sizes_write ON public.product_sizes FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY products_read ON public.products FOR SELECT TO anon, authenticated
  USING ((active AND deleted_at IS NULL) OR public.is_org_staff(organization_id));
CREATE POLICY products_write ON public.products FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY prices_read ON public.product_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY prices_write ON public.product_prices FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY crusts_read ON public.product_crusts FOR SELECT TO anon, authenticated
  USING (active OR public.is_org_staff(organization_id));
CREATE POLICY crusts_write ON public.product_crusts FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY addons_read ON public.product_addons FOR SELECT TO anon, authenticated
  USING (active OR public.is_org_staff(organization_id));
CREATE POLICY addons_write ON public.product_addons FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY zones_read ON public.delivery_zones FOR SELECT TO anon, authenticated
  USING (active OR public.is_org_staff(organization_id));
CREATE POLICY zones_write ON public.delivery_zones FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY hours_read ON public.store_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hours_write ON public.store_hours FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY special_hours_read ON public.special_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY special_hours_write ON public.special_hours FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY coupons_staff_read ON public.coupons FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id));
CREATE POLICY coupons_write ON public.coupons FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY drivers_staff_read ON public.drivers FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id));
CREATE POLICY drivers_write ON public.drivers FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid() OR public.is_org_staff(organization_id));
CREATE POLICY orders_staff_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','ATTENDANT']::public.app_role[]));
CREATE POLICY orders_staff_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_org_staff(organization_id)) WITH CHECK (public.is_org_staff(organization_id));
CREATE POLICY orders_manager_delete ON public.orders FOR DELETE TO authenticated
  USING (public.is_org_manager(organization_id));

CREATE POLICY order_items_read ON public.order_items FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id) OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_user_id = auth.uid()));
CREATE POLICY order_items_staff_write ON public.order_items FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','ATTENDANT']::public.app_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','ATTENDANT']::public.app_role[]));

CREATE POLICY item_addons_read ON public.order_item_addons FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id) OR EXISTS (
    SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
    WHERE i.id = order_item_id AND o.customer_user_id = auth.uid()));
CREATE POLICY item_addons_staff_write ON public.order_item_addons FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','ATTENDANT']::public.app_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','ATTENDANT']::public.app_role[]));

CREATE POLICY status_hist_read ON public.order_status_history FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id) OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_user_id = auth.uid()));
CREATE POLICY status_hist_staff_insert ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(organization_id));

CREATE POLICY loyalty_read ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_staff(organization_id));
CREATE POLICY loyalty_write ON public.loyalty_accounts FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));
CREATE POLICY loyalty_tx_read ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (public.is_org_staff(organization_id) OR EXISTS (
    SELECT 1 FROM public.loyalty_accounts a WHERE a.id = loyalty_account_id AND a.user_id = auth.uid()));
CREATE POLICY loyalty_tx_write ON public.loyalty_transactions FOR ALL TO authenticated
  USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));

CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_org_manager(organization_id));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_staff(organization_id));