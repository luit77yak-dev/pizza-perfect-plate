import { BarChart3, ClipboardList, Package, ShoppingBag, Store, Users } from "lucide-react";
import type { SupplierPanelContext } from "@/core/delivery/services/load-supplier-panel";

export function SupplierDashboard({ context, metrics }: { context: SupplierPanelContext; metrics: { ordersToday: number; pendingOrders: number; revenueToday: number; products: number; customers: number } }) {
  const cards = [
    { label: "Pedidos hoje", value: metrics.ordersToday, icon: ShoppingBag },
    { label: "Em andamento", value: metrics.pendingOrders, icon: ClipboardList },
    { label: "Produtos ativos", value: metrics.products, icon: Package },
    { label: "Clientes", value: metrics.customers, icon: Users },
  ];

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Painel da empresa</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{context.organization?.name ?? "Sua empresa"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{context.plan?.name ?? "Plano"} · {context.instance?.name ?? "Instância"}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-4 text-primary" /></div>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <article className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3"><BarChart3 className="size-5 text-primary" /><div><h2 className="font-semibold">Visão da operação</h2><p className="text-sm text-muted-foreground">O painel começa pelo que importa para a rotina.</p></div></div>
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Relatórios e gráficos avançados entram conforme o módulo do plano.</div>
        </article>
        <article className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-3"><Store className="size-5 text-primary" /><div><h2 className="font-semibold">Minha loja</h2><p className="text-sm text-muted-foreground">Instância {context.instance?.status ?? "não configurada"}.</p></div></div>
          <p className="mt-5 text-sm text-muted-foreground">A partir daqui o fornecedor poderá controlar catálogo, pedidos, horários, delivery e aparência em um único painel.</p>
        </article>
      </div>
    </section>
  );
}
