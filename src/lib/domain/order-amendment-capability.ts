/** Browser-only, per-order buyer capability kept out of localStorage/order history. */
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
    sessionStorage.setItem(buyerAmendmentSessionKey(instanceId, orderId), token);
    return true;
  } catch {
    return false;
  }
}

export function readBuyerAmendmentToken(
  instanceId: string,
  orderId: string,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const candidate = sessionStorage.getItem(buyerAmendmentSessionKey(instanceId, orderId));
    return candidate && TOKEN_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function forgetBuyerAmendmentToken(instanceId: string, orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(buyerAmendmentSessionKey(instanceId, orderId));
  } catch {
    // Browser storage may be disabled; never log or serialize the token.
  }
}
