import { supabase } from "@/integrations/supabase/client";
import type { OrganizationRole } from "../tenant-access";
import type { SupplierModule } from "../modules";

export interface SupplierPanelContext {
  organizationId: string | null;
  role: OrganizationRole | null;
  organization: { id: string; name: string } | null;
  instance: { id: string; name: string; slug: string; status: string; system_type: string } | null;
  subscription: { id: string; status: string; plan_id: string } | null;
  plan: { id: string; name: string; slug: string } | null;
  modules: Array<{ key: SupplierModule; enabled: boolean; limit_value: number | null }>;
}

const emptyContext: SupplierPanelContext = {
  organizationId: null,
  role: null,
  organization: null,
  instance: null,
  subscription: null,
  plan: null,
  modules: [],
};

export async function loadSupplierPanelContext(): Promise<SupplierPanelContext> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return emptyContext;

  const { data, error } = await supabase.rpc("get_supplier_panel_context" as never);
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return emptyContext;

  return {
    organizationId: (data as SupplierPanelContext).organizationId ?? (data as { organization_id?: string }).organization_id ?? null,
    role: ((data as SupplierPanelContext).role ?? null) as OrganizationRole | null,
    organization: (data as SupplierPanelContext).organization ?? null,
    instance: (data as SupplierPanelContext).instance ?? null,
    subscription: (data as SupplierPanelContext).subscription ?? null,
    plan: (data as SupplierPanelContext).plan ?? null,
    modules: Array.isArray((data as SupplierPanelContext).modules) ? (data as SupplierPanelContext).modules : [],
  };
}
