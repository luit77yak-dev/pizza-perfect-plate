import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MapPin, ShoppingBag, Store, X } from "lucide-react";
import { usePurchaseDialog } from "./use-purchase-dialog";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem } from "@/lib/domain/types";
import type { DemoState } from "../data/model";
import {
  cartDetails,
  checkoutSnapshot,
  exampleCustomer,
  exampleDraft,
  validateService,
} from "../engine/orders";
import type { CheckoutDraft, CheckoutSnapshot } from "../engine/orders";

export function FornoCheckout({
  state,
  items,
  draft,
  setDraft,
  stale,
  onClose,
  onCart,
  onEdit,
  onRemove,
  onConfirm,
}: {
  state: DemoState;
  items: CartItem[];
  draft: CheckoutDraft;
  setDraft: (draft: CheckoutDraft) => void;
  stale: boolean;
  onClose: () => void;
  onCart: () => void;
  onEdit: (item: CartItem) => void;
  onRemove: (id: string) => void;
  onConfirm: (snapshot: CheckoutSnapshot) => void;
}) {
  const ref = usePurchaseDialog(onClose);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ReturnType<typeof validateService>>({});
  const [problem, setProblem] = useState("");
  const [review, setReview] = useState<CheckoutSnapshot | null>(null);
  const current = checkoutSnapshot(state, items, draft);
  const changed = review !== null && JSON.stringify(review) !== JSON.stringify(current);
  const blocked = stale || !state.store.open || !items.length;
  useEffect(() => {
    ref.current?.querySelector(".forno-purchase-body")?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step, ref]);
  const field = (
    key: keyof typeof exampleCustomer,
    label: string,
    required = false,
    type = "text",
  ) => (
    <label className={key === "notes" || key === "street" ? "forno-checkout-wide" : ""}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={draft[key]}
        maxLength={key === "notes" ? 250 : 100}
        autoComplete="off"
        required={required}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `demo-field-${key}` : undefined}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
      {errors[key] && (
        <small role="alert" id={`demo-field-${key}`}>
          {errors[key]}
        </small>
      )}
    </label>
  );
  function next() {
    setProblem("");
    if (blocked) return;
    if (step === 1) {
      const validation = validateService(draft, state);
      setErrors(validation);
      if (Object.keys(validation).length) {
        requestAnimationFrame(() =>
          ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
        return;
      }
      setReview(current);
    }
    setStep((s) => Math.min(2, s + 1));
  }
  return (
    <div
      className="forno-purchase"
      ref={ref}
      data-customer-dialog
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout simulado"
    >
      <section className="forno-purchase-surface">
        <div className="forno-purchase-header">
          <button aria-label="Voltar ao carrinho" onClick={onCart}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <small>{state.store.name}</small>
            <h2 ref={heading} tabIndex={-1}>
              {["Revise seu pedido", "Como vamos atender?", "Tudo pronto para confirmar"][step]}
            </h2>
          </div>
          <button aria-label="Fechar checkout" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="forno-purchase-demo" role="note">
          DEMONSTRAÇÃO · Sem envio ou cobrança. Use somente exemplos fictícios.
        </div>
        <ol className="forno-checkout-steps" aria-label="Etapas do checkout">
          {["Pedido", "Atendimento", "Confirmar"].map((s, i) => (
            <li key={s} aria-current={step === i ? "step" : undefined}>
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="forno-purchase-body">
          {blocked && (
            <p role="alert" className="forno-checkout-warning">
              {stale
                ? "O catálogo ou a demonstração mudou. Volte ao carrinho e refaça as seleções."
                : !items.length
                  ? "Seu carrinho está vazio."
                  : "A loja está fechada na demonstração."}
            </p>
          )}
          {step === 0 && (
            <>
              <p className="forno-purchase-intro">Cada detalhe do seu pedido, do seu jeito.</p>
              <CheckoutItems items={items} onEdit={onEdit} onRemove={onRemove} />
              <AmountSummary
                amounts={{ ...current, fee: 0, total: current.subtotal }}
                label="Subtotal"
              />
            </>
          )}
          {step === 1 && (
            <>
              <div className="forno-service-choice" role="group" aria-label="Modalidade">
                {(["Entrega", "Retirada"] as const).map((mode) => (
                  <button
                    key={mode}
                    aria-pressed={draft.fulfillment === mode}
                    disabled={mode === "Entrega" ? !state.store.delivery : !state.store.pickup}
                    onClick={() => {
                      setDraft({ ...draft, fulfillment: mode });
                      setErrors({});
                    }}
                  >
                    {mode === "Entrega" ? <MapPin size={22} /> : <Store size={22} />}
                    <strong>{mode}</strong>
                    <small>{mode === "Entrega" ? "Endereço de exemplo" : "Na casa fictícia"}</small>
                  </button>
                ))}
              </div>
              {errors.fulfillment && <p role="alert">{errors.fulfillment}</p>}
              <p className="forno-privacy-note">
                Não informe dados pessoais reais. Os campos ficam somente na memória desta aba; o
                pedido salvo usa sempre o perfil fictício predefinido.
              </p>
              <button
                className="forno-link-action"
                onClick={() => {
                  setDraft(exampleDraft(draft.fulfillment, draft.zoneId));
                  setErrors({});
                }}
              >
                Usar dados de exemplo
              </button>
              <div className="forno-service-fields">
                {field("name", "Nome fictício", true)}
                {field("phone", "Telefone fictício", true, "tel")}
                {draft.fulfillment === "Entrega" ? (
                  <>
                    {field("zip", "CEP fictício (opcional)")}
                    {field("number", "Número fictício (ou sem número)", true)}
                    {field("street", "Rua fictícia", true)}
                    <label className="forno-checkout-wide">
                      <span>Bairro ou região *</span>
                      <select
                        aria-label="Bairro"
                        value={draft.zoneId}
                        aria-invalid={Boolean(errors.zoneId)}
                        aria-describedby={errors.zoneId ? "demo-field-zone" : undefined}
                        onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}
                      >
                        <option value="">Escolha uma região</option>
                        {state.zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} · {formatCurrency(z.fee)}
                          </option>
                        ))}
                      </select>
                      {errors.zoneId && (
                        <small id="demo-field-zone" role="alert">
                          {errors.zoneId}
                        </small>
                      )}
                    </label>
                    {field("complement", "Complemento fictício")}
                    {field("reference", "Referência fictícia")}
                  </>
                ) : (
                  <div className="forno-pickup-info forno-checkout-wide">
                    <Store size={20} />
                    <div>
                      <strong>Retirada no estabelecimento demonstrativo</strong>
                      <p>{state.store.address}</p>
                      <small>Não é necessário informar endereço.</small>
                    </div>
                  </div>
                )}
                {field("notes", "Observações fictícias")}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="forno-confirmation-profile">
                <Check size={26} />
                <div>
                  <h3>{exampleCustomer.name}</h3>
                  <p>{exampleCustomer.phone} · perfil de exemplo</p>
                  <strong>{draft.fulfillment}</strong>
                  <p>
                    {draft.fulfillment === "Entrega"
                      ? `${exampleCustomer.street}, ${exampleCustomer.number} · ${state.zones.find((z) => z.id === draft.zoneId)?.name ?? "Região removida"}`
                      : "Retirada no estabelecimento fictício"}
                  </p>
                  {draft.fulfillment === "Entrega" && (
                    <small>
                      {exampleCustomer.zip} · {exampleCustomer.complement} ·{" "}
                      {exampleCustomer.reference}
                    </small>
                  )}
                  <p>{exampleCustomer.notes}</p>
                </div>
              </div>
              <CheckoutItems items={items} />
              <AmountSummary amounts={review ?? current} />
              <p className="forno-privacy-note">
                Confirmação simulada. Nenhum pedido será enviado e nenhuma cobrança será realizada.
              </p>
              {changed && (
                <p role="alert">
                  A taxa ou a modalidade mudou. Volte e revise os valores antes de confirmar.
                </p>
              )}
              {problem && <p role="alert">{problem}</p>}
            </>
          )}
        </div>
        <div className="forno-purchase-footer">
          <div>
            <small>{step === 0 ? "Subtotal" : "Total demonstrativo"}</small>
            <strong>
              {formatCurrency(
                step === 0 ? current.subtotal : review && step === 2 ? review.total : current.total,
              )}
            </strong>
          </div>
          {step > 0 && (
            <button
              className="forno-purchase-back"
              onClick={() => {
                setStep((s) => s - 1);
                setReview(null);
              }}
            >
              Voltar
            </button>
          )}
          <button
            className="forno-purchase-primary"
            disabled={blocked || (step === 2 && changed)}
            onClick={() => {
              if (step < 2) next();
              else {
                try {
                  onConfirm(review!);
                } catch (e) {
                  setProblem(e instanceof Error ? e.message : "Revise o pedido.");
                }
              }
            }}
          >
            {step === 0
              ? "Continuar"
              : step === 1
                ? "Revisar confirmação"
                : "Confirmar somente na demonstração"}
          </button>
        </div>
      </section>
    </div>
  );
}
export function CheckoutItems({
  items,
  onEdit,
  onRemove,
}: {
  items: CartItem[];
  onEdit?: (item: CartItem) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <ul className="forno-checkout-items">
      {items.map((i) => (
        <li key={i.lineId}>
          {i.imageUrl ? (
            <img src={i.imageUrl} alt="" />
          ) : (
            <span className="forno-item-placeholder">
              <ShoppingBag size={22} />
            </span>
          )}
          <div>
            <h3>
              {i.quantity}× {i.productName}
            </h3>
            <p>{cartDetails(i).join(" · ")}</p>
            <small>{formatCurrency(i.unitPrice)} por unidade</small>
            {onEdit && (
              <div className="forno-item-actions">
                <button onClick={() => onEdit(i)} aria-label={`Editar ${i.productName}`}>
                  Editar
                </button>
                <button
                  onClick={() => onRemove?.(i.lineId)}
                  aria-label={`Remover ${i.productName}`}
                >
                  Remover
                </button>
              </div>
            )}
          </div>
          <strong>{formatCurrency(i.unitPrice * i.quantity)}</strong>
        </li>
      ))}
    </ul>
  );
}
export function AmountSummary({
  amounts,
  label = "Total demonstrativo",
}: {
  amounts: { subtotal: number; fee: number; total: number };
  label?: string;
}) {
  return (
    <dl className="forno-amounts">
      <div>
        <dt>Subtotal</dt>
        <dd>{formatCurrency(amounts.subtotal)}</dd>
      </div>
      <div>
        <dt>Taxa de entrega</dt>
        <dd>{formatCurrency(amounts.fee)}</dd>
      </div>
      <div>
        <dt>{label}</dt>
        <dd>{formatCurrency(amounts.total)}</dd>
      </div>
    </dl>
  );
}
