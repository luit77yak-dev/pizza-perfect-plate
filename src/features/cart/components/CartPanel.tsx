import { Check, Clock3, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem } from "@/lib/domain/types";

/*
 * Carrinho premium: folha escura, barra de progresso até o pedido mínimo,
 * botão principal legível mesmo quando a loja está fechada.
 * Mesmas props e mesmo comportamento da versão anterior.
 * Usa <section> (não <aside>/<header>) para não herdar os remendos globais de CSS.
 */
export function CartPanel({
  items,
  subtotal,
  onClose,
  onUpdate,
  onRemove,
  onClear,
  storeOpen,
  storeStatusLabel,
  minOrderAmount,
  pickupEnabled,
  deliveryEnabled,
  onCheckout,
}: {
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onUpdate: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  minOrderAmount: number;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  onCheckout: () => void;
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasMinimum = deliveryEnabled && minOrderAmount > 0;
  const belowMinimum = hasMinimum && subtotal < minOrderAmount;
  const missing = Math.max(0, minOrderAmount - subtotal);
  const progress = hasMinimum ? Math.min(100, Math.round((subtotal / minOrderAmount) * 100)) : 100;
  const blockedByMinimum = deliveryEnabled && !pickupEnabled && belowMinimum;
  const disabled = items.length === 0 || !storeOpen || blockedByMinimum;

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar carrinho"
        tabIndex={-1}
      />
      <section className="relative flex h-full w-full max-w-md flex-col border-l border-[#f4eee2]/10 bg-[#06282d] text-[#f4eee2] shadow-[0_0_80px_rgba(0,0,0,.5)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#f4eee2]/10 px-5 py-4">
          <div>
            <h2 className="font-display text-[28px] font-medium leading-tight">Seu pedido</h2>
            {items.length > 0 && (
              <p className="text-[13px] text-[#f4eee2]/55">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-11 place-items-center rounded-full border border-[#f4eee2]/20 text-[#f4eee2] transition hover:bg-white/10"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid size-16 place-items-center rounded-full border border-[#f4eee2]/15 bg-[#0a3035]">
                <ShoppingBag className="size-7 text-[#f4eee2]/60" />
              </div>
              <p className="mt-4 text-base font-medium">Seu carrinho está vazio</p>
              <p className="mt-1 text-sm text-[#f4eee2]/55">Adicione uma pizza para começar.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const details = [
                  item.sizeName,
                  item.crustName,
                  item.addons.length ? `${item.addons.length} adicional(is)` : null,
                  (item.complements ?? []).length
                    ? `${(item.complements ?? []).length} complemento(s)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li
                    key={item.lineId}
                    className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-4"
                  >
                    <div className="flex gap-3">
                      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[#0d373c]">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center font-display text-xl text-[#f4eee2]/40">
                            {item.productName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-medium leading-snug">
                              {item.productName}
                              {item.secondProductName ? ` + ${item.secondProductName}` : ""}
                            </p>
                            {details && <p className="text-[13px] text-[#f4eee2]/55">{details}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemove(item.lineId)}
                            className="grid size-8 shrink-0 place-items-center rounded-full text-[#f4eee2]/55 transition hover:bg-white/10 hover:text-[#f4eee2]"
                            aria-label={`Remover ${item.productName}`}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-full border border-[#f4eee2]/20">
                            <button
                              type="button"
                              onClick={() => onUpdate(item.lineId, item.quantity - 1)}
                              className="grid size-10 place-items-center"
                              aria-label="Diminuir"
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="w-7 text-center text-sm font-medium tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdate(item.lineId, item.quantity + 1)}
                              className="grid size-10 place-items-center"
                              aria-label="Aumentar"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          <span className="font-display text-lg text-[#f3ad4b]">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[#f4eee2]/10 bg-[#041e22] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[#f4eee2]/60">Subtotal</span>
            <span className="font-display text-2xl font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[#f4eee2]/50">
            A taxa de entrega e os descontos são calculados no checkout.
          </p>

          {items.length > 0 && hasMinimum && (
            <div className="mt-4 rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-4">
              {belowMinimum ? (
                <>
                  <p className="text-sm font-medium">
                    Faltam {formatCurrency(missing)} para o pedido mínimo
                  </p>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f4eee2]/12"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="Progresso até o pedido mínimo para entrega"
                  >
                    <div
                      className="h-full rounded-full bg-[#f3ad4b] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] text-[#f4eee2]/55">
                    Mínimo para entrega: {formatCurrency(minOrderAmount)}.
                    {pickupEnabled ? " Para retirada, não há pedido mínimo." : ""}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium text-[#f4eee2]">
                  <Check className="size-4 text-[#f3ad4b]" strokeWidth={3} />
                  Pedido mínimo para entrega atingido
                </p>
              )}
            </div>
          )}

          {!storeOpen && (
            <p className="mt-4 flex items-center gap-2 rounded-2xl border border-[#f3ad4b]/25 bg-[#f3ad4b]/10 px-4 py-3 text-sm text-[#f4eee2]">
              <Clock3 className="size-4 shrink-0 text-[#f3ad4b]" />
              <span>Loja fechada agora{storeStatusLabel ? `. ${storeStatusLabel}` : ""}</span>
            </p>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={onCheckout}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-[#1b0f08] transition hover:brightness-105 active:scale-[.99] disabled:cursor-not-allowed disabled:bg-[#f4eee2]/10 disabled:text-[#f4eee2]/50"
          >
            {storeOpen ? "Continuar para o checkout" : "Loja fechada"}
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 w-full py-2 text-center text-sm text-[#f4eee2]/55 transition hover:text-[#f4eee2]"
            >
              Limpar carrinho
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
