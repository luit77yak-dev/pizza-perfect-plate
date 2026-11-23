/* NEROXA LAB SECURITY HTTP PREP — read the README before use.
 * Defines a function; NEVER initiates network requests on load.
 * Intended for manually inspected execution in an authenticated Access browser
 * during a separately authorized LAB window. No secret leaves the browser.
 */
(function (root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const TOKEN = /^[A-Za-z0-9_-]{43}$/;
  const ROUTE_LIST = '/__neroxa_lab/order-list';
  const ROUTE_CATALOG = '/__neroxa_lab/catalog';
  const ACTIONS = Object.freeze([
    'Active LAB A grant: positive order-list control (200)',
    'Active LAB A grant against LAB B: cross-instance denial (403)',
    'Previously revoked LAB A grant: database authorization denial (403/42501)',
    'Missing operator bearer: Worker denial (401)',
    'Fresh catalog nonce: positive control (200)',
    'Same catalog nonce: replay denial (409)'
  ]);

  function hexNonce(cryptoObj) {
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') throw Error('Secure crypto unavailable');
    const value = cryptoObj.getRandomValues(new Uint8Array(32));
    return Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Internal password-input overlay. No prompt(), localStorage, logs or clipboard.
  function readPassword(label) {
    return new Promise((resolve, reject) => {
      if (!root.document || !root.document.body) return reject(Error('Protected input UI unavailable'));
      const overlay = root.document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#111e;display:flex;align-items:center;justify-content:center';
      const form = root.document.createElement('form');
      form.style.cssText = 'font:16px sans-serif;background:#fff;color:#111;padding:24px;max-width:420px;width:90%;border-radius:10px';
      const heading = root.document.createElement('p');
      heading.textContent = label + ' — enter privately; never paste in chat or DevTools command';
      const input = root.document.createElement('input');
      input.type = 'password'; input.autocomplete = 'off'; input.required = true;
      input.style.cssText = 'width:100%;box-sizing:border-box;padding:10px';
      const submit = root.document.createElement('button');
      submit.type = 'submit'; submit.textContent = 'Use once';
      const cancel = root.document.createElement('button');
      cancel.type = 'button'; cancel.textContent = 'Cancel';
      form.append(heading, input, submit, cancel); overlay.append(form); root.document.body.append(overlay);
      const clear = () => { input.value = ''; overlay.remove(); };
      cancel.addEventListener('click', () => { clear(); reject(Error('Operator cancelled protected input')); }, {once:true});
      form.addEventListener('submit', event => {
        event.preventDefault(); const value = input.value;
        clear(); resolve(value);
      }, {once:true});
      input.focus();
    });
  }

  function validate(config, runtime) {
    if (!config || typeof config !== 'object') throw Error('Missing LAB window configuration');
    if (config.execute !== true) return false;
    if (config.approval !== 'LAB-SECURITY-HTTP-APPROVED') throw Error('Separate live approval gate missing');
    const loc = runtime.location;
    if (!loc || loc.protocol !== 'https:' || !loc.hostname || !loc.origin) throw Error('HTTPS browser context required');
    if (!loc.hostname.endsWith('.workers.dev') || loc.hostname !== config.expectedHost || loc.hostname === 'unconfigured.invalid')
      throw Error('Protected LAB hostname mismatch');
    if (!UUID.test(config.instanceA || '') || !UUID.test(config.instanceB || '') || config.instanceA === config.instanceB)
      throw Error('Distinct LAB A/B instance UUIDs required');
    const now = runtime.now();
    const stop = Date.parse(config.approvedUntil);
    if (!Number.isFinite(stop) || stop <= now || stop - now > 15 * 60000)
      throw Error('Specific active window of <= 15 minutes required');
    return true;
  }

  async function run(config = {}, testIo = undefined) {
    // Without explicit execute, this is a NO-NETWORK plan and needs no browser credentials.
    if (config.execute !== true) return {state:'DRY_RUN',network:'NONE',cases:ACTIONS.slice(),jwtInvalid:'NOT_RUN_SEPARATE_GATED_TEST'};
    const runtime = {
      location: root.location,
      now: () => Date.now(),
      crypto: root.crypto,
      fetch: root.fetch && root.fetch.bind(root),
      confirm: root.confirm && root.confirm.bind(root),
      readSecret: readPassword,
      ...(testIo || {})
    };
    validate(config, runtime);
    if (typeof runtime.fetch !== 'function' || typeof runtime.confirm !== 'function') throw Error('Browser runtime unavailable');
    if (!runtime.confirm('NEROXA LAB private test: six bounded POSTs; five new nonces; SQL nonce claims. Separate LAB authorization required. Continue?'))
      throw Error('User declined private LAB window');
    const active = await runtime.readSecret('ACTIVE LAB A operator grant (43 characters)');
    const revoked = await runtime.readSecret('REVOKED LAB A operator grant (43 characters)');
    if (!TOKEN.test(active || '') || !TOKEN.test(revoked || '') || active === revoked)
      throw Error('Active and revoked grants are required, distinct and well-formed');
    const deadline = Date.parse(config.approvedUntil);
    const results = [];
    const orderBody = instance_id => ({instance_id, limit:1});
    async function post(route, payload, bearer, nonce) {
      if (runtime.now() >= deadline) throw Error('LAB window expired; stopping');
      // Refuse any redirection to Access login or any other destination.
      const headers = {'content-type':'application/json','x-neroxa-lab-nonce':nonce};
      if (bearer) headers.authorization = 'Bearer ' + bearer;
      const response = await runtime.fetch(runtime.location.origin + route, {
        method:'POST', headers, body:JSON.stringify(payload),
        credentials:'same-origin', redirect:'manual', cache:'no-store', signal:undefined
      });
      if (response.redirected || response.type === 'opaqueredirect' || response.status === 0)
        throw Error('Access challenge or redirect: NOT VERIFIED as Worker negative');
      if (!response.headers || !/application\/json/i.test(response.headers.get('content-type') || '') ||
          (response.headers.get('x-content-type-options') || '').toLowerCase() !== 'nosniff')
        throw Error('Non-Worker JSON/headers; result inconclusive');
      let result;
      try { result = await response.json(); } catch { throw Error('Invalid JSON response; result inconclusive'); }
      if (!result || typeof result !== 'object') throw Error('Invalid Worker JSON envelope');
      return {status:response.status, result};
    }
    function assert(label, actual, expected, condition) {
      if (actual.status !== expected || !condition(actual.result))
        throw Error(label + ' INCONCLUSIVE/FAIL (HTTP ' + actual.status + ', expected ' + expected + ')');
      results.push({test:label, http_status:actual.status, verified:true});
    }
    // The positive list is necessary to show the supplied A grant is usable before cross-tenant testing.
    const positiveA = await post(ROUTE_LIST,orderBody(config.instanceA),active,hexNonce(runtime.crypto));
    assert('active_A_positive',positiveA,200,x=>x.lab===true && Object.prototype.hasOwnProperty.call(x,'orders'));
    const crossB = await post(ROUTE_LIST,orderBody(config.instanceB),active,hexNonce(runtime.crypto));
    assert('A_to_B_denied',crossB,403,x=>x.error==='LAB instance denied');
    const revokedA = await post(ROUTE_LIST,orderBody(config.instanceA),revoked,hexNonce(runtime.crypto));
    assert('revoked_A_denied',revokedA,403,x=>x.error==='LAB operation denied or unavailable' && x.sqlstate==='42501');
    const noBearer = await post(ROUTE_LIST,orderBody(config.instanceA),null,hexNonce(runtime.crypto));
    assert('missing_operator_denied',noBearer,401,x=>x.error==='Operational authorization required');
    const replayNonce = hexNonce(runtime.crypto);
    const catalogRequest = {domain:runtime.location.hostname};
    const catalogPositive = await post(ROUTE_CATALOG,catalogRequest,null,replayNonce);
    assert('catalog_nonce_positive',catalogPositive,200,x=>x.lab===true && Object.prototype.hasOwnProperty.call(x,'catalog'));
    const catalogReplay = await post(ROUTE_CATALOG,catalogRequest,null,replayNonce);
    assert('catalog_nonce_replay_denied',catalogReplay,409,x=>x.error==='LAB nonce already consumed');
    // Deliberately no JWT forgery/injection or claims of verifying Cloudflare edge behavior.
    return {state:'HTTP_NEGATIVES_PASS_WITH_LIMITS',cases:results,jwtInvalid:'NOT_RUN_SEPARATE_GATED_TEST',
      revokedEvidence:'SQL_REVOCATION_READBACK_REQUIRED',crossInstanceEvidence:'LAB_A_TO_B_HTTP_DENIAL',
      secretLogged:false,deploy:'NONE'};
  }
  root.neroxaLabSecurityHTTP = run;
})(typeof globalThis !== 'undefined' ? globalThis : this);
