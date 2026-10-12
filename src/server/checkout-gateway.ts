/**
 * Candidate same-origin checkout ingress (pure HTTP logic; no secrets).
 * Enabled only through an explicit server environment gate.
 * A matching Host/Origin pair is NOT cryptographic client authentication:
 * trusted edge routing and disabling direct public RPC access are release gates.
 */
export type StoreContext = {
  domain: string;
  instance_id: string;
  organization_id: string;
};

export type OrderResult = {
  order_id: string;
  order_number: number;
  total: number;
  /** Returned only once after a successful service-only capability registration. */
  amendment_token?: string;
};

export class CheckoutRateLimitError extends Error {}

export type CheckoutDependencies = {
  enabled: boolean;
  resolveContext: (domain: string) => Promise<StoreContext | null>;
  /** Enforced durably on the server; must reject on backend unavailability. */
  reserveQuota: (context: StoreContext, customerPhone: string) => Promise<void>;
  createOrder: (payload: Record<string, unknown>) => Promise<OrderResult>;
};

const MAX_BODY_BYTES = 64 * 1024;

function result(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

/**
 * Only the server route must supply resolveContext/createOrder.
 * Client cannot select a different store via JSON body or forwarded headers.
 */
export async function handleCheckoutRequest(
  request: Request,
  dependencies: CheckoutDependencies,
): Promise<Response> {
  if (!dependencies.enabled) return result(503, "Checkout seguro indisponível.");

  const url = new URL(request.url);
  // No localhost / Lovable / Vercel preview fallback for privileged checkout.
  if (url.protocol !== "https:" || !url.hostname || url.hostname === "localhost" ||
    url.hostname.endsWith(".vercel.app") || url.hostname.endsWith(".lovable.app") ||
    url.hostname.endsWith(".lovableproject.com") || url.hostname === "127.0.0.1") {
    return result(403, "Domínio não autorizado para pedidos.");
  }

  // TanStack Start may remove Host before forwarding the Request to routes.
  // When Host is present, it must match the URL's hostname, and an explicit
  // incorrect port is forbidden. When the adapter omits Host entirely, require
  // Origin to match the full URL origin (including scheme and nondefault port).
  // request.url itself MUST originate from a trusted routing edge in deployment:
  // matching client-controlled headers is NOT proof of requester identity.
  const hostHeader = request.headers.get("host");
  const originHeader = request.headers.get("origin");
  const validHost =
    !request.headers.has("host") ||
    (!!hostHeader &&
      (hostHeader.toLowerCase() === url.host.toLowerCase() ||
        (url.port !== "" && hostHeader.toLowerCase() === url.hostname.toLowerCase())));
  if (!validHost ||
    !originHeader || originHeader !== url.origin ||
    (request.headers.has("sec-fetch-site") &&
      !["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? ""))) {
    return result(403, "Origem da solicitação inválida.");
  }

  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return result(415, "Formato de pedido inválido.");
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) {
    return result(413, "Pedido muito grande.");
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return result(413, "Pedido muito grande.");
    }
    body = JSON.parse(raw);
  } catch {
    return result(400, "JSON inválido.");
  }

  if (!isRecord(body) || !isRecord(body["p_order"])) {
    return result(400, "Dados do pedido inválidos.");
  }
  const payload = body["p_order"];
  if (!isUuid(payload["idempotency_key"]) || !Array.isArray(payload["items"]) ||
    payload["items"].length < 1 || payload["items"].length > 40 ||
    typeof payload["customer_phone"] !== "string" ||
    !/^[0-9]{10,15}$/.test(payload["customer_phone"].replace(/[^0-9]/g, ""))) {
    return result(400, "Itens ou chave do pedido inválidos.");
  }

  let context: StoreContext | null;
  try {
    context = await dependencies.resolveContext(url.hostname.toLowerCase());
  } catch {
    return result(503, "Não foi possível conferir a loja.");
  }
  if (!context || context.domain.toLowerCase() !== url.hostname.toLowerCase() ||
    !isUuid(context.instance_id) || !isUuid(context.organization_id)) {
    return result(404, "Loja não encontrada.");
  }
  // Legacy body values are checked for discrepancies, then overwritten.
  if ((payload["instance_id"] !== undefined && payload["instance_id"] !== context.instance_id) ||
    (payload["organization_id"] !== undefined && payload["organization_id"] !== context.organization_id) ||
    (payload["store_domain"] !== undefined &&
      (typeof payload["store_domain"] !== "string" ||
       payload["store_domain"].toLowerCase() !== context.domain.toLowerCase()))) {
    return result(403, "Pedido incompatível com a loja.");
  }

  const authorizedPayload: Record<string, unknown> = {
    ...payload,
    organization_id: context.organization_id,
    instance_id: context.instance_id,
    store_domain: context.domain,
  };

  // This quota must be persistent/atomic; local memory quotas cannot protect
  // a serverless deployment with multiple concurrent workers.
  try {
    await dependencies.reserveQuota(context, payload["customer_phone"] as string);
  } catch (error) {
    if (error instanceof CheckoutRateLimitError) {
      return result(429, "Muitas tentativas de pedido. Tente novamente mais tarde.");
    }
    return result(503, "Validação de limite temporariamente indisponível.");
  }

  try {
    const created = await dependencies.createOrder(authorizedPayload);
    if (!isUuid(created.order_id) || !Number.isSafeInteger(Number(created.order_number)) ||
      Number(created.order_number) < 1 || !Number.isFinite(Number(created.total))) {
      return result(502, "Resposta inválida do checkout.");
    }
    if (created.amendment_token !== undefined &&
      !/^[A-Za-z0-9_-]{43}$/.test(created.amendment_token)) {
      return result(502, "Credencial de alteração inválida.");
    }
    return Response.json(
      {
        order_id: created.order_id,
        order_number: Number(created.order_number),
        total: Number(created.total),
        ...(created.amendment_token ? { amendment_token: created.amendment_token } : {}),
      },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch {
    // No DB error details, stack traces, tokens or personally identifiable data.
    return result(503, "Não foi possível registrar o pedido. Tente novamente.");
  }
}
