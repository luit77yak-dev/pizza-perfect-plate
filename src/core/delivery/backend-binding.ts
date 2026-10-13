/** Configuration consistency only; this does not authenticate an actor. */
export function sameDeliveryBackend(actual: unknown, expected: unknown): boolean {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  try {
    const a = new URL(actual),
      b = new URL(expected);
    const safe = (url: URL) =>
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)));
    return safe(a) && safe(b) && a.origin === b.origin;
  } catch {
    return false;
  }
}
