import { CheckoutRateLimitError, type StoreContext } from "./checkout-gateway";

/** This is a candidate only. Never enable without staged SQL + ACL revocation. */
export class AmendmentAuthorizationError extends Error {}
export class AmendmentConflictError extends Error {}

export type AmendmentResult = {
  order_id: string;
  order_number: number;
  subtotal: number;
  total: number;
  added_amount: number;
  payment_state: "NOT_SETTLED";
};

export type AmendmentDependencies = {
  enabled: boolean;
  resolveContext: (domain: string) => Promise<StoreContext | null>;
  reserveQuota: (context: StoreContext, token: string) => Promise<void>;
  appendItems: (context: StoreContext, request: {
    orderId: string;
    token: string;
    requestKey: string;
    items: Array<Record<string, unknown>>;
  }) => Promise<AmendmentResult>;
};

const MAX_AMENDMENT_BYTES = 32 * 1024;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const errorResponse = (status: number, message: string): Response =>
  Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function handleOrderAmendmentRequest(
  request: Request,
  dependencies: AmendmentDependencies,
): Promise<Response> {
  if (!dependencies.enabled) return errorResponse(503, "Complementos seguros indisponíveis.");
  if (request.method !== "POST") return errorResponse(405, "Método não permitido.");

  const url = new URL(request.url);
  if (
    url.protocol !== "https:" || !url.hostname || url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" || url.hostname.endsWith(".vercel.app") ||
    url.hostname.endsWith(".lovable.app") || url.hostname.endsWith(".lovableproject.com")
  ) return errorResponse(403, "Domínio não autorizado para pedidos.");

  // request.url MUST be vouched for by the deployment edge. Host/Origin cannot
  // authenticate a nonbrowser caller; they only reject obvious inconsistencies.
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const validHost = !request.headers.has("host") ||
    (!!host && (host.toLowerCase() === url.host.toLowerCase() ||
      (url.port !== "" && host.toLowerCase() === url.hostname.toLowerCase())));
  if (!validHost || !origin || origin !== url.origin ||
    (request.headers.has("sec-fetch-site") &&
      !["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? ""))) {
    return errorResponse(403, "Origem inválida.");
  }

  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return errorResponse(415, "Formato inválido.");
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_AMENDMENT_BYTES) {
    return errorResponse(413, "Solicitação muito grande.");
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_AMENDMENT_BYTES) {
      return errorResponse(413, "Solicitação muito grande.");
    }
    body = JSON.parse(raw);
  } catch {
    return errorResponse(400, "JSON inválido.");
  }

  if (!isRecord(body) ||
    typeof body["order_id"] !== "string" || !UUID_PATTERN.test(body["order_id"]) ||
    typeof body["request_key"] !== "string" || !UUID_PATTERN.test(body["request_key"]) ||
    typeof body["token"] !== "string" || !TOKEN_PATTERN.test(body["token"]) ||
    !Array.isArray(body["items"]) || body["items"].length < 1 || body["items"].length > 25 ||
    !body["items"].every((item: unknown) =>
      isRecord(item) && typeof item["product_id"] === "string" &&
      UUID_PATTERN.test(item["product_id"]) &&
      typeof item["quantity"] === "number" &&
      Number.isInteger(item["quantity"]) &&
      (item["quantity"] as number) >= 1 && (item["quantity"] as number) <= 10)) {
    return errorResponse(400, "Itens ou autorização inválidos.");
  }

  let context: StoreContext | null;
  try {
    context = await dependencies.resolveContext(url.hostname.toLowerCase());
  } catch {
    return errorResponse(503, "Não foi possível validar a loja.");
  }
  if (!context || context.domain.toLowerCase() !== url.hostname.toLowerCase() ||
    !UUID_PATTERN.test(context.instance_id) || !UUID_PATTERN.test(context.organization_id) ||
    (body["instance_id"] !== undefined && body["instance_id"] !== context.instance_id)) {
    return errorResponse(403, "Loja não autorizada.");
  }

  try {
    await dependencies.reserveQuota(context, body["token"]);
  } catch (e) {
    if (e instanceof CheckoutRateLimitError) {
      return errorResponse(429, "Muitas tentativas. Tente mais tarde.");
    }
    return errorResponse(503, "Validação temporariamente indisponível.");
  }

  try {
    const amended = await dependencies.appendItems(context, {
      orderId: body["order_id"],
      token: body["token"],
      requestKey: body["request_key"],
      items: body["items"],
    });
    if (!UUID_PATTERN.test(amended.order_id) ||
      !Number.isSafeInteger(Number(amended.order_number)) ||
      ![amended.subtotal, amended.total, amended.added_amount].every(
        x => Number.isFinite(Number(x)) && Number(x) >= 0,
      ) || amended.payment_state !== "NOT_SETTLED") {
      return errorResponse(502, "Resposta inválida da alteração.");
    }
    return Response.json(
      { order_id: amended.order_id, order_number: Number(amended.order_number),
        subtotal: Number(amended.subtotal), total: Number(amended.total),
        added_amount: Number(amended.added_amount),
        payment_state: "NOT_SETTLED" },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (e) {
    if (e instanceof AmendmentAuthorizationError) {
      return errorResponse(403, "Alteração não autorizada.");
    }
    if (e instanceof AmendmentConflictError) {
      return errorResponse(409, "Este pedido não aceita a alteração solicitada.");
    }
    return errorResponse(503, "Não foi possível alterar o pedido.");
  }
}
