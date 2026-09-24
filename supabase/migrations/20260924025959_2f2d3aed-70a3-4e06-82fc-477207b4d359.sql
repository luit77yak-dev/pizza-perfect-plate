REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.app_role[]) FROM anon;
REVOKE ALL ON FUNCTION public.is_org_manager(uuid) FROM anon;