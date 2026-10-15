/** Deliberately memory-only: reload loses access and requires assisted support. */
const tokens = new Map<string, string>();
export function rememberPrivateTrackingToken(instance: string, order: string, token: string): void {
  if (typeof window !== "undefined" && /^[A-Za-z0-9_-]{43}$/.test(token))
    tokens.set(instance + ":" + order, token);
}
export async function readPrivateTracking(instance: string, order: string): Promise<unknown> {
  if (typeof window === "undefined") return null;
  const token = tokens.get(instance + ":" + order);
  if (!token) return null;
  const response = await fetch("/api/order-track", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ order_id: order }),
  });
  if (!response.ok) return null;
  return response.json();
}
