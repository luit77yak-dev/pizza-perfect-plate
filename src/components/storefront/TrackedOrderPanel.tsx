import { Check, ChevronRight, Clock3, Plus, Pizza, ShoppingBag, X } from "lucide-react";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, FulfillmentType, OrderStatus } from "@/lib/domain/types";

export type PublicTrackedOrder = {
  id: string;
  number: number;
  phone: string;
  items?: CartItem[] | undefined;
  subtotal?: number | undefined;
  total?: number | undefined;
  fulfillment?: FulfillmentType | undefined;
  status?: OrderStatus | undefined;
};

function getTrackedOrderStatusLabel(status?: OrderStatus) {
  switch (status) {
    case "RECEIVED":
      return "Pedido recebido";
    case "CONFIRMED":
      return "Pedido confirmado";
    case "PREPARING":
      return "Em preparo";
    case "READY":
      return "Pronto";
    case "OUT_FOR_DELIVERY":
      return "Saiu para entrega";
    case "DELIVERED":
      return "Entregue";
    case "CANCELLED":
      return "Cancelado";
    default:
      return "Em andamento";
  }
}

/*
 * Acompanhamento do pedido, versão premium.
 * - Cabeçalho escuro (antes era um bloco laranja com texto branco).
 * - Linha do tempo com rótulos legíveis e números visíveis em todos os passos.
 * - Sem <header>: evita os remendos globais de CSS que quebravam o layout no celular.
 */
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
    {
      status: "PREPARING" as OrderStatus,
      label: "Em preparo",
      description: "A cozinha está preparando",
    },
    { status: "READY" as OrderStatus, label: "Pronto", description: "Tudo pronto" },
    ...(order.fulfillment === "DELIVERY" || currentStatus === "OUT_FOR_DELIVERY"
      ? [
          {
            status: "OUT_FOR_DELIVERY" as OrderStatus,
            label: "A caminho",
            description: "Saiu para entrega",
          },
        ]
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
    currentStatus === "RECEIVED"
      ? "Recebemos seu pedido e já estamos cuidando dele."
      : currentStatus === "CONFIRMED"
        ? "Seu pedido foi confirmado e vai entrar na preparação."
        : currentStatus === "PREPARING"
          ? "A cozinha está preparando tudo com carinho."
          : currentStatus === "READY"
            ? order.fulfillment === "DELIVERY"
              ? "Seu pedido está pronto e aguardando a saída para entrega."
              : "Seu pedido está pronto para retirada."
            : currentStatus === "OUT_FOR_DELIVERY"
              ? "Seu pedido saiu para entrega. Já já chega até você."
              : currentStatus === "DELIVERED"
                ? "Pedido entregue. Bom apetite!"
                : currentStatus === "CANCELLED"
                  ? "Este pedido foi cancelado."
                  : "Estamos atualizando o status do seu pedido.";

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Acompanhar pedido #${orderNumber}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar acompanhamento"
        tabIndex={-1}
      />
      <section className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#f4eee2]/10 bg-[#06282d] text-[#f4eee2] shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:max-h-[min(900px,92dvh)] sm:rounded-3xl">
        <div className="shrink-0 border-b border-[#f4eee2]/10 bg-gradient-to-b from-[#241b11] to-[#06282d] px-5 pb-4 pt-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-[#1b0f08]">
                <ShoppingBag className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#f4eee2]/60">Acompanhamento</p>
                <h2 className="truncate font-display text-[30px] font-medium leading-tight">
                  Pedido #{orderNumber}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-[#f4eee2]/20 text-[#f4eee2] transition hover:bg-white/10"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-[#f4eee2]/75">
            <span className="rounded-full border border-[#f4eee2]/15 px-3 py-1">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
            <span className="rounded-full border border-[#f4eee2]/15 px-3 py-1">
              {order.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {availableOrders && availableOrders.length > 1 && onSelectOrder && (
            <div className="border-b border-[#f4eee2]/10 bg-[#041e22] px-5 py-3 sm:px-7">
              <p className="mb-2 text-[13px] text-[#f4eee2]/60">Seus pedidos em andamento</p>
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
                        "min-h-11 shrink-0 rounded-full border px-4 text-sm transition " +
                        (selected
                          ? "border-primary bg-primary font-semibold text-[#1b0f08]"
                          : "border-[#f4eee2]/15 text-[#f4eee2]/80 hover:border-[#f4eee2]/35")
                      }
                    >
                      Pedido #{availableOrder.number}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4 p-5 pb-6 sm:p-7">
            <div className="rounded-3xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-[#f3ad4b]">Agora</p>
                  <h3 className="mt-1 font-display text-[28px] font-medium leading-tight">
                    {getTrackedOrderStatusLabel(currentStatus)}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#f4eee2]/65">
                    {statusMessage}
                  </p>
                </div>
                <div className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary sm:grid">
                  {currentStatus === "PREPARING" ? (
                    <Pizza className="size-5" />
                  ) : currentStatus === "OUT_FOR_DELIVERY" ? (
                    <ChevronRight className="size-5" />
                  ) : (
                    <Clock3 className="size-5" />
                  )}
                </div>
              </div>

              {!isCancelled && (
                <div className="mt-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#f4eee2]/12">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <ol
                    className={
                      "mt-5 grid gap-0 " + (steps.length === 5 ? "grid-cols-5" : "grid-cols-4")
                    }
                  >
                    {steps.map((step, index) => {
                      const complete = index < activeIndex || isFinished;
                      const active = index === activeIndex && !isFinished;
                      return (
                        <li
                          key={step.status}
                          className="min-w-0 text-center"
                          aria-current={active ? "step" : undefined}
                        >
                          <div
                            className={
                              "mx-auto grid size-9 place-items-center rounded-full border text-sm font-semibold transition " +
                              (complete || active
                                ? "border-primary bg-primary text-[#1b0f08]"
                                : "border-[#f4eee2]/25 bg-[#041e22] text-[#f4eee2]/60")
                            }
                          >
                            {complete ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                          </div>
                          <p
                            className={
                              "mt-2 text-[11px] leading-tight " +
                              (active
                                ? "font-semibold text-[#f4eee2]"
                                : complete
                                  ? "text-[#f4eee2]/85"
                                  : "text-[#f4eee2]/50")
                            }
                          >
                            {step.label}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {isCancelled && (
                <div className="mt-4 rounded-2xl bg-destructive/15 px-4 py-3 text-sm text-[#ffb4a8]">
                  Não é possível adicionar novos itens a um pedido cancelado.
                </div>
              )}
            </div>

            {canAddMore && (
              <button
                type="button"
                onClick={onAddToOrder}
                className="group flex w-full items-center gap-4 rounded-3xl border border-[#f3ad4b]/30 bg-[#f3ad4b]/10 p-4 text-left transition hover:border-[#f3ad4b]/60 active:scale-[.99]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3ad4b] text-[#06282d]">
                  <Plus className="size-5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">Esqueceu alguma coisa?</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#f4eee2]/60">
                    Adicione bebidas, acompanhamentos ou sobremesas ao pedido.
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-[#f3ad4b]" />
              </button>
            )}

            <div className="overflow-hidden rounded-3xl border border-[#f4eee2]/12 bg-[#0a3035]">
              <div className="flex items-center justify-between gap-3 border-b border-[#f4eee2]/10 px-5 py-4">
                <h3 className="font-display text-xl font-medium">Itens do pedido</h3>
                <span className="rounded-full border border-[#f4eee2]/15 px-3 py-1 text-[13px] text-[#f4eee2]/70">
                  {itemCount} {itemCount === 1 ? "item" : "itens"}
                </span>
              </div>

              <ul className="divide-y divide-[#f4eee2]/10">
                {items.length > 0 ? (
                  items.map((item, index) => {
                    const quantity = Number(item.quantity) || 0;
                    const unitPrice = Number(item.unitPrice) || 0;
                    const extras = [
                      ...(item.sizeName ? [item.sizeName] : []),
                      ...(item.crustName ? [item.crustName] : []),
                      ...(item.addons ?? []).map((addon) => addon.name),
                      ...(item.complements ?? []).map((complement) => complement.productName),
                    ];
                    return (
                      <li
                        key={
                          item.lineId ||
                          item.productId ||
                          (item.productName || "item") + "-" + index
                        }
                        className="flex gap-3 px-5 py-4"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0d373c] text-primary">
                          <Pizza className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">
                            {quantity}× {item.productName || "Item"}
                            {item.secondProductName ? " + " + item.secondProductName : ""}
                          </p>
                          {extras.length > 0 && (
                            <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[#f4eee2]/55">
                              {extras.join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 pt-0.5 text-[15px] font-medium">
                          {formatCurrency(unitPrice * quantity)}
                        </span>
                      </li>
                    );
                  })
                ) : (
                  <li className="p-6 text-center">
                    <ShoppingBag className="mx-auto size-7 text-[#f4eee2]/35" />
                    <p className="mt-2 text-sm text-[#f4eee2]/55">
                      Os itens deste pedido não estão disponíveis nesta sessão.
                    </p>
                  </li>
                )}
              </ul>

              <div className="flex items-end justify-between gap-4 border-t border-[#f4eee2]/10 bg-[#041e22] px-5 py-4">
                <div>
                  <p className="text-[13px] text-[#f4eee2]/60">Total do pedido</p>
                  <p className="font-display text-[30px] font-medium leading-tight text-[#f3ad4b]">
                    {formatCurrency(orderTotal)}
                  </p>
                </div>
                {canAddMore && (
                  <span className="pb-1 text-[13px] text-[#f4eee2]/55">
                    Você pode acrescentar itens
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#f4eee2]/10 bg-[#041e22] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-[#f4eee2]/60">Total</p>
              <p className="truncate font-display text-[22px] font-medium">
                {formatCurrency(orderTotal)}
              </p>
            </div>
            {canAddMore ? (
              <button
                type="button"
                onClick={onAddToOrder}
                className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold text-[#1b0f08] transition active:scale-[.98]"
              >
                <Plus className="size-4" strokeWidth={2.5} /> Adicionar itens
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-12 shrink-0 rounded-2xl border border-[#f4eee2]/20 px-6 text-[15px] font-medium transition hover:bg-white/10"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
