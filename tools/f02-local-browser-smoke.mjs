// NEROXA F02 — preview local sintético. Não usa Supabase hospedado nem faz deploy.
import { createServer } from 'node:http';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const branch = 'security/f02-frontend-containment-20261104';
const api = 'http://127.0.0.1:8777';
const site = 'http://127.0.0.1:4173';
const remote = 'https://iefaoaqzltvpfabyeelj.supabase.co';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
if (git('branch', '--show-current') !== branch) throw Error('Branch F02 incorreta.');
if (git('status', '--porcelain')) throw Error('Git deve estar limpo. Não descarte alterações locais.');
if (JSON.parse(readFileSync(join(root, 'vercel.json'))).git?.deploymentEnabled?.[branch] !== false) throw Error('Vercel não está bloqueada.');
const tmp = mkdtempSync(join(tmpdir(), 'neroxa-f02-local-'));
const work = join(tmp, 'work');
const ledger = { catalog_reads: 0, blocked_requests: 0 };
let created = false, preview, mock, stopped = false;
function replaceOnce(rel, from, to) {
  const file = join(work, rel);
  const original = readFileSync(file, 'utf8');
  if (original.split(from).length !== 2) throw Error('Fonte inesperada: ' + rel);
  writeFileSync(file, original.replace(from, to));
}
function stop() {
  if (stopped) return;
  stopped = true;
  if (preview) preview.kill('SIGTERM');
  if (mock) mock.close();
  console.log('RECIBO_F02_LOCAL=' + JSON.stringify({ sha, ...ledger }));
  try { if (created) git('worktree', 'remove', '--force', work); }
  catch (e) { console.error('Revise a worktree temporária:', work, String(e)); }
  rmSync(tmp, { force: true, recursive: true });
}
const id = n => String(n).repeat(8) + '-' + String(n).repeat(4) + '-4' + String(n).repeat(3) + '-8' + String(n).repeat(3) + '-' + String(n).repeat(12);
const org = id(3), inst = id(4);
const fixture = {
  context: { domain: 'food.neroxa.ia.br', instance_id: inst, instance_slug: 'fixture',
    instance_name: 'Loja fictícia', instance_status: 'ACTIVE', organization_id: org,
    organization_name: 'NEROXA — LOJA FICTÍCIA', system_id: null, system_slug: null,
    system_name: null, system_type: null },
  categories: [{ id: id(1), name: 'Pizzas sintéticas', slug: 'teste', sort_order: 1,
    active: true, image_url: null }],
  products: [{ id: id(2), category_id: id(1), name: 'Produto FICTÍCIO de teste',
    slug: 'teste', description: 'Nenhum pedido real será feito.', price: 10,
    active: true, sort_order: 1, image_url: null,
    metadata: { kind: 'SIMPLE', featured: true, available: true } }],
  settings: { hero_title: 'AMBIENTE FICTÍCIO', delivery_enabled: false,
    pickup_enabled: true, payment_methods: ['PIX'], hero_image_url: null },
  delivery_zones: [],
};
try {
  git('worktree', 'add', '--detach', work, sha);
  created = true;
  symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'), 'dir');
  for (const path of ['src/integrations/storefront-backend/client.ts', 'src/integrations/supabase/client.ts']) {
    replaceOnce(path, remote, api);
    replaceOnce(path, 'return fetch(input, { ...init, headers });',
      "const target = new URL(typeof input === 'string' ? input : input instanceof Request ? input.url : String(input));\n" +
      "      if (target.origin !== '" + api + "') throw new Error('F02 BLOCKED nonlocal RPC');\n" +
      '      return fetch(input, { ...init, headers });');
  }
  // Horários sintéticos somente na cópia: o código de produto ainda retorna [] e fecha a loja.
  replaceOnce('src/features/storefront/services/load-store.ts',
    'hours: [], specialHours: [], deliveryZones,',
    "hours: Array.from({length: 7}, (_, weekday) => ({id: 'fixture-'+weekday, organization_id: context.organization_id, weekday, opens_at: '00:00', closes_at: '23:59', closed: false})) as never[], specialHours: [], deliveryZones,");
  // O CSP bloqueia conexões, recursos e formulários externos no navegador.
  const policy = ["default-src 'self' data: blob:", "connect-src 'self' " + api,
    "img-src 'self' data: blob:", "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:", "object-src 'none'", "form-action 'none'"].join('; ');
  replaceOnce('src/routes/__root.tsx', '<head>\n        <HeadContent />',
    '<head>\n        <meta httpEquiv="Content-Security-Policy" content={' + JSON.stringify(policy) + '} />\n        <HeadContent />');
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(VITE_|SUPABASE_|NEROXA_|PUBLIC_)/.test(k)) delete env[k];
  env.SUPABASE_URL = env.VITE_SUPABASE_URL = api;
  env.SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture_only';
  mock = createServer(async (req, res) => {
    const route = new URL(req.url ?? '/', api).pathname;
    const headers = { 'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': site, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, prefer',
      'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
    if (req.method === 'GET' && route === '/__health') {
      res.writeHead(200, headers); res.end(JSON.stringify({ sha, ...ledger })); return;
    }
    if (req.method === 'POST' && route === '/rest/v1/rpc/get_public_storefront_catalog') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 16000) break; }
      try {
        if (JSON.parse(body).p_domain === 'food.neroxa.ia.br') {
          ledger.catalog_reads++;
          res.writeHead(200, headers); res.end(JSON.stringify(fixture)); return;
        }
      } catch { /* fail closed */ }
    }
    ledger.blocked_requests++;
    console.error('F02_LOCAL_BLOCKED', req.method, route);
    res.writeHead(403, headers); res.end(JSON.stringify({ error: 'LOCAL_FIXTURE_BLOCKED' }));
  });
  await new Promise((ok, fail) => { mock.once('error', fail); mock.listen(8777, '127.0.0.1', ok); });
  const vite = join(work, 'node_modules', 'vite', 'bin', 'vite.js');
  console.log('Compilando cópia temporária sem backend real... SHA=' + sha);
  const result = spawnSync(process.execPath, [vite, 'build'], { cwd: work, env, stdio: 'inherit' });
  if (result.status !== 0) throw Error('Build sintético falhou: ' + (result.status ?? result.error));
  console.log('ABRA NO CHROME DO MESMO CELULAR: ' + site);
  console.log('PAINEL BLOQUEADO: ' + site + '/painel');
  console.log('RECIBO NO NAVEGADOR: ' + api + '/__health');
  console.log('Ctrl+C encerra e apaga somente a cópia temporária.');
  preview = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: work, env, stdio: 'inherit' });
  process.once('SIGINT', () => { stop(); process.exit(0); });
  process.once('SIGTERM', () => { stop(); process.exit(0); });
  preview.once('exit', (code) => { console.log('Preview saiu:', code); stop(); });
} catch (error) {
  console.error('F02_LOCAL_BLOCKED:', error.message ?? error);
  stop(); process.exitCode = 1;
}
