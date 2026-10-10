// Render contract only: synthetic item and presentation stubs, no storefront/backend.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
const data = (s) => "data:text/javascript;base64," + Buffer.from(s).toString("base64");
const stub = data(
  'export const useCustomerDialog=()=>null; export const Button="button"; export const Minus="span",Plus="span",ShoppingBag="span",X="span"; export const formatCurrency=n=>"R$ "+n.toFixed(2);',
);
let source = ts.transpileModule(
  readFileSync(new URL("../src/features/cart/components/CartPanel.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
for (const module of [
  "@/features/storefront/hooks/use-customer-dialog",
  "lucide-react",
  "@/components/ui/button",
  "@/lib/domain/money",
])
  source = source.replace(JSON.stringify(module), JSON.stringify(stub));
source = source.replace(
  '"react/jsx-runtime"',
  JSON.stringify(pathToFileURL(require.resolve("react/jsx-runtime")).href),
);
const { CartPanel } = await import(data(source));
const item = {
  lineId: "synthetic",
  productName: "Produto fictício",
  imageUrl: null,
  sizeName: "Média",
  crustName: "Tradicional",
  addons: [{ name: "Azeitona" }],
  complements: [],
  quantity: 1,
  unitPrice: 40,
};
const props = {
  items: [item],
  subtotal: 40,
  onClose() {},
  onUpdate() {},
  onRemove() {},
  onClear() {},
  storeOpen: true,
  storeStatusLabel: "",
  minOrderAmount: 0,
  pickupEnabled: true,
  deliveryEnabled: true,
  onCheckout() {},
};
const original = renderToStaticMarkup(createElement(CartPanel, props));
assert.ok(original.includes("Média Tradicional 1 adicional(is)"));
assert.ok(!original.includes("Modificar item") && !original.includes("Continuar comprando"));
const demo = renderToStaticMarkup(
  createElement(CartPanel, {
    ...props,
    onEdit() {},
    onContinueShopping() {},
    itemDetails: () => ["Tamanho: Média", "Adicional: Azeitona"],
  }),
);
assert.ok(demo.includes("Modificar item") && demo.includes("Continuar comprando"));
assert.ok(demo.includes("Tamanho: Média Adicional: Azeitona"));
assert.ok(original.includes("R$ 40.00") && demo.includes("R$ 40.00"));
console.log("5 shared bag presentation contract checks passed");
