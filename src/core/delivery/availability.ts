export type InstanceAvailability = {
  contract: "INSTANCE_AVAILABILITY_V1";
  instance_id: string;
  configured: boolean;
  open: boolean;
  timezone: string | null;
  checked_at: string;
};
export function parseAvailability(value: unknown, instanceId: string): InstanceAvailability | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    v["contract"] !== "INSTANCE_AVAILABILITY_V1" ||
    v["instance_id"] !== instanceId ||
    typeof v["configured"] !== "boolean" ||
    typeof v["open"] !== "boolean" ||
    typeof v["checked_at"] !== "string" ||
    !Number.isFinite(Date.parse(v["checked_at"]))
  )
    return null;
  if (v["open"] && !v["configured"]) return null;
  if (v["configured"]) {
    if (typeof v["timezone"] !== "string") return null;
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: v["timezone"] });
    } catch {
      return null;
    }
  } else if (v["timezone"] !== null) return null;
  return v as InstanceAvailability;
}
