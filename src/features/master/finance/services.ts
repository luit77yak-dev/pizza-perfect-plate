import {supabase} from "@/integrations/supabase/client";
import type {FinanceOverview} from "./types";
export async function loadFinanceOverview():Promise<FinanceOverview>{
 const [i,p,c]=await Promise.all([
  supabase.from("neroxa_invoices" as never).select("*").order("due_date",{ascending:true}),
  supabase.from("neroxa_payments" as never).select("*").order("created_at",{ascending:false}),
  supabase.from("neroxa_clients" as never).select("id,legal_name,trade_name").order("updated_at",{ascending:false}),
 ]);
 if(i.error) throw new Error(i.error.message); if(p.error) throw new Error(p.error.message); if(c.error) throw new Error(c.error.message);
 return {invoices:(i.data??[]) as never,payments:(p.data??[]) as never,clients:(c.data??[]) as never};
}