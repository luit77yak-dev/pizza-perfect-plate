import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionOverview } from "./types";
export async function loadSubscriptionOverview(): Promise<SubscriptionOverview> {
 const [plansResult, subscriptionsResult, clientsResult] = await Promise.all([
  supabase.from("neroxa_plans" as never).select("*").order("active",{ascending:false}).order("name",{ascending:true}),
  supabase.from("neroxa_subscriptions" as never).select("*").order("updated_at",{ascending:false}),
  supabase.from("neroxa_clients" as never).select("id,legal_name,trade_name").order("updated_at",{ascending:false}),
 ]);
 if(plansResult.error) throw new Error(plansResult.error.message);
 if(subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
 if(clientsResult.error) throw new Error(clientsResult.error.message);
 return { plans:(plansResult.data??[]) as never, subscriptions:(subscriptionsResult.data??[]) as never, clients:(clientsResult.data??[]) as never };
}
