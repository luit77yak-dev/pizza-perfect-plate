-- Candidate only. Enforce product/category instance equality independently of RLS policy OR.
-- Validate existing rows before deployment; reject rather than silently repair legacy data.
create or replace function public.neroxa_assert_product_category_instance()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.category_id is not null and not exists (
   select 1 from public.neroxa_storefront_categories c
   where c.id = new.category_id and c.instance_id = new.instance_id
 ) then
   raise exception 'Product category must belong to the same instance'
     using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function public.neroxa_assert_product_category_instance() from public,anon,authenticated;
drop trigger if exists trg_neroxa_product_category_instance on public.neroxa_storefront_products;
create trigger trg_neroxa_product_category_instance
before insert or update of category_id,instance_id on public.neroxa_storefront_products
for each row execute function public.neroxa_assert_product_category_instance();

-- Category reassignment must also not strand linked products.
create or replace function public.neroxa_assert_category_instance_change()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.instance_id is distinct from old.instance_id and exists (
   select 1 from public.neroxa_storefront_products p
   where p.category_id = old.id and p.instance_id <> new.instance_id
 ) then
   raise exception 'Category move would invalidate product instance'
     using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function public.neroxa_assert_category_instance_change() from public,anon,authenticated;
drop trigger if exists trg_neroxa_category_instance_guard on public.neroxa_storefront_categories;
create trigger trg_neroxa_category_instance_guard
before update of instance_id on public.neroxa_storefront_categories
for each row execute function public.neroxa_assert_category_instance_change();
