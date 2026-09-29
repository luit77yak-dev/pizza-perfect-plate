import { Check, ChevronRight, Clock3, Plus, Pizza, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, FulfillmentType, OrderStatus } from "@/lib/domain/types";

export type PublicTrackedOrder = {
  id: string;
  number: number;
  phone: string;
  items?: CartItem[];
  subtotal?: number;
  total?: number;
  fulfillment?: FulfillmentType;
  status?: OrderStatus;
};

function getTrackedOrderStatusLabel(status?: OrderStatus) {
  switch (status) {
    case "RECEIVED": return "Pedido recebido";
    case "CONFIRMED": return "Pedido confirmado";
    case "PREPARING": return "Em preparo";
    case "READY": return "Pronto";
    case "OUT_FOR_DELIVERY": return "Saiu para entrega";
    case "DELIVERED": return "Entregue";
    case "CANCELLED": return "Cancelado";
    default: return "Em andamento";
  }
}

export function TrackedOrderPanel({
  order,
  onClose,
  onAddToOrder,
  availableOrders,
  onSelectOrder,
}: {
  order: PublicTrackedOrder;
  onClose: () => void;
  onAddToOrder: () => void;
  availableOrders?: PublicTrackedOrder[];
  onSelectOrder?: (orderId: string) => void;
}) {
  const currentStatus = order.status ?? "RECEIVED";
  const canAddMore = ["RECEIVED", "CONFIRMED", "PREPARING", "READY"].includes(currentStatus);
  const items = Array.isArray(order.items)
    ? order.items.filter((item): item is CartItem => Boolean(item && typeof item === "object"))
    : [];
  const orderNumber = Number.isFinite(Number(order.number)) ? Number(order.number) : 0;
  const orderTotal = Number.isFinite(Number(order.total))
    ? Number(order.total)
    : Number.isFinite(Number(order.subtotal))
      ? Number(order.subtotal)
      : 0;
  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const steps = [
    { status: "RECEIVED" as OrderStatus, label: "Recebido", description: "Pedido recebido" },
    { status: "CONFIRMED" as OrderStatus, label: "Confirmado", description: "Pedido confirmado" },
    { status: "PREPARING" as OrderStatus, label: "Em preparo", description: "A cozinha está preparando" },
    { status: "READY" as OrderStatus, label: "Pronto", description: "Tudo pronto" },
    ...(order.fulfillment === "DELIVERY"
      ? [{ status: "OUT_FOR_DELIVERY" as OrderStatus, label: "A caminho", description: "Saiu para entrega" }]
      : []),
  ];
  const statusIndex = steps.findIndex((step) => step.status === currentStatus);
  const activeIndex = statusIndex >= 0 ? statusIndex : 0;
  const isFinished = currentStatus === "DELIVERED";
  const isCancelled = currentStatus === "CANCELLED";
  const progressPercent = isFinished
    ? 100
    : isCancelled
      ? 0
      : steps.length <= 1
        ? 0
        : Math.min(100, Math.round((activeIndex / (steps.length - 1)) * 100));

  const statusMessage =
    currentStatus === "RECEIVED" ? "Recebemos seu pedido e já estamos cuidando dele." :
    currentStatus === "CONFIRMED" ? "Seu pedido foi confirmado e vai entrar na preparação." :
    currentStatus === "PREPARING" ? "A cozinha está preparando tudo com carinho." :
    currentStatus === "READY" ? order.fulfillment === "DELIVERY" ? "Seu pedido está pronto e aguardando a saída para entrega." : "Seu pedido está pronto para retirada." :
    currentStatus === "OUT_FOR_DELIVERY" ? "Seu pedido saiu para entrega. Já já chega até você." :
    currentStatus === "DELIVERED" ? "Pedido entregue. Bom apetite!" :
    currentStatus === "CANCELLED" ? "Este pedido foi cancelado." :
    "Estamos atualizando o status do seu pedido.";

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Acompanhar pedido #${orderNumber}`}
    >
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Fechar acompanhamento" />
      <section className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-[#0d1117] text-white shadow-2xl sm:max-h-[min(900px,92dvh)] sm:rounded-[2rem]">
        <header
          className="relative shrink-0 overflow-hidden border-b border-black/10 bg-[#e8751a] px-5 pb-5 pt-4 text-white sm:px-7 sm:pb-6"
        >
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-white shadow-lg">
                  <ShoppingBag className="size-4" />
                </span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.2em] text-white/85">Acompanhamento</p>
                  <h2 className="mt-0.5 truncate font-display text-2xl tracking-tight text-white sm:text-3xl">Pedido #{orderNumber}</h2>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#f4eee2]/65">
                <span className="rounded-full border border-[#f4eee2]/15 bg-[#f4eee2]/[.06] px-2.5 py-1">
                  {itemCount} {itemCount === 1 ? "item" : "itens"}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                  {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="relative grid size-10 shrink-0 place-items-center rounded-full border border-white/30 bg-white/10 text-white transition hover:bg-white/20 active:scale-95" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {availableOrders && availableOrders.length > 1 && onSelectOrder && (
            <div className="border-b border-white/10 bg-[#111820] px-4 py-3 sm:px-6">
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.18em] text-white/50">
                Seus pedidos em andamento
              </p>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {availableOrders.map((availableOrder) => {
                  const selected = availableOrder.id === order.id;
                  return (
                    <button
                      key={availableOrder.id}
                      type="button"
                      onClick={() => onSelectOrder(availableOrder.id)}
                      aria-pressed={selected}
                      className={
                        "min-w-[118px] shrink-0 rounded-xl border px-3 py-2.5 text-[11px] font-black transition-all " +
                        (selected
                          ? "border-primary bg-primary text-white shadow-md"
                          : "border-white/10 bg-white/[.06] text-white/75 hover:bg-white/10 hover:text-white")
                      }
                    >
                      Pedido #{availableOrder.number}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-4 p-4 pb-6 sm:space-y-5 sm:p-6 sm:pb-7">
            <section className="overflow-hidden rounded-3xl border border-primary/15 bg-background/[.035] shadow-sm">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Agora</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight">{getTrackedOrderStatusLabel(currentStatus)}</h3>
                    <p className="mt-1.5 max-w-lg text-xs leading-5 text-background/50">{statusMessage}</p>
                  </div>
                  <div className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:grid">
                    {currentStatus === "PREPARING" ? <Pizza className="size-5" /> : currentStatus === "OUT_FOR_DELIVERY" ? <ChevronRight className="size-5" /> : <Clock3 className="size-5" />}
                  </div>
                </div>

                {!isCancelled && (
                  <div className="mt-5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-background/5">
                      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className={steps.length === 5 ? "mt-4 grid grid-cols-5 gap-1" : "mt-4 grid grid-cols-4 gap-1"}>
                      {steps.map((step, index) => {
                        const complete = index < activeIndex || isFinished;
                        const active = index === activeIndex && !isFinished;
                        return (
                          <div key={step.status} className="min-w-0 text-center">
                            <div className={"mx-auto grid size-7 place-items-center rounded-full border text-[9px] font-black transition sm:size-8 " + (complete || active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-background/10 bg-[#0d1117] text-muted-foreground")}>
                              {complete ? <Check className="size-3.5" /> : index + 1}
                            </div>
                            <p className={"mt-1.5 truncate text-[8px] font-bold uppercase tracking-[.06em] sm:text-[9px] " + (active || complete ? "text-background" : "text-muted-foreground")}>{step.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isCancelled && (
                  <div className="mt-4 rounded-2xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                    Não é possível adicionar novos itens a um pedido cancelado.
                  </div>
                )}
              </div>
            </section>

            {canAddMore && (
              <button
                type="button"
                onClick={onAddToOrder}
                className="group flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3.5 text-left transition hover:border-primary/40 hover:bg-primary/15 active:scale-[.99] sm:p-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition group-hover:scale-105">
                  <Plus className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">Esqueceu alguma coisa?</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">Adicione bebidas, acompanhamentos ou sobremesas ao pedido.</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-primary" />
              </button>
            )}

            <section className="overflow-hidden rounded-3xl border border-background/10 bg-background/[.035] shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-background/10 px-4 py-3.5 sm:px-5 sm:py-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.18em] text-muted-foreground">Resumo</p>
                  <h3 className="mt-0.5 text-base font-black">Itens do pedido</h3>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-bold text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
              </div>

              <div className="divide-y">
                {items.length > 0 ? items.map((item, index) => {
                  const quantity = Number(item.quantity) || 0;
                  const unitPrice = Number(item.unitPrice) || 0;
                  const extras = [
                    ...(item.sizeName ? [item.sizeName] : []),
                    ...(item.crustName ? [item.crustName] : []),
                    ...((item.addons ?? []).map((addon) => addon.name)),
                    ...((item.complements ?? []).map((complement) => complement.productName)),
                  ];
                  return (
                    <div key={item.lineId || item.productId || (item.productName || "item") + "-" + index} className="flex gap-3 px-4 py-3.5 sm:px-5">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                        <Pizza className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{quantity}× {item.productName || "Item"}{item.secondProductName ? " + " + item.secondProductName : ""}</p>
                        {extras.length > 0 && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{extras.join(" · ")}</p>}
                      </div>
                      <span className="shrink-0 pt-0.5 text-sm font-bold">{formatCurrency(unitPrice * quantity)}</span>
                    </div>
                  );
                }) : (
                  <div className="p-6 text-center">
                    <ShoppingBag className="mx-auto size-7 text-muted-foreground/50" />
                    <p className="mt-2 text-xs text-muted-foreground">Os itens deste pedido não estão disponíveis nesta sessão.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-background/10 bg-[#0a0e14] px-4 py-4 sm:px-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-muted-foreground">Total do pedido</p>
                    <p className="mt-0.5 font-display text-2xl tracking-tight sm:text-3xl">{formatCurrency(orderTotal)}</p>
                  </div>
                  {canAddMore && <span className="text-[10px] font-semibold text-muted-foreground">Você pode acrescentar itens</span>}
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="shrink-0 border-t border-background/10 bg-[#0a0e14]/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[.14em] text-muted-foreground">Total</p>
              <p className="truncate text-lg font-black">{formatCurrency(orderTotal)}</p>
            </div>
            {canAddMore ? (
              <Button type="button" onClick={onAddToOrder} className="h-11 shrink-0 rounded-full px-4 text-xs font-black shadow-lg">
                <Plus className="mr-1.5 size-3.5" /> Adicionar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-full px-5 text-xs font-bold">
                Fechar
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
