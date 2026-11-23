/**
 * Adapter for the already-proven private LAB Worker endpoints.
 * Nothing here enables a public checkout or uses the legacy Supabase admin RPCs.
 * Install on the same HTTPS origin as the privately admitted LAB Worker + Assets.
 * The Access assertion is added by the Access edge, not collected by this browser code.
 */
export const PRIVATE_LAB_ROUTES = {
  state: '/__neroxa_lab/order-state',
  transition: '/__neroxa_lab/order-transition',
  list: '/__neroxa_lab/order-list',
  checkout: '/__neroxa_lab/checkout',
} as const;

export type LabStatus =
  | 'RECEIVED' | 'CONFIRMED' | 'PREPARING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type LabFulfillment = 'PICKUP' | 'DELIVERY';
export type LabHistoryEntry = {
  from_status: string | null;
  to_status: LabStatus;
  changed_at: string;
};
export type LabOrderState = {
  id?: string;
  order_id?: string;
  instance_id?: string;
  order_number?: number | string;
  status: LabStatus;
  fulfillment?: LabFulfillment;
  total?: number | string;
  history: LabHistoryEntry[];
};

export type OrderIdentity = { instance_id: string; order_id: string };
export type TrackingInput = OrderIdentity & { tracking_token: string };
export type TransitionInput = OrderIdentity & {
  operator_token: string;
  expected_status: LabStatus;
  next_status: LabStatus;
  operation_id: string;
};

type StateResponse = { state: LabOrderState; lab: true };
type TransitionResponse = { operation: { status: LabStatus; replayed?: boolean }; lab: true };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const STATUS = new Set<LabStatus>(['RECEIVED','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED']);

export class LabApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'LabApiError'; }
}

function identity(v: OrderIdentity) {
  if (!UUID.test(v.instance_id) || !UUID.test(v.order_id)) throw new LabApiError(400, 'IDs de loja/pedido inválidos.');
}

export function allowedNext(status: LabStatus, fulfillment?: LabFulfillment): LabStatus[] {
  switch (status) {
    case 'RECEIVED': return ['CONFIRMED'];
    case 'CONFIRMED': return ['PREPARING'];
    case 'PREPARING': return ['READY'];
    case 'READY': return fulfillment === 'DELIVERY' ? ['OUT_FOR_DELIVERY'] : fulfillment === 'PICKUP' ? ['DELIVERED'] : [];
    case 'OUT_FOR_DELIVERY': return ['DELIVERED'];
    default: return [];
  }
}

export function nonceHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}

// A new nonce is compulsory for EVERY call; never retry a consumed nonce.
async function postPrivate<T>(path: string, payload: object, bearer?: string): Promise<T> {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    throw new LabApiError(503, 'A API LAB exige uma sessão HTTPS privada.');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Neroxa-Lab-Nonce': nonceHex(),
  };
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  let res: Response;
  try {
    res = await fetch(new URL(path, window.location.origin), {
      method: 'POST', headers, credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', body: JSON.stringify(payload),
    });
  } catch { throw new LabApiError(503, 'Não foi possível acessar a API privada do LAB.'); }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = res.status === 401 ? 'Sessão privada ou autorização operacional ausente.'
      : res.status === 403 ? 'Acesso negado para esta loja ou pedido.'
      : res.status === 409 ? 'Estado já alterado ou requisição repetida. Atualize o pedido.'
      : res.status === 422 ? 'Transição não permitida para esse pedido.'
      : res.status === 503 ? 'Janela privada LAB indisponível ou encerrada.'
      : 'Não foi possível processar a requisição LAB.';
    throw new LabApiError(res.status, message);
  }
  if (!data || typeof data !== 'object' || !('lab' in data) || data.lab !== true) {
    throw new LabApiError(502, 'Resposta fora do contrato LAB.');
  }
  return data as T;
}

export async function getLabOrderState(v: TrackingInput): Promise<LabOrderState> {
  identity(v);
  if (!SECRET.test(v.tracking_token)) throw new LabApiError(400, 'Capability de acompanhamento inválida.');
  const r = await postPrivate<StateResponse>(PRIVATE_LAB_ROUTES.state, v);
  if (!r.state || !STATUS.has(r.state.status) || !Array.isArray(r.state.history)) {
    throw new LabApiError(502, 'Estado recebido fora do contrato LAB.');
  }
  return r.state;
}

export async function transitionLabOrder(v: TransitionInput): Promise<{ status: LabStatus; replayed: boolean }> {
  identity(v);
  const validTransitions: Record<LabStatus, LabStatus[]> = {
    RECEIVED: ['CONFIRMED'], CONFIRMED: ['PREPARING'], PREPARING: ['READY'],
    READY: ['DELIVERED', 'OUT_FOR_DELIVERY'], OUT_FOR_DELIVERY: ['DELIVERED'], DELIVERED: [],
  };
  if (!SECRET.test(v.operator_token) || !UUID.test(v.operation_id) ||
      !validTransitions[v.expected_status]?.includes(v.next_status)) {
    throw new LabApiError(400, 'Autorização ou transição inválida.');
  }
  const { operator_token, ...payload } = v;
  const r = await postPrivate<TransitionResponse>(PRIVATE_LAB_ROUTES.transition, payload, operator_token);
  if (!r.operation || !STATUS.has(r.operation.status)) throw new LabApiError(502, 'Confirmação fora do contrato LAB.');
  return { status: r.operation.status, replayed: Boolean(r.operation.replayed) };
}


