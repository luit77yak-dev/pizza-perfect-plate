/** Shared ingress contract. SQL remains authoritative for availability/prices. */
export function validateCustomerDetails(payload: Record<string, unknown>): string | null {
  const text = (key: string, max: number) =>
    typeof payload[key] === "string" &&
    (payload[key] as string).trim().length > 0 &&
    (payload[key] as string).length <= max;
  if (!text("customer_name", 160) || (payload["customer_name"] as string).trim().length < 2)
    return "Informe um nome válido.";
  if (
    !text("customer_phone", 32) ||
    !/^[0-9]{10,15}$/.test((payload["customer_phone"] as string).replace(/[^0-9]/g, ""))
  )
    return "Informe um telefone válido.";
  if (payload["fulfillment"] !== "DELIVERY" && payload["fulfillment"] !== "PICKUP")
    return "Selecione entrega ou retirada.";
  if (payload["fulfillment"] === "DELIVERY") {
    for (const [field, label] of [
      ["address_street", "rua"],
      ["address_number", "número ou S/N"],
      ["address_neighborhood", "bairro"],
    ]) {
      if (!text(field!, 200)) return `Informe ${label}.`;
    }
  }
  return null;
}
