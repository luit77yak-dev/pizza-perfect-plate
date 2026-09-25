create or replace function public.claim_first_owner()
returns boolean language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  if auth.uid() is null then return false; end if;
  select o.id into _org from organizations o
   where not exists (select 1 from organization_members m where m.organization_id = o.id and m.role = 'OWNER')
   order by o.created_at limit 1;
  if _org is null then return false; end if;
  insert into organization_members (organization_id, user_id, role) values (_org, auth.uid(), 'OWNER')
  on conflict do nothing;
  return true;
end $$;
revoke execute on function public.claim_first_owner() from public, anon;
grant execute on function public.claim_first_owner() to authenticated;