export type LabListedItem = { product_name: string; quantity: number; line_total: number | string };
export type LabListedOrder = {
  id: string;
  instance_id: string;
  order_number: number | string;
  customer_name: string;
  status: LabStatus;
  fulfillment: LabFulfillment;
  total: number | string;
  created_at: string;
  items: LabListedItem[];
};

export async function listLabOrders(input: {
  instance_id: string;
  operator_token: string;
  limit?: number;
}): Promise<LabListedOrder[]> {
  if (!UUID.test(input.instance_id) || !SECRET.test(input.operator_token))
    throw new LabApiError(400, 'Loja ou autorização operacional inválida.');
  const limit = input.limit ?? 30;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new LabApiError(400, 'Limite de listagem inválido.');
  const r = await postPrivate<{lab:true;orders:unknown}>(PRIVATE_LAB_ROUTES.list,
    {instance_id:input.instance_id,limit},input.operator_token);
  if (!Array.isArray(r.orders) || r.orders.some((v:unknown) => {
    if (!v || typeof v !== 'object') return true;
    const o=v as Partial<LabListedOrder>;
    return !UUID.test(String(o.id)) || o.instance_id!==input.instance_id ||
      !STATUS.has(o.status as LabStatus) ||
      (o.fulfillment!=='PICKUP' && o.fulfillment!=='DELIVERY') ||
      !Array.isArray(o.items);
  })) throw new LabApiError(502, 'Listagem fora do contrato privado do LAB.');
  return r.orders as LabListedOrder[];
}


/**
 * LAB-only checkout via the EXACT GROUP_ADDONS_V1 candidate already proven in
 * LAB_CHECKOUT_E2E. This one-item fixture is not the production Food cart.
 * Caller must preserve input.idempotency_key across explicit retries and
 * must not automatically issue a new checkout after an uncertain response.
 */
export type LabCheckoutInput = {
  p_order: {
    idempotency_key: string;
    customer_name: string;
    customer_phone: string;
    fulfillment: 'PICKUP';
    payment_method: 'CASH';
    expected_total: 10;
    client_cart_reference: string;
    items: Array<{
      product_id: string;
      selection_contract: 'GROUP_ADDONS_V1';
      quantity: 1;
      expected_unit_price: 10;
      group_addon_ids: string[];
    }>;
  };
};
export type LabCheckoutResult = {
  order_id: string;
  tracking_token: string;
  total: number;
};

export const LAB_FICTITIOUS_PICKUP = {
  instance_id: '7e020000-0000-4000-8000-000000000001',
  product_id: '7e040000-0000-4000-8000-000000000001',
  price: 10,
} as const;

export function prepareLabFixtureCheckout(customer_name: string, customer_phone: string): LabCheckoutInput {
  const name=customer_name.trim(),phone=customer_phone.trim();
  if(name.length<2 || name.length>120 || !/^\d{8,15}$/.test(phone))
    throw new LabApiError(400,'Informe nome e telefone fictícios válidos.');
  return {p_order:{
    idempotency_key:crypto.randomUUID(),
    customer_name:name, customer_phone:phone,
    fulfillment:'PICKUP', payment_method:'CASH', expected_total:10,
    client_cart_reference:nonceHex(),
    items:[{product_id:LAB_FICTITIOUS_PICKUP.product_id,selection_contract:'GROUP_ADDONS_V1',quantity:1,
      expected_unit_price:10,group_addon_ids:[]}],
  }};
}

export async function checkoutLabFixture(input: LabCheckoutInput): Promise<LabCheckoutResult> {
  const order=input?.p_order;
  const first=order?.items?.[0];
  if(!order || !UUID.test(order.idempotency_key) || (!first || !UUID.test(first.product_id)) ||
     order.items?.length!==1 || first.selection_contract!=='GROUP_ADDONS_V1' ||
     first.quantity!==1 || first.expected_unit_price!==10 ||
     order.expected_total!==10 || order.fulfillment!=='PICKUP' || order.payment_method!=='CASH' ||
     !/^[0-9a-f]{64}$/.test(order.client_cart_reference))
    throw new LabApiError(400,'Checkout privado LAB fora da fixture aprovada.');
  if(typeof window==='undefined' || window.location.protocol!=='https:')
    throw new LabApiError(503,'Checkout LAB exige sessão privada HTTPS.');
  let res:Response;
  try{
    res=await fetch(new URL(PRIVATE_LAB_ROUTES.checkout,window.location.origin),{
      method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{'Content-Type':'application/json','X-Neroxa-Lab-Nonce':nonceHex()},
      body:JSON.stringify(input),
    });
  }catch{throw new LabApiError(503,'Não foi possível confirmar o checkout privado LAB. Preserve a chave e reconsulte antes de repetir.');}
  const data:unknown=await res.json().catch(()=>null);
  if(!res.ok) throw new LabApiError(res.status,res.status===409?'Pedido possivelmente já registrado. Não crie outra chave.':
    'Checkout privado LAB indisponível ou negado.');
  const o=data as Partial<LabCheckoutResult>|null;
  if(res.headers.get('x-neroxa-lab-project')!=='gomexvhvecvvfbdzhjct' ||
     !UUID.test(res.headers.get('x-neroxa-lab-version')||'') ||
     !o || !UUID.test(String(o.order_id)) || !SECRET.test(String(o.tracking_token)) ||
     o.total!==10)
    throw new LabApiError(502,'A resposta de checkout não confirmou o contrato privado LAB.');
  return {order_id:o.order_id!,tracking_token:o.tracking_token!,total:o.total!};
}
