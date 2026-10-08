import { supabase } from "@/integrations/supabase/client";

export async function getPublicOrderStatus(orderId: string, customerPhone: string) {
  const { data, error } = await supabase.rpc("get_public_order_status", {
    p_order_id: orderId,
    p_customer_phone: customerPhone,
  });
  if (error) throw error;
  return data;
}
