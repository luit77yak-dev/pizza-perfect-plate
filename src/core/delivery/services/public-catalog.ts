/** Public read contract: same RPC/shape as the current external storefront loader.
 * No backend selection or fallback; transport is explicitly provided.
 */
export interface PublicCatalog {
  context: { domain: string; instance_id: string; organization_id: string; [key: string]: unknown };
  categories: Array<{ id: string; name: string; active: boolean; [key: string]: unknown }>;
  products: Array<{
    id: string;
    category_id: string | null;
    name: string;
    price: number | null;
    active: boolean;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  addon_groups: Array<{
    id: string;
    name: string;
    required: boolean;
    min_selections: number;
    max_selections: number;
    active: boolean;
    products: Array<{ product_id: string }>;
    addons: Array<{ id: string; name: string; price_delta: number; active: boolean }>;
  }>;
  settings: Record<string, unknown>;
  delivery_zones: Array<Record<string, unknown>>;
}

export interface PublicCatalogTransport {
  rpc(
    name: "get_public_storefront_catalog",
    parameters: { p_domain: string },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function identified(value: unknown): value is Record<string, unknown> & { id: string } {
  return record(value) && typeof value["id"] === "string" && uuid.test(value["id"]);
}
function normalizeDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(normalized))
    throw new Error("Domínio explícito inválido.");
  return normalized;
}

export function createPublicCatalogOperations(transport: PublicCatalogTransport) {
  return {
    async load(domain: string): Promise<PublicCatalog | null> {
      const normalized = normalizeDomain(domain);
      const { data, error } = await transport.rpc("get_public_storefront_catalog", {
        p_domain: normalized,
      });
      if (error) throw new Error(error.message);
      if (data === null) return null;
      if (
        !record(data) ||
        !record(data["context"]) ||
        !Array.isArray(data["categories"]) ||
        !Array.isArray(data["products"]) ||
        !Array.isArray(data["addon_groups"]) ||
        !record(data["settings"]) ||
        !Array.isArray(data["delivery_zones"])
      ) {
        throw new Error("Resposta inválida de catálogo.");
      }
      const context = data["context"];
      if (
        typeof context["domain"] !== "string" ||
        normalizeDomain(context["domain"]) !== normalized ||
        typeof context["instance_id"] !== "string" ||
        !uuid.test(context["instance_id"]) ||
        typeof context["organization_id"] !== "string" ||
        !uuid.test(context["organization_id"])
      ) {
        throw new Error("Catálogo incompatível com o domínio solicitado.");
      }
      const categories = data["categories"];
      const products = data["products"];
      if (
        categories.some(
          (c) => !identified(c) || typeof c["name"] !== "string" || c["active"] !== true,
        )
      )
        throw new Error("Categoria inválida.");
      const categoryIds = new Set(categories.map((c) => c["id"]));
      if (
        products.some(
          (p) =>
            !identified(p) ||
            typeof p["name"] !== "string" ||
            p["active"] !== true ||
            !record(p["metadata"]) ||
            (p["price"] !== null &&
              (typeof p["price"] !== "number" || !Number.isFinite(p["price"]) || p["price"] < 0)) ||
            (p["category_id"] !== null && !categoryIds.has(p["category_id"])),
        )
      )
        throw new Error("Produto ou categoria inválidos.");
      const productIds = new Set(products.map((p) => p["id"]));
      const addonIds = new Set<string>();
      for (const group of data["addon_groups"]) {
        if (
          !identified(group) ||
          group["active"] !== true ||
          typeof group["name"] !== "string" ||
          typeof group["required"] !== "boolean" ||
          !Number.isInteger(group["min_selections"]) ||
          !Number.isInteger(group["max_selections"]) ||
          Number(group["min_selections"]) < 0 ||
          Number(group["max_selections"]) < Math.max(1, Number(group["min_selections"])) ||
          !Array.isArray(group["products"]) ||
          group["products"].length === 0 ||
          !Array.isArray(group["addons"])
        )
          throw new Error("Grupo de adicionais inválido.");
        if (group["products"].some((p) => !record(p) || !productIds.has(p["product_id"])))
          throw new Error("Vínculo de adicionais inválido.");
        for (const addon of group["addons"]) {
          if (
            !identified(addon) ||
            addon["active"] !== true ||
            typeof addon["name"] !== "string" ||
            typeof addon["price_delta"] !== "number" ||
            !Number.isFinite(addon["price_delta"]) ||
            addon["price_delta"] < 0 ||
            addonIds.has(addon.id)
          )
            throw new Error("Adicional inválido.");
          addonIds.add(addon.id);
        }
        const minimum = Math.max(Number(group["min_selections"]), group["required"] ? 1 : 0);
        if (group["addons"].length < minimum) throw new Error("Grupo obrigatório indisponível.");
      }
      return data as unknown as PublicCatalog;
    },
  };
}
