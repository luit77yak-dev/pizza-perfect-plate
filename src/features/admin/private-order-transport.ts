// Private commercial browser transport. Supabase Auth remains the identity provider.
import type { OrderStatus } from "../../lib/domain/types";

type Row = Record<string, unknown>;
type Context = { instance_id: string; instance_name: string };
type Options = {
  getToken: () => Promise<string>;
  fetcher?: typeof fetch;
  origin?: () => string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set<string>(["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]);
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta inválida.");
  return value as Row;
}
function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function scoped(value: unknown, instance: string, order?: string): Row {
  const item = row(value);
  if (!uuid(item["id"]) || item["instance_id"] !== instance || (order !== undefined && item["id"] !== order)
    || !statuses.has(String(item["status"]))) throw new Error("Resposta fora do escopo da loja.");
  return item;
}
export function createPrivateOrderTransport({ getToken, fetcher = fetch, origin = () => globalThis.location.origin }: Options) {
  async function post(path: string, payload: Row, authenticated: boolean): Promise<Row> {
    const target = origin();
    const u = new URL(target);
    if (u.protocol !== "https:" || u.origin !== target || u.hostname.endsWith(".workers.dev") || u.hostname.endsWith(".invalid"))
      throw new Error("Origem HTTPS privada necessária.");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Neroxa-Request-Nonce": Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, "0")).join(""),
    };
    if (authenticated) {
      const token = await getToken();
      if (typeof token !== "string" || !token || token.length > 16384) throw new Error("Sessão necessária.");
      headers["Authorization"] = "Bearer " + token;
    }
    const response = await fetcher(new URL(path, u), {
      method: "POST", credentials: "same-origin", redirect: "error", cache: "no-store",
      headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Operação não confirmada. Atualize os pedidos antes de repetir.");
    return row(await response.json());
  }
  return Object.freeze({
    async context(): Promise<Context> {
      const result = await post("/api/commercial/catalog", {}, false);
      const catalog = row(result["catalog"]);
      const context = row(catalog["context"]);
      if (catalog["selection_contract"] !== "GROUP_ADDONS_V1" || context["domain"] !== new URL(origin()).hostname
        || !uuid(context["instance_id"]) || typeof context["instance_name"] !== "string")
        throw new Error("Catálogo ou loja inválida.");
      return { instance_id: context["instance_id"], instance_name: context["instance_name"] };
    },
    async list(instance: string, status: OrderStatus | null) {
      if (!uuid(instance) || (status !== null && !statuses.has(status))) throw new Error("Filtro inválido.");
      const r = await post("/api/commercial/admin/list", { instance_id: instance, status }, true);
      if (!Array.isArray(r["orders"]) || r["orders"].length > 100 || typeof r["truncated"] !== "boolean") throw new Error("Lista inválida.");
      const orders = r["orders"].map((item) => scoped(item, instance));
      if (status !== null && orders.some(item => item["status"] !== status)) throw new Error("Filtro incompatível.");
      return { orders, truncated: r["truncated"] };
    },
    async detail(instance: string, order: string) {
      if (!uuid(instance) || !uuid(order)) throw new Error("Pedido inválido.");
      const r = await post("/api/commercial/admin/detail", { instance_id: instance, order_id: order }, true);
      const detail = row(r["detail"]);
      scoped(detail["order"], instance, order);
      return detail;
    },
    async transition(instance: string, order: string, status: OrderStatus) {
      if (!uuid(instance) || !uuid(order) || !statuses.has(status)) throw new Error("Transição inválida.");
      const r = await post("/api/commercial/admin/transition", { instance_id: instance, order_id: order, status, note: null }, true);
      const item = scoped(r["order"], instance, order);
      if (item["status"] !== status) throw new Error("Transição não confirmada.");
      return item;
    },
  });
}
