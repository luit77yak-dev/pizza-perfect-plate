// NEROXA — compara ESLint da branch F02 com a base congelada.
// Leitura de arquivos Git e lintText em memória. Nunca usa --fix.
// Se o clone for raso, baixa EXCLUSIVAMENTE o commit público da base.
import { ESLint } from "eslint";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseSha = "bff5bee289cd4e911a5be012cb7b8731e48e82fd";
const branch = "security/f02-frontend-containment-20261104";
const paths = [
  "src/components/storefront/Storefront.tsx",
  "src/features/storefront/components/CheckoutPanel.tsx",
  "src/routes/painel.tsx",
  "src/routes/admin/pedidos.tsx",
];
const gitRaw = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const git = (...args) => gitRaw(...args).trim();
function hasCommit(sha) {
  try {
    git("cat-file", "-e", sha + "^{commit}");
    return true;
  } catch {
    return false;
  }
}
function summarize(result) {
  const rules = {};
  for (const m of result.messages) {
    const name = m.ruleId ?? "unknown";
    const item = rules[name] ?? { errors: 0, warnings: 0 };
    if (m.severity === 2) item.errors++;
    if (m.severity === 1) item.warnings++;
    rules[name] = item;
  }
  const prettier = rules["prettier/prettier"]?.errors ?? 0;
  return {
    errors: result.errorCount,
    warnings: result.warningCount,
    prettierErrors: prettier,
    otherErrors: result.errorCount - prettier,
    rules,
  };
}
try {
  if (git("branch", "--show-current") !== branch)
    throw Error("Branch incorreta: somente o candidato F02 pode ser inspecionado.");
  if (git("status", "--porcelain"))
    throw Error("Clone com mudanças locais; não alterar nem sobrescrever arquivos.");
  const head = git("rev-parse", "HEAD");
  if (!hasCommit(baseSha)) {
    console.log("BASE_SHA_NOT_LOCAL: buscando commit público congelado, sem checkout...");
    execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", baseSha], {
      cwd: root, stdio: "inherit",
    });
  }
  if (!hasCommit(baseSha)) throw Error("Base não disponível. Nenhuma conclusão inferida.");
  const eslint = new ESLint({ cwd: root, fix: false });
  const totals = {
    base: { errors: 0, prettierErrors: 0, otherErrors: 0, warnings: 0 },
    head: { errors: 0, prettierErrors: 0, otherErrors: 0, warnings: 0 },
  };
  const results = [];
  for (const path of paths) {
    const absolute = join(root, path);
    const baseSource = gitRaw("show", baseSha + ":" + path);
    const headSource = gitRaw("show", head + ":" + path);
    const base = summarize((await eslint.lintText(baseSource, { filePath: absolute }))[0]);
    const candidate = summarize((await eslint.lintText(headSource, { filePath: absolute }))[0]);
    for (const key of Object.keys(totals.base)) {
      totals.base[key] += base[key];
      totals.head[key] += candidate[key];
    }
    const delta = {
      errors: candidate.errors - base.errors,
      prettierErrors: candidate.prettierErrors - base.prettierErrors,
      otherErrors: candidate.otherErrors - base.otherErrors,
      warnings: candidate.warnings - base.warnings,
    };
    results.push({ path, base, candidate, delta });
    console.log("F02_LINT_FILE", JSON.stringify({ path, base, candidate, delta }));
  }
  const delta = Object.fromEntries(Object.keys(totals.base).map(k => [k, totals.head[k] - totals.base[k]]));
  console.log("F02_LINT_DELTA", JSON.stringify({
    baseSha, head, base: totals.base, candidate: totals.head, delta, files: paths.length,
  }));
  console.log("LIMITE: comparação por contagem de regra, não equivale a lint completo PASS; não executa CI.");
  if (git("status", "--porcelain")) throw Error("Árvore alterada inesperadamente.");
} catch (error) {
  console.error("F02_LINT_AUDIT_BLOCKED:", error?.message ?? String(error));
  process.exitCode = 1;
}
