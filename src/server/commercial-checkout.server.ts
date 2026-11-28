import { createHash, createHmac, randomBytes } from 'node:crypto';
import { handleCheckoutRequest, CheckoutPriceChangedError, CheckoutRateLimitError,
  CheckoutStoreClosedError, CheckoutRecoveryExpiredError, type CheckoutDependencies,
  type StoreContext, type OrderResult } from './checkout-gateway.ts';
if (typeof window !== 'undefined') throw new Error('Server-only commercial module');

// Server-only composition port. No credentials/env/client or connection is created
// by importing this module. Public /api/checkout remains the closed adapter.
export const COMMERCIAL_CONTRACT = 'GO02_COMMERCIAL_CHECKOUT_V1';
export type CommercialSqlClient = {
  query: (sql: string, values: unknown[]) => Promise<{rows: Record<string, unknown>[]} >;
  release: () => void | Promise<void>;
};
export type CommercialCheckoutPorts = {
  allowedDomains: readonly string[];
  connect: () => Promise<CommercialSqlClient>;
  // Trusted server composition: validates the opaque Cloudflare admission session
  // (signature, pinned version/artifact, expiry and already claimed durable nonce).
  // No boolean flag from the browser or env substitutes this callback.
  assertAdmission: () => void | Promise<void>;
  quotaSecret: string;
};
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function mapped(error: unknown): never {
  const code = (error as {code?: string})?.code;
  if (code === 'PT409') throw new CheckoutPriceChangedError();
  if (code === 'PT429') throw new CheckoutRateLimitError();
  if (code === 'PT423') throw new CheckoutStoreClosedError();
  if (code === 'PT410') throw new CheckoutRecoveryExpiredError();
  throw new Error('Commercial checkout unavailable');
}

/** Bind exclusively to commercial SQL units 01–33 plus the local GO02 extension.
 * No test/R14 schema, arbitrary RPC name or client-selectable SQL is accepted.
 */
export function commercialCheckoutDependencies(ports: CommercialCheckoutPorts): CheckoutDependencies {
  const domains = Object.freeze([...(ports?.allowedDomains ?? [])]);
  async function sql(statement: string, values: unknown[]) {
    if (!ports || typeof ports.assertAdmission !== 'function' ||
        typeof ports.connect !== 'function' || typeof ports.quotaSecret !== 'string' ||
        Buffer.byteLength(ports.quotaSecret) < 32) throw new Error('Commercial admission absent');
    await ports.assertAdmission();
    const client = await ports.connect();
    try {
      await ports.assertAdmission();
      const readiness = await client.query('SELECT public.neroxa_go02_checkout_contract() AS contract', []);
      if (readiness.rows.length !== 1 || readiness.rows[0]?.["contract"] !== COMMERCIAL_CONTRACT) throw new Error('Commercial SQL extension absent');
      await ports.assertAdmission();
      const result = await client.query(statement, values);
      await ports.assertAdmission();
      return result;
    } catch (e) { mapped(e); }
    finally { await client.release(); }
  }
  return {
    enabled: true, // Candidate factory only. NOT imported or enabled by public route.
    requiresDurableIntent: true,
    async resolveContext(domain): Promise<StoreContext | null> {
      if (!domains.includes(domain)) return null;
      const r = await sql('SELECT domain, instance_id, organization_id FROM public.get_public_storefront_context($1)', [domain]);
      if (r.rows.length !== 1) return null;
      const x = r.rows[0];
      if (!x) return null;
      if (x["domain"] !== domain || !uuid(x["instance_id"]) || !uuid(x["organization_id"])) return null;
      return {domain,instance_id:x["instance_id"],organization_id:x["organization_id"]};
    },
    async reserveQuota(context, phone) {
      if (!domains.includes(context.domain)) throw new Error('Commercial domain not admitted');
      const fingerprint = createHmac('sha256',ports.quotaSecret).update(context.instance_id+':'+phone.replace(/[^0-9]/g,'')).digest('hex');
      const r = await sql('SELECT public.neroxa_checkout_reserve_quota($1::uuid, $2) AS reserved', [context.instance_id,fingerprint]);
      if (r.rows.length !== 1 || typeof r.rows[0]?.["reserved"] !== 'boolean') throw new Error('Quota response invalid');
      if (r.rows[0]["reserved"] === false) throw new CheckoutRateLimitError();
    },
    async createOrder(payload): Promise<OrderResult> {
      if (!domains.includes(String(payload['store_domain']))) throw new Error('Commercial domain not admitted');
      const tracking = randomBytes(32).toString('base64url');
      const amendment = randomBytes(32).toString('base64url');
      // One PostgreSQL function owns pricing, idempotency, order and BOTH hashes.
      // Tokens never enter SQL, logs or durable storage; only their hashes do.
      const r = await sql('SELECT * FROM public.neroxa_commercial_checkout_atomic($1::jsonb, $2, $3)',
        [JSON.stringify(payload),hash(tracking),hash(amendment)]);
      if (r.rows.length !== 1 || typeof r.rows[0]?.["capabilities_issued"] !== 'boolean') throw new Error('Invalid commercial result');
      const row = r.rows[0];
      if (!row) throw new Error("Invalid commercial result");
      const number = Number(row["order_number"]), total = Number(row["total"]);
      if (!uuid(row["order_id"]) || !Number.isSafeInteger(number) || number < 1 || !Number.isFinite(total) || total < 0) throw new Error('Invalid commercial result');
      return {order_id:row["order_id"],order_number:number,total,
        ...(row["capabilities_issued"] ? {tracking_token:tracking,amendment_token:amendment} : {})};
    },
  };
}

/** Explicit preparation seam; the public route is intentionally NOT rewired. */
export function handlePreparedCommercialCheckout(request: Request, ports: CommercialCheckoutPorts) {
  return handleCheckoutRequest(request, commercialCheckoutDependencies(ports));
}
