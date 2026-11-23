/**
 * Private LAB bridge from the existing Food CartItem data contract to
 * GROUP_ADDONS_V1. No public checkout fallback, no pricing authority here.
 * Build this ONLY into the isolated LAB overlay, never the commercial Food app.
 */
import { LabApiError, nonceHex } from './private-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;

type FoodCartLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  secondProductId?: string | null;
  isHalf?: boolean;
  sizeId?: string | null;
  crustId?: string | null;
  addons?: Array<{ id: string }>;
  complements?: Array<{ productId: string }>;
  notes?: string | null;
};

export type LabFoodOrderInput = {
  instance_id: string;
  organization_id: string;
  store_domain: string;
  customer_name: string;
  customer_phone: string;
  items: readonly FoodCartLine[];
};

export type LabPreparedFoodCheckout = {
  p_order: {
    instance_id: string;
    organization_id: string;
    store_domain: string;
    idempotency_key: string;
    client_cart_reference: string;
    customer_name: string;
    customer_phone: string;
    fulfillment: 'PICKUP';
    payment_method: 'CASH';
    expected_total: number;
    items: Array<{
      product_id: string;
      selection_contract: 'GROUP_ADDONS_V1';
      quantity: number;
      expected_unit_price: number;
      group_addon_ids: string[];
      size_id: string | null;
      crust_id: string | null;
      notes: string | null;
    }>;
  };
};

export type LabFoodCheckoutReceipt = {
  order_id: string;
  order_number?: number;
  tracking_token: string;
  total: number;
};

function fail(message: string): never { throw new LabApiError(400, message); }
function moneyCents(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 999999.99) fail('Preço inválido no carrinho.');
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 0.00001) fail('Preço precisa ter centavos exatos.');
  return cents;
}

export function prepareLabFoodCheckout(input: LabFoodOrderInput): LabPreparedFoodCheckout {
  if (typeof crypto?.randomUUID !== 'function') fail('Identidade de checkout indisponível.');
  if (!UUID.test(input.instance_id) || !UUID.test(input.organization_id)) fail('Loja LAB inválida.');
  // Domain must match the current Access-admitted origin. The database and Worker
  // also independently verify domain, instance and organization.
  if (typeof window === 'undefined' || window.location.protocol !== 'https:' ||
      input.store_domain !== window.location.hostname) fail('Origem privada LAB inválida.');
  const name = input.customer_name.trim();
  const phone = input.customer_phone.replace(/[^0-9]/g, '');
  if (name.length < 2 || name.length > 120 || !/^[0-9]{10,15}$/.test(phone))
    fail('Nome ou telefone inválido.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 40)
    fail('O carrinho deve ter entre 1 e 40 itens.');
  let totalCents = 0;
  const items = input.items.map((line:FoodCartLine) => {
    if (!UUID.test(line.productId) || !Number.isInteger(line.quantity) ||
        line.quantity < 1 || line.quantity > 10) fail('Produto ou quantidade inválida.');
    // Explicitly fail until the approved backend supports these contracts.
    if (line.isHalf || line.secondProductId || (line.complements?.length ?? 0) > 0)
      fail('Meia pizza e complementos ainda não foram admitidos neste LAB.');
    const addons = (line.addons ?? []).map(x => x.id);
    if (addons.length > 50 || addons.some(x => !UUID.test(x)) || new Set(addons).size !== addons.length)
      fail('Adicionais inválidos para o contrato privado.');
    if ((line.sizeId && line.sizeId.length > 64) || (line.crustId && line.crustId.length > 64))
      fail('Opção de produto inválida.');
    const notes = line.notes?.trim() || null;
    if (notes && notes.length > 500) fail('Observações extensas demais.');
    const cents = moneyCents(line.unitPrice);
    totalCents += cents * line.quantity;
    if (!Number.isSafeInteger(totalCents)) fail('Total inválido.');
    return {
      product_id: line.productId,
      selection_contract: 'GROUP_ADDONS_V1' as const,
      quantity: line.quantity,
      expected_unit_price: cents / 100,
      group_addon_ids: addons,
      size_id: line.sizeId || null,
      crust_id: line.crustId || null,
      notes,
    };
  });
  // Client numbers are acknowledgements only; SQL recomputes every price.
  return { p_order: {
    instance_id: input.instance_id,
    organization_id: input.organization_id,
    store_domain: input.store_domain,
    idempotency_key: crypto.randomUUID(),
    client_cart_reference: nonceHex(),
    customer_name: name,
    customer_phone: phone,
    fulfillment: 'PICKUP',
    payment_method: 'CASH',
    expected_total: totalCents / 100,
    items,
  }};
}

/** Submit a previously PREPARED request. Caller retains it across transport failures. */
export async function checkoutLabFoodCart(prepared: LabPreparedFoodCheckout): Promise<LabFoodCheckoutReceipt> {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:' ||
      window.location.hostname !== prepared?.p_order?.store_domain ||
      !UUID.test(prepared?.p_order?.idempotency_key ?? ''))
    throw new LabApiError(503, 'Sessão privada ou chave de checkout inválida.');
  let response: Response;
  try {
    response = await fetch(new URL('/__neroxa_lab/checkout', window.location.origin), {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Neroxa-Lab-Nonce': nonceHex() },
      body: JSON.stringify(prepared),
    });
  } catch {
    throw new LabApiError(503, 'Confirmação incerta: consulte o pedido antes de reenviar a mesma chave.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new LabApiError(response.status,
    response.status === 409 ? 'Pedido possivelmente registrado. Não gere nova chave.' :
    'Checkout privado indisponível ou negado.');
  const r = body as Partial<LabFoodCheckoutReceipt> | null;
  const total = Number(r?.total);
  const orderNumber = r?.order_number === undefined ? undefined : Number(r.order_number);
  if (response.headers.get('x-neroxa-lab-project') !== 'gomexvhvecvvfbdzhjct' ||
      !UUID.test(response.headers.get('x-neroxa-lab-version') || '') ||
      !r || !UUID.test(String(r.order_id || '')) || !SECRET.test(String(r.tracking_token || '')) ||
      !Number.isFinite(total) || total !== prepared.p_order.expected_total ||
      (orderNumber !== undefined && (!Number.isInteger(orderNumber) || orderNumber < 1)))
    throw new LabApiError(502, 'Resposta fora do contrato LAB, não confirme pedido ao cliente.');
  return { order_id: r.order_id!, tracking_token: r.tracking_token!, total, ...(orderNumber===undefined?{}:{order_number:orderNumber}) };
}
