import { supabase } from "@/integrations/supabase/client";
import type { ClientStatus, NeroxaClient, NeroxaClientContact } from "./types";

export async function isNeroxaStaff() {
  const { data, error } = await supabase.rpc("is_neroxa_staff" as never, {} as never);
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function listNeroxaClients() {
  const { data, error } = await supabase
    .from("neroxa_clients" as never)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NeroxaClient[];
}

export async function listNeroxaClientContacts(clientId: string) {
  const { data, error } = await supabase
    .from("neroxa_client_contacts" as never)
    .select("*")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NeroxaClientContact[];
}

export async function createNeroxaClient(input: {
  legalName?: string;
  tradeName?: string;
  taxId?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("create_neroxa_client" as never, {
    p_legal_name: input.legalName || null,
    p_trade_name: input.tradeName || null,
    p_tax_id: input.taxId || null,
    p_notes: input.notes || null,
  } as never);

  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function updateNeroxaClient(input: {
  clientId: string;
  legalName?: string;
  tradeName?: string;
  taxId?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("update_neroxa_client" as never, {
    p_client_id: input.clientId,
    p_legal_name: input.legalName || null,
    p_trade_name: input.tradeName || null,
    p_tax_id: input.taxId || null,
    p_notes: input.notes || null,
  } as never);

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function transitionNeroxaClient(clientId: string, status: ClientStatus) {
  const { data, error } = await supabase.rpc("transition_neroxa_client_status" as never, {
    p_client_id: clientId,
    p_new_status: status,
  } as never);

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function createNeroxaClientContact(input: {
  clientId: string;
  name: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  isPrimary?: boolean;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc("create_neroxa_client_contact" as never, {
    p_client_id: input.clientId,
    p_name: input.name,
    p_role_title: input.roleTitle || null,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_whatsapp: input.whatsapp || null,
    p_is_primary: Boolean(input.isPrimary),
    p_notes: input.notes || null,
  } as never);

  if (error) throw new Error(error.message);
  return data as unknown as string;
}
