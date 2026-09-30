import { supabase } from "@/integrations/supabase/client";
import type { CommercialContract, CommercialOverview, CommercialProposal } from "./types";

export async function loadCommercialOverview(): Promise<CommercialOverview> {
  const [proposalsResult, contractsResult, clientsResult] = await Promise.all([
    supabase
      .from("neroxa_proposals" as never)
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("neroxa_contracts" as never)
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("neroxa_clients" as never)
      .select("id,legal_name,trade_name")
      .order("updated_at", { ascending: false }),
  ]);

  if (proposalsResult.error) throw new Error(proposalsResult.error.message);
  if (contractsResult.error) throw new Error(contractsResult.error.message);
  if (clientsResult.error) throw new Error(clientsResult.error.message);

  return {
    proposals: (proposalsResult.data ?? []) as unknown as CommercialProposal[],
    contracts: (contractsResult.data ?? []) as unknown as CommercialContract[],
    clients: (clientsResult.data ?? []) as unknown as CommercialOverview["clients"],
  };
}
