import { usePurchaseDialog } from "./use-purchase-dialog";
import { useState } from "react";
import {
  Check,
  ChefHat,
  CircleCheck,
  ClipboardCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/domain/money";
import type { DemoState } from "../data/model";
import { exampleCustomer, orderAmounts, orderFlow } from "../engine/orders";
import type { OrderStatus } from "../engine/orders";
import { AmountSummary } from "./FornoCheckout";
const icons = {
  RECEIVED: ShoppingBag,
  CONFIRMED: ClipboardCheck,
  PREPARING: ChefHat,
  READY: CircleCheck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: Check,
  CANCELLED: X,
};
const wording: Record<OrderStatus, [string, string]> = {
  RECEIVED: ["Pedido recebido", "Seu pedido fictício chegou ao painel da cozinha."],
  CONFIRMED: ["Pedido confirmado", "A cozinha confirmou sua seleção demonstrativa."],
  PREPARING: ["Em preparo", "A cozinha está preparando seu pedido na simulação."],
  READY: ["Pedido pronto", "Tudo pronto para a próxima etapa demonstrativa."],
  OUT_FOR_DELIVERY: ["Saiu para entrega", "A entrega está em andamento apenas na demonstração."],
  DELIVERED: ["Entregue", "Pedido demonstrativo concluído. Obrigado por experimentar!"],
  CANCELLED: [
    "Pedido cancelado",
    "A simulação foi encerrada pelo painel. Nenhuma cobrança ocorreu.",
  ],
};
export function FornoTracking({ state, onClose }: { state: DemoState; onClose: () => void }) {
  const orders = state.orders.filter((o) => o.name === exampleCustomer.name);
  const [selection, setSelection] = useState({ id: orders[0]?.id, generation: state.generation });
  const order =
    selection.generation === state.generation
      ? orders.find((o) => o.id === selection.id)
      : undefined;
  const ref = usePurchaseDialog(onClose);
  const labels = (s: OrderStatus) =>
    order?.fulfillment === "Retirada" && s === "READY"
      ? "Pronto para retirada"
      : order?.fulfillment === "Retirada" && s === "DELIVERED"
        ? "Retirado"
        : wording[s][0];
  return (
    <div
      className="forno-purchase forno-tracking"
      ref={ref}
      data-customer-dialog
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Acompanhamento fictício"
    >
      <section className="forno-purchase-surface">
        <div className="forno-purchase-header">
          <ShoppingBag size={24} />
          <div>
            <small>SEU PEDIDO · DEMONSTRAÇÃO</small>
            <h2>Acompanhe cada etapa</h2>
          </div>
          <button aria-label="Fechar acompanhamento" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="forno-purchase-demo">
          DEMONSTRAÇÃO · Status sincronizado com o painel local. Sem cobrança.
        </div>
        <div className="forno-purchase-body">
          {orders.length > 0 && (
            <nav className="forno-tracking-picker" aria-label="Escolher pedido">
              {orders.map((o) => (
                <button
                  key={o.id}
                  aria-pressed={order?.id === o.id}
                  onClick={() => setSelection({ id: o.id, generation: state.generation })}
                >
                  Pedido #{o.id}
                </button>
              ))}
            </nav>
          )}
          {!order ? (
            <div className="forno-tracking-empty">
              <Store size={36} />
              <h3>
                {selection.generation !== state.generation
                  ? "Demonstração restaurada"
                  : "Seu próximo pedido começa no cardápio"}
              </h3>
              <p>
                {selection.generation !== state.generation
                  ? "Os pedidos anteriores foram removidos. Escolha um novo pedido quando disponível."
                  : "Nenhum pedido fictício selecionado neste navegador."}
              </p>
            </div>
          ) : (
            <>
              <div className="forno-tracking-status" role="status" aria-live="polite">
                <small>
                  Pedido #{order.id} · {order.fulfillment}
                </small>
                <h3>{labels(order.status)}</h3>
                <p>
                  {order.fulfillment === "Retirada" && order.status === "READY"
                    ? "Sua seleção está pronta para retirada no estabelecimento fictício."
                    : wording[order.status][1]}
                </p>
              </div>
              {order.status === "CANCELLED" ? (
                <div className="forno-checkout-warning">
                  <X size={20} />
                  Pedido cancelado · valores exibidos apenas como referência fictícia.
                </div>
              ) : (
                <ol className="forno-order-timeline" aria-label="Etapas do pedido">
                  {orderFlow(order.fulfillment).map((status, index, flow) => {
                    const active = flow.indexOf(order.status),
                      done = index < active,
                      Icon = icons[status];
                    return (
                      <li
                        key={status}
                        className={done ? "is-complete" : index === active ? "is-current" : ""}
                        aria-current={index === active ? "step" : undefined}
                      >
                        <span className="forno-timeline-icon">
                          {done ? <Check size={18} /> : <Icon size={18} />}
                        </span>
                        <div>
                          <strong>{labels(status)}</strong>
                          <small>
                            {done
                              ? "Concluído"
                              : index === active
                                ? "Etapa atual"
                                : "Próxima etapa"}
                          </small>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {order.customerProfile && (
                <p className="forno-pickup-info">
                  {exampleCustomer.name} · {exampleCustomer.phone}
                  <br />
                  {order.fulfillment === "Entrega"
                    ? `${exampleCustomer.street}, ${exampleCustomer.number} · ${order.neighborhood}`
                    : "Retirada no estabelecimento fictício"}
                </p>
              )}
              <h3>Resumo do pedido</h3>
              <ul className="forno-checkout-items">
                {order.items.map((i, index) => (
                  <li key={index}>
                    {i.image ? (
                      <img src={i.image} alt="" />
                    ) : (
                      <span className="forno-item-placeholder">
                        <ShoppingBag size={22} />
                      </span>
                    )}
                    <div>
                      <h3>
                        {i.quantity}× {i.name}
                      </h3>
                      <p>{i.details?.join(" · ")}</p>
                    </div>
                    <strong>{formatCurrency(i.quantity * i.price)}</strong>
                  </li>
                ))}
              </ul>
              <AmountSummary amounts={orderAmounts(order.items, order.fee)} />
              <p className="forno-privacy-note">
                Pagamento demonstrativo. Nenhuma cobrança foi realizada.{" "}
                {order.paidAmount > 0
                  ? `Saldo pago fictício: ${formatCurrency(order.paidAmount)}; adicional pendente fictício: ${formatCurrency(orderAmounts(order.items, order.fee).total - order.paidAmount)}.`
                  : "Não há PIX, cartão ou gateway neste ambiente."}
              </p>
            </>
          )}
        </div>
        <div className="forno-purchase-footer">
          <button className="forno-purchase-primary" onClick={onClose}>
            Voltar ao cardápio
          </button>
        </div>
      </section>
    </div>
  );
}
