import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem } from "@/lib/domain/types";

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
  return (
    <div
      className="ppp-cart-panel fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho"
    >
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar carrinho"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-lifted">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
              Seu pedido
            </p>
            <h2 className="text-2xl">Carrinho</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="size-7 text-muted-foreground" />
              </div>
              <p className="mt-4 font-semibold">Seu carrinho está vazio</p>
              <p className="mt-1 text-sm text-muted-foreground">Adicione uma pizza para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="rounded-2xl border bg-card p-4">
                  <div className="flex gap-3">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center font-display text-xl text-primary/40">
                          {item.productName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {item.productName}
                            {item.secondProductName ? ` + ${item.secondProductName}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              item.sizeName,
                              item.crustName,
                              item.addons.length ? `${item.addons.length} adicional(is)` : null,
                              (item.complements ?? []).length
                                ? `${(item.complements ?? []).length} complemento(s)`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <button
                          onClick={() => onRemove(item.lineId)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${item.productName}`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-full border">
                          <button
                            onClick={() => onUpdate(item.lineId, item.quantity - 1)}
                            className="p-2"
                            aria-label="Diminuir"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-7 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdate(item.lineId, item.quantity + 1)}
                            className="p-2"
                            aria-label="Aumentar"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-card p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A taxa de entrega e descontos serão calculados no checkout.
          </p>
          {deliveryEnabled && minOrderAmount > 0 && subtotal < minOrderAmount && (
            <div className="mt-3 rounded-2xl bg-primary/5 p-3 text-sm">
              <p className="font-semibold text-primary">
                Pedido mínimo para entrega: {formatCurrency(minOrderAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Faltam {formatCurrency(minOrderAmount - subtotal)} para atingir o mínimo.
                {pickupEnabled ? " Para retirada, não há pedido mínimo." : ""}
              </p>
            </div>
          )}
          <Button
            disabled={
              items.length === 0 ||
              !storeOpen ||
              (deliveryEnabled && !pickupEnabled && minOrderAmount > 0 && subtotal < minOrderAmount)
            }
            className="mt-4 h-12 w-full rounded-full"
            onClick={onCheckout}
          >
            {storeOpen ? "Continuar para checkout" : "Loja fechada"}
          </Button>
          {!storeOpen && (
            <p className="mt-2 text-center text-xs font-medium text-primary">{storeStatusLabel}</p>
          )}
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Limpar carrinho
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
