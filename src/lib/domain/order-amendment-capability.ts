/** Browser-only, per-order buyer capability held only in memory; reload requires assisted support. */
const tokens = new Map<string, string>();
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export function buyerAmendmentSessionKey(instanceId: string, orderId: string): string {
  if (!UUID_PATTERN.test(instanceId) || !UUID_PATTERN.test(orderId)) {
    throw new Error("Invalid store or order identifier");
  }
  return "ppp:amendment:v1:" + instanceId + ":" + orderId;
}

export function rememberBuyerAmendmentToken(
  instanceId: string,
  orderId: string,
  token: string,
): boolean {
  if (!TOKEN_PATTERN.test(token) || typeof window === "undefined") return false;
  try {
    tokens.set(buyerAmendmentSessionKey(instanceId, orderId), token);
    return true;
  } catch {
    return false;
  }
}

export function readBuyerAmendmentToken(instanceId: string, orderId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const candidate = tokens.get(buyerAmendmentSessionKey(instanceId, orderId));
    return candidate && TOKEN_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function forgetBuyerAmendmentToken(instanceId: string, orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    tokens.delete(buyerAmendmentSessionKey(instanceId, orderId));
  } catch {
    // Invalid identifiers may be rejected; never log or serialize the token.
  }
}
