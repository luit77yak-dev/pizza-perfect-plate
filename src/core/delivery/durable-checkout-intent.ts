export interface CheckoutIntentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface CheckoutIntentLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}
type Intent = {
  state: "PENDING" | "CONFIRMED";
  cartReference: string;
  version: 1;
  instanceId: string;
  key: string;
  fingerprint: string;
  createdAt: number;
  expiresAt: number;
};
const seen = new WeakMap<object, Map<string, string>>();
function mark(storage: CheckoutIntentStorage, instance: string, value: string | null) {
  if (!seen.has(storage)) seen.set(storage, new Map());
  if (value === null) seen.get(storage)?.delete(instance);
  else seen.get(storage)?.set(instance, value);
  if (
    typeof document !== "undefined" &&
    typeof window !== "undefined" &&
    storage === window.localStorage
  ) {
    const name = "__Host-neroxa-intent-" + instance;
    document.cookie =
      name +
      "=" +
      (value === null ? "" : "pending") +
      "; Path=/; Secure; SameSite=Strict; Max-Age=" +
      (value === null ? 0 : 365 * 86400);
    if (value !== null && !document.cookie.split("; ").includes(name + "=pending"))
      throw Error("Marcador de recuperação indisponível. Pedido não enviado.");
  }
}
function remembered(storage: CheckoutIntentStorage, instance: string) {
  return (
    seen.get(storage)?.has(instance) ||
    (typeof document !== "undefined" &&
      document.cookie.split("; ").includes("__Host-neroxa-intent-" + instance + "=pending"))
  );
}
const ttl = 24 * 60 * 60 * 1000;
export function intentStorageKey(instanceId: string) {
  return `neroxa:checkout-intent:v1:${instanceId}`;
}
function read(storage: CheckoutIntentStorage, instanceId: string): Intent | null {
  const raw = storage.getItem(intentStorageKey(instanceId));
  if (raw === null && remembered(storage, instanceId))
    throw Error("Cofre removido após tentativa; reconciliação autorizada necessária.");
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object")
    throw Error("Intenção inválida; solicite reconciliação segura.");
  const i = parsed as Intent;
  if (
    !["PENDING", "CONFIRMED"].includes(i.state) ||
    !/^[0-9a-f]{64}$/.test(i.cartReference) ||
    i.version !== 1 ||
    i.instanceId !== instanceId ||
    !/^[0-9a-f-]{36}$/i.test(i.key) ||
    !/^[0-9a-f]{64}$/.test(i.fingerprint) ||
    !Number.isFinite(i.createdAt) ||
    i.expiresAt !== i.createdAt + ttl
  )
    throw Error("Intenção inválida; solicite reconciliação segura.");
  return i;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
async function fingerprint(payload: Record<string, unknown>) {
  const content = { ...payload };
  delete content["idempotency_key"];
  // Same browser serializer as the original attempt; PostgreSQL also independently hashes JSONB.
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(content))),
  );
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function withDurableCheckoutIntent<T>(
  instanceId: string,
  payload: Record<string, unknown>,
  operation: (
    authorizedPayload: Record<string, unknown>,
    resolve: (rolledBack?: boolean) => void,
  ) => Promise<T>,
  options: { storage: CheckoutIntentStorage; locks: CheckoutIntentLocks; now?: () => number },
): Promise<T> {
  if (
    typeof payload["client_cart_reference"] !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload["client_cart_reference"])
  )
    throw Error("Referência de carrinho inválida.");
  if (payload["instance_id"] !== instanceId) throw Error("Intenção de outra loja.");
  if (!options.storage || !options.locks)
    throw Error("Armazenamento seguro indisponível; pedido não enviado.");
  return options.locks.request(intentStorageKey(instanceId), async () => {
    const now = (options.now ?? Date.now)();
    let prior: Intent | null;
    try {
      prior = read(options.storage, instanceId);
    } catch {
      throw Error(
        "Não foi possível recuperar a tentativa anterior. Nenhum novo pedido foi enviado; solicite reconciliação segura.",
      );
    }
    const hash = await fingerprint(payload);
    if (prior?.state === "CONFIRMED" && prior.cartReference !== payload["client_cart_reference"])
      prior = null;
    if (prior && now >= prior.expiresAt)
      throw Error(
        "Tentativa expirada e não reconciliada. Não crie outro pedido; solicite atendimento seguro.",
      );
    if (prior && prior.fingerprint !== hash)
      throw Error(
        "Existe uma tentativa pendente. Reentre os mesmos itens e dados originais para recuperar o resultado.",
      );
    const intent: Intent = prior ?? {
      state: "PENDING",
      cartReference: payload["client_cart_reference"] as string,
      version: 1,
      instanceId,
      key: crypto.randomUUID(),
      fingerprint: hash,
      createdAt: now,
      expiresAt: now + ttl,
    };
    try {
      const encoded = JSON.stringify(intent);
      options.storage.setItem(intentStorageKey(instanceId), encoded);
      if (options.storage.getItem(intentStorageKey(instanceId)) !== encoded)
        throw Error("Durable write unavailable");
    } catch {
      throw Error(
        "Armazenamento indisponível. Pedido não enviado; não use outro navegador para repetir uma tentativa incerta.",
      );
    }
    mark(options.storage, instanceId, JSON.stringify(intent));
    let resolved: "CONFIRMED" | "ROLLED_BACK" | null = null;
    const resolve = (rolledBack = false) => {
      resolved = rolledBack ? "ROLLED_BACK" : "CONFIRMED";
    };
    try {
      return await operation({ ...payload, idempotency_key: intent.key }, resolve);
    } finally {
      if (resolved) {
        // Failure to clean up is conservative: keep the original key, never silently replace it.
        try {
          if (resolved === "ROLLED_BACK" && !prior) {
            options.storage.removeItem(intentStorageKey(instanceId));
            mark(options.storage, instanceId, null);
          } else if (resolved === "ROLLED_BACK")
            options.storage.setItem(
              intentStorageKey(instanceId),
              JSON.stringify({ ...intent, state: "PENDING" }),
            );
          else
            options.storage.setItem(
              intentStorageKey(instanceId),
              JSON.stringify({ ...intent, state: "CONFIRMED" }),
            );
        } catch {
          /* reconciliation remains necessary */
        }
      }
    }
  });
}

export async function cartReference(lineIds: string[]) {
  return fingerprint({ lineIds });
}
export function durableIntentState(storage: CheckoutIntentStorage, instanceId: string) {
  try {
    return read(storage, instanceId)?.state ?? null;
  } catch {
    return "BLOCKED" as const;
  }
}
