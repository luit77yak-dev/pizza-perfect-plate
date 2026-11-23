import { Client } from 'pg';
import type { CommercialCheckoutPorts } from './commercial-checkout.server.ts';
if (typeof window !== 'undefined') throw new Error('Server-only commercial module');

/** Only the trusted Worker composition may pass the commercial HYPERDRIVE binding.
 * No binding lookup, credential read, socket or SQL occurs at module import.
 * The public route never imports this module. No URL/env/headers fallback.
 */
export function commercialHyperdrivePorts(input: {
  allowedDomains: readonly string[];
  hyperdrive: {connectionString: string};
  assertAdmission: () => void | Promise<void>;
  quotaSecret: string;
}): CommercialCheckoutPorts {
  return {
    allowedDomains:Object.freeze([...input.allowedDomains]),
    quotaSecret: input.quotaSecret,
    assertAdmission: input.assertAdmission,
    async connect() {
      await input.assertAdmission();
      const client = new Client({connectionString: input.hyperdrive.connectionString,
        connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000,
        application_name:'neroxa-go02-commercial-candidate'});
      try { await client.connect(); }
      catch { await client.end().catch(()=>{}); throw new Error('Commercial database unavailable'); }
      return {
        async query(sql, values) {
          await input.assertAdmission();
          const r = await client.query(sql, values);
          return {rows:r.rows as Record<string,unknown>[]};
        },
        async release() { await client.end(); },
      };
    },
  };
}
