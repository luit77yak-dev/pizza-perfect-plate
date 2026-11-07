import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

/** Synthetic demo. No Supabase, network requests, real orders or persistence. */
export const Route = createFileRoute("/piloto-demo")({
  component: PilotoDemo,
  head: () => ({ meta: [{ title: "NEROXA | Piloto fictício" }] }),
});

type StoreId = "forno" | "horizonte";
type Product = { id: string; name: string; cents: number };
type Order = { id: string; products: string[]; total: number; status: 0 | 1 | 2 };
type Carts = Record<StoreId, Record<string, number>>;
type Orders = Record<StoreId, Order[]>;

const stores: Record<StoreId, { name: string; products: Product[] }> = {
  forno: { name: "Forno di Pietra (exemplo)", products: [
    { id: "margherita", name: "Pizza Margherita", cents: 4290 },
    { id: "calabresa", name: "Pizza Calabresa", cents: 4690 },
    { id: "refrigerante", name: "Refrigerante", cents: 790 },
  ] },
  horizonte: { name: "Pizzaria Horizonte (fictícia)", products: [
    { id: "frango", name: "Pizza de Frango", cents: 4890 },
    { id: "queijos", name: "Pizza Quatro Queijos", cents: 5290 },
    { id: "suco", name: "Suco Natural", cents: 1190 },
  ] },
};
const stages = ["Recebido", "Em preparo", "Pronto para retirada"] as const;
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function PilotoDemo() {
  const [store, setStore] = useState<StoreId>("forno");
  const [view, setView] = useState<"cliente" | "gerente">("cliente");
  const [carts, setCarts] = useState<Carts>({ forno: {}, horizonte: {} });
  const [orders, setOrders] = useState<Orders>({ forno: [], horizonte: [] });
  const [selected, setSelected] = useState<Record<StoreId, string | null>>({
    forno: null, horizonte: null,
  });
  const catalog = stores[store];
  const cart = carts[store];
  const lines = catalog.products.filter((p) => (cart[p.id] ?? 0) > 0);
  const total = lines.reduce((sum, p) => sum + p.cents * cart[p.id], 0);
  const active = orders[store].find((order) => order.id === selected[store]);

  function changeQuantity(productId: string, delta: number) {
    setCarts((prev) => ({
      ...prev,
      [store]: {
        ...prev[store],
        [productId]: Math.max(0, (prev[store][productId] ?? 0) + delta),
      },
    }));
  }

  function simulateCheckout() {
    if (lines.length === 0) return;
    const order: Order = {
      id: store + "-ficticio-" + String(orders[store].length + 1),
      products: lines.map((p) => String(cart[p.id]) + " × " + p.name),
      total,
      status: 0,
    };
    setOrders((prev) => ({ ...prev, [store]: [...prev[store], order] }));
    setSelected((prev) => ({ ...prev, [store]: order.id }));
    setCarts((prev) => ({ ...prev, [store]: {} }));
  }

  function advanceStatus() {
    if (!active || active.status === 2) return;
    setOrders((prev) => ({
      ...prev,
      [store]: prev[store].map((o) =>
        o.id === active.id ? { ...o, status: (o.status + 1) as 0 | 1 | 2 } : o,
      ),
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
          <strong>DEMONSTRAÇÃO FICTÍCIA.</strong> Nenhum pedido ou pagamento real é enviado.
          Dados apenas em memória; não há acesso ao Supabase ou a outro serviço.
        </div>
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">NEROXA · Teste visual</p>
          <h1 className="text-3xl font-bold">Da vitrine ao acompanhamento em uma tela</h1>
          <p className="max-w-3xl text-slate-300">
            Teste duas lojas separadas, carrinho, checkout simulado e acompanhamento do cliente pelo painel do gerente.
            Este exercício não homologa autenticação, isolamento de banco ou pedidos reais.
          </p>
        </header>
        <nav aria-label="Modo de demonstração" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={view === "cliente"} onClick={() => setView("cliente")}
            className={view === "cliente" ? "rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950" : "rounded-xl border border-slate-700 px-4 py-3"}>
            Visão do cliente
          </button>
          <button type="button" aria-pressed={view === "gerente"} onClick={() => setView("gerente")}
            className={view === "gerente" ? "rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950" : "rounded-xl border border-slate-700 px-4 py-3"}>
            Painel do gerente (fictício)
          </button>
        </nav>
        <nav aria-label="Selecionar loja fictícia" className="flex flex-wrap gap-2">
          {(Object.keys(stores) as StoreId[]).map((key) => (
            <button key={key} type="button" aria-pressed={store === key}
              onClick={() => setStore(key)}
              className={store === key
                ? "rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950"
                : "rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 hover:border-emerald-400"}>
              {stores[key].name}
            </button>
          ))}
        </nav>
        {view === "gerente" ? (
          <section aria-label="Gestão de pedidos fictícios" className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-5">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Painel simulado · sem acesso administrativo real</p>
              <h2 className="text-2xl font-bold">Pedidos da {catalog.name}</h2>
              <p className="text-sm text-slate-300">
                Atualize os pedidos fictícios nesta loja. Volte à visão do cliente para conferir o acompanhamento.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <p className="rounded-lg bg-slate-800 p-3">Pedidos: <strong>{orders[store].length}</strong></p>
              <p className="rounded-lg bg-slate-800 p-3">Em preparo: <strong>{orders[store].filter((o) => o.status === 1).length}</strong></p>
              <p className="rounded-lg bg-slate-800 p-3">Prontos: <strong>{orders[store].filter((o) => o.status === 2).length}</strong></p>
            </div>
            {orders[store].length === 0 ? (
              <p className="rounded-lg border border-slate-700 p-4 text-slate-300">
                Nenhum pedido fictício nesta loja. Faça um checkout simulado na visão do cliente.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(250px,1fr)]">
                <div className="space-y-2">
                  {orders[store].map((order) => (
                    <button key={order.id} type="button"
                      aria-pressed={selected[store] === order.id}
                      onClick={() => setSelected((prev) => ({ ...prev, [store]: order.id }))}
                      className={selected[store] === order.id
                        ? "w-full rounded-lg border border-emerald-400 bg-emerald-400/10 p-4 text-left"
                        : "w-full rounded-lg border border-slate-700 bg-slate-950 p-4 text-left"}>
                      <strong>Pedido {order.id}</strong>
                      <span className="mt-1 block text-sm text-slate-300">{stages[order.status]} · {money(order.total)}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3 rounded-lg border border-slate-700 p-4">
                  {active ? (
                    <>
                      <h3 className="font-bold">Pedido {active.id}</h3>
                      <p aria-live="polite" className="font-semibold text-emerald-400">{stages[active.status]}</p>
                      <p className="text-sm">{active.products.join(", ")}</p>
                      <button type="button" disabled={active.status === 2} onClick={advanceStatus}
                        className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-40">
                        Avançar status fictício
                      </button>
                    </>
                  ) : <p>Selecione um pedido fictício.</p>}
                </div>
              </div>
            )}
          </section>
        ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
          <section aria-label="Cardápio fictício" className="space-y-3">
            <h2 className="text-xl font-bold">{catalog.name} · Cardápio</h2>
            {catalog.products.map((p) => (
              <article key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div><h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-emerald-400">{money(p.cents)}</p></div>
                <button type="button" onClick={() => changeQuantity(p.id, 1)}
                  className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-slate-950">Adicionar</button>
              </article>
            ))}
          </section>
          <div className="space-y-5">
            <section aria-label="Carrinho fictício" className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Carrinho · {catalog.name}</h2>
              {lines.length === 0 ? <p className="text-sm text-slate-400">Carrinho vazio nesta loja.</p> : lines.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b border-slate-700 pb-3">
                  <div><p>{p.name}</p><p className="text-sm text-slate-400">{money(p.cents * cart[p.id])}</p></div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={"Remover " + p.name} onClick={() => changeQuantity(p.id, -1)}
                      className="rounded-lg border border-slate-600 px-3 py-2">−</button>
                    <span>{cart[p.id]}</span>
                    <button type="button" aria-label={"Adicionar " + p.name} onClick={() => changeQuantity(p.id, 1)}
                      className="rounded-lg border border-slate-600 px-3 py-2">+</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between font-bold"><span>Total fictício</span><span>{money(total)}</span></div>
              <button type="button" disabled={!lines.length} onClick={simulateCheckout}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-40">
                Simular checkout — sem enviar pedido
              </button>
            </section>
            <section aria-label="Tracking fictício" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-xl font-bold">Acompanhamento simulado</h2>
              {orders[store].length > 1 && <div className="flex flex-wrap gap-2">
                {orders[store].map((order) => (
                  <button key={order.id} type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [store]: order.id }))}
                    className="rounded border border-slate-600 px-2 py-1 text-xs">{order.id}</button>
                ))}
              </div>}
              {active ? <>
                <p className="text-sm text-slate-400">Pedido fictício {active.id}</p>
                <p aria-live="polite" className="font-bold text-emerald-400">{stages[active.status]}</p>
                <p className="text-sm">{active.products.join(", ")}</p>
                <p className="text-sm">Total simulado: {money(active.total)}</p>
                <p className="text-sm text-slate-300">Status atualizado somente pelo painel fictício do gerente.</p>
              </> : <p className="text-sm text-slate-400">Simule o checkout para acompanhar.</p>}
            </section>
          </div>
        </div>
        )}
        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-400">
          Ao atualizar a página, os dados desaparecem. Sem autenticação de cliente, SQL, RPC ou serviços externos.
          F01/F02 continuam não homologados.
        </footer>
      </div>
    </main>
  );
}
