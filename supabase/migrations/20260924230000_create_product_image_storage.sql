-- Product image storage for the Pizza Perfect Plate staff panel.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images are publicly readable" on storage.objects;
create policy "product images are publicly readable"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "staff can upload product images" on storage.objects;
create policy "staff can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id::text = (storage.foldername(name))[1]
      and om.active = true
      and om.role in ('OWNER', 'ADMIN')
  )
);

drop policy if exists "staff can update product images" on storage.objects;
create policy "staff can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id::text = (storage.foldername(name))[1]
      and om.active = true
      and om.role in ('OWNER', 'ADMIN')
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id::text = (storage.foldername(name))[1]
      and om.active = true
      and om.role in ('OWNER', 'ADMIN')
  )
);

drop policy if exists "staff can delete product images" on storage.objects;
create policy "staff can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id::text = (storage.foldername(name))[1]
      and om.active = true
      and om.role in ('OWNER', 'ADMIN')
  )
);
