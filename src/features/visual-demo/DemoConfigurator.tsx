import { useState } from "react";
import { X } from "lucide-react";
import { useCustomerDialog } from "@/features/storefront/hooks/use-customer-dialog";
import { formatCurrency } from "@/lib/domain/money";
import type { DemoState, Selection } from "./data/model";
import { groupsFor, quote, optionAvailable, isAvailable } from "./data/model";
export function DemoConfigurator({
  state,
  productId,
  onClose,
  onAdd,
}: {
  state: DemoState;
  productId: string;
  onClose: () => void;
  onAdd: (selection: Selection, quantity: number, notes: string) => void;
}) {
  const ref = useCustomerDialog(onClose);
  const [selection, setSelection] = useState<Selection>({}),
    [quantity, setQuantity] = useState(1),
    [notes, setNotes] = useState(""),
    [error, setError] = useState("");
  const product = state.products.find((p) => p.id === productId),
    groups = product ? groupsFor(state, product) : [];
  let price: number | null = null,
    problem = "";
  try {
    price = quote(state, productId, selection, quantity).price;
  } catch (e) {
    problem = e instanceof Error ? e.message : "Seleção inválida.";
  }
  return (
    <div
      className="ppp-order-builder demo-configurator"
      ref={ref}
      data-customer-dialog
      role="dialog"
      aria-modal="true"
      aria-label={`Montar ${product?.name ?? "produto indisponível"}`}
      tabIndex={-1}
    >
      <div data-order-surface>
        <header>
          <div>
            <small>PERSONALIZAÇÃO · DEMONSTRAÇÃO</small>
            <h2>{product?.name ?? "Produto removido"}</h2>
          </div>
          <button aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="demo-configurator-body">
          <p>{product?.description}</p>
          {product && !isAvailable(state, product) && <p role="alert">Produto indisponível.</p>}
          {groups.map((g) => (
            <fieldset key={g.id}>
              <legend>
                {g.name} · {g.min > 0 ? "Obrigatório" : "Opcional"} · {g.min}–{g.max}
              </legend>
              {g.options
                .filter((o) => optionAvailable(state, g, o))
                .map((o) => {
                  const selected = (selection[g.id] ?? []).includes(o.id);
                  const drink = state.products.find((p) => p.id === o.productId);
                  return (
                    <label key={o.id} className="demo-config-option">
                      <input
                        type={g.max === 1 ? "radio" : "checkbox"}
                        name={g.id}
                        checked={selected}
                        onChange={() =>
                          setSelection((c) => ({
                            ...c,
                            [g.id]:
                              g.max === 1
                                ? [o.id]
                                : selected
                                  ? (c[g.id] ?? []).filter((id) => id !== o.id)
                                  : [...(c[g.id] ?? []), o.id],
                          }))
                        }
                      />
                      {o.image && <img src={o.image} alt="" />}
                      <span>
                        <strong>{o.name}</strong>
                        <small>{o.description}</small>
                      </span>
                      <b>
                        {g.kind === "FLAVOR"
                          ? "½"
                          : formatCurrency(
                              g.kind === "COMBO"
                                ? (drink?.price ?? 0) +
                                    (state.groups
                                      .flatMap((g) => g.options)
                                      .find((v) => v.id === o.variantId)?.price ?? 0)
                                : o.price,
                            )}
                      </b>
                    </label>
                  );
                })}
              {g.min === 0 && (selection[g.id]?.length ?? 0) > 0 && (
                <button type="button" onClick={() => setSelection((c) => ({ ...c, [g.id]: [] }))}>
                  Limpar {g.name}
                </button>
              )}
            </fieldset>
          ))}
          <label>
            Quantidade
            <input
              type="number"
              min="1"
              max="99"
              value={quantity}
              onChange={(e) => setQuantity(e.target.valueAsNumber)}
            />
          </label>
          <label>
            Observação fictícia
            <textarea maxLength={250} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <p aria-live="polite">{error || problem || "Seleção válida."}</p>
        </div>
        <footer data-order-footer>
          <strong>{price === null ? "Revise as opções" : formatCurrency(price * quantity)}</strong>
          <button
            disabled={price === null}
            onClick={() => {
              try {
                onAdd(selection, quantity, notes);
              } catch (e) {
                setError(e instanceof Error ? e.message : "O catálogo mudou. Revise a seleção.");
              }
            }}
          >
            Adicionar ao carrinho
          </button>
        </footer>
      </div>
    </div>
  );
}
