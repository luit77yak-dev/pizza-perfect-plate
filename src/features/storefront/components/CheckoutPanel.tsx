import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/money";
import { normalizeNeighborhood } from "@/features/storefront/domain/storefront-utils";
import type {
  CartItem,
  DeliveryZone,
  FulfillmentType,
  Organization,
  OrganizationSettings,
  PaymentMethod,
  OrderStatus,
} from "@/lib/domain/types";

export function CheckoutPanel({
  organization,
  settings,
  deliveryZones,
  items,
  subtotal,
  onClose,
  onSuccess,
  trackedOrder,
  storeOpen,
  storeStatusLabel,
  onOrderFinished,
}: {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: (order: { id: string; number: number; phone: string }) => void;
  trackedOrder?: { id: string; number: number; phone: string } | null;
  storeOpen: boolean;
  storeStatusLabel: string;
  onOrderFinished: () => void;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    settings.delivery_enabled ? "DELIVERY" : "PICKUP",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.payment_methods[0] ?? "PIX",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<number | null>(null);
  const [successStatus, setSuccessStatus] = useState<OrderStatus>("RECEIVED");
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackedOrder) return;
    setSuccessOrderId(trackedOrder.id);
    setSuccessNumber(trackedOrder.number);
    setSuccessStatus("RECEIVED");
    setPhone(trackedOrder.phone);
  }, [trackedOrder]);

  const selectedZone =
    fulfillment === "DELIVERY"
      ? deliveryZones.find((zone) =>
          zone.neighborhoods.some(
            (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
          ),
        ) ?? null
      : null;

  const matchedNeighborhood =
    selectedZone?.neighborhoods.find(
      (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
    ) ?? null;

  const availableNeighborhoods = Array.from(
    new Set(
      deliveryZones.flatMap((zone) => zone.neighborhoods.map((item) => item.trim()).filter(Boolean)),
    ),
  );
  const deliveryFee = selectedZone?.delivery_fee ?? 0;
  const total = subtotal + deliveryFee;

  const availablePayments = settings.payment_methods.length
    ? settings.payment_methods
    : (["PIX"] as PaymentMethod[]);

  const submitOrder = async () => {
    setError(null);

    if (!storeOpen) {
      setError(`A loja está fechada. ${storeStatusLabel}.`);
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setError("Informe seu nome e telefone.");
      return;
    }
    if (fulfillment === "DELIVERY") {
      if (!street.trim() || !number.trim() || !neighborhood.trim()) {
        setError("Para entrega, informe rua, número e bairro.");
        return;
      }
      if (deliveryZones.length > 0 && !selectedZone) {
        setError("Não encontramos uma área de entrega para esse bairro.");
        return;
      }
    }
    const minOrderAmount = Number(settings.min_order_amount ?? 0);
    if (
      fulfillment === "DELIVERY" &&
      minOrderAmount > 0 &&
      subtotal < minOrderAmount
    ) {
      setError(
        `Para entrega, o pedido mínimo é ${formatCurrency(minOrderAmount)}. Faltam ${formatCurrency(minOrderAmount - subtotal)}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        organization_id: organization.id,
        subtotal,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        fulfillment,
        payment_method: paymentMethod,
        address_street: fulfillment === "DELIVERY" ? street.trim() : null,
        address_number: fulfillment === "DELIVERY" ? number.trim() : null,
        address_neighborhood: fulfillment === "DELIVERY" ? (matchedNeighborhood ?? neighborhood.trim()) : null,
        address_complement: fulfillment === "DELIVERY" ? complement.trim() || null : null,
        address_reference: fulfillment === "DELIVERY" ? reference.trim() || null : null,
        notes: notes.trim() || null,
        idempotency_key: crypto.randomUUID(),
        items: items.flatMap((item) => [
          {
            product_id: item.productId,
            second_product_id: item.secondProductId,
            is_half: item.isHalf,
            size_id: item.sizeId,
            crust_id: item.crustId,
            quantity: item.quantity,
            notes: item.notes,
            addons: item.addons.map((addon) => ({ id: addon.id })),
          },
          ...(item.complements ?? []).map((complement) => ({
            product_id: complement.productId,
            second_product_id: null,
            is_half: false,
            size_id: null,
            crust_id: null,
            quantity: 1,
            notes: "Complemento do pedido: " + item.productName,
            addons: [],
          })),
        ]),
      };

      const { data: created, error: createError } = await supabase.rpc(
        "create_public_order",
        { p_order: payload },
      );
      if (createError) throw createError;

      const order = Array.isArray(created) ? created[0] : created;
      if (!order?.order_number || !order?.order_id) throw new Error("Não foi possível criar o pedido.");
      setSuccessOrderId(String(order.order_id));
      setSuccessNumber(Number(order.order_number));
      setSuccessStatus("RECEIVED");
      onSuccess({ id: String(order.order_id), number: Number(order.order_number), phone: phone.trim() });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : typeof submitError === "object" && submitError !== null && "message" in submitError
            ? String((submitError as { message?: unknown }).message ?? "Não foi possível enviar o pedido.")
            : "Não foi possível enviar o pedido.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!successOrderId) return;

    let cancelled = false;
    const loadStatus = async () => {
      const { data: tracking, error: trackingQueryError } = await supabase.rpc(
        "get_public_order_status",
        { p_order_id: successOrderId, p_customer_phone: phone.trim() },
      );

      if (cancelled) return;
      if (trackingQueryError) {
        setTrackingError("Não foi possível atualizar o status agora.");
        return;
      }

      const current = Array.isArray(tracking) ? tracking[0] : tracking;
      if (current?.status) {
        const currentStatus = current.status as OrderStatus;
        setSuccessStatus(currentStatus);
        setTrackingError(null);

        if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED") {
          onOrderFinished();
        }
      }
    };

    void loadStatus();
    const interval = window.setInterval(loadStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [successOrderId, phone, onOrderFinished]);

  if (successNumber != null && successOrderId != null) {
    return (
      <div className="ppp-checkout-panel fixed inset-0 z-[60] overflow-y-auto bg-background">
        <section className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
          <div className="rounded-[2rem] border bg-card p-6 shadow-lifted sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Check className="size-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Pedido recebido</p>
                <h2 className="mt-1 text-3xl">Pedido #{successNumber}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{organization.name}</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold">Acompanhe seu pedido</p>
              <div className="mt-4 space-y-3">
                {[
                  ["RECEIVED", "Pedido recebido"],
                  ["CONFIRMED", "Pedido confirmado"],
                  ["PREPARING", "Em preparo"],
                  ["READY", fulfillment === "DELIVERY" ? "Pedido pronto" : "Pronto para retirada"],
                  ["OUT_FOR_DELIVERY", "Saiu para entrega"],
                  ["DELIVERED", fulfillment === "DELIVERY" ? "Entregue" : "Retirado"],
                ].map(([value, label], index, steps) => {
                  const currentIndex = steps.findIndex(([step]) => step === successStatus);
                  const isDone = currentIndex >= 0 && index <= currentIndex;
                  const isCurrent = value === successStatus;
                  if (fulfillment === "PICKUP" && value === "OUT_FOR_DELIVERY") return null;
                  return (
                    <div key={value} className="flex items-center gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${isDone ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                        {isDone ? <Check className="size-4" /> : index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : ""}`}>{label}</p>
                        {isCurrent && <p className="text-xs text-muted-foreground">Status atualizado automaticamente.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-muted p-4 text-sm">
              <p className="font-semibold">
                {successStatus === "CANCELLED" ? "Pedido cancelado" :
                  successStatus === "DELIVERED" ? "Pedido finalizado" :
                  successStatus === "READY" && fulfillment === "PICKUP" ? "Pode retirar seu pedido" :
                  successStatus === "OUT_FOR_DELIVERY" ? "Seu pedido está a caminho!" :
                  "A loja está preparando seu pedido."}
              </p>
              <p className="mt-1 text-muted-foreground">
                {trackingError ?? "Esta tela verifica automaticamente se a loja atualizou o pedido."}
              </p>
            </div>

            <Button className="mt-6 h-12 w-full rounded-full" onClick={onClose}>
              Voltar ao cardápio
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto min-h-screen max-w-3xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Finalizar pedido</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">Quase lá</h1>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Fechar checkout">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Como você quer receber?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {settings.delivery_enabled && (
                  <button
                    onClick={() => setFulfillment("DELIVERY")}
                    className={`rounded-2xl border p-4 text-left transition-colors ${fulfillment === "DELIVERY" ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">Entrega</p>
                    <p className="mt-1 text-xs text-muted-foreground">Receba no seu endereço</p>
                  </button>
                )}
                {settings.pickup_enabled && (
                  <button
                    onClick={() => setFulfillment("PICKUP")}
                    className={`rounded-2xl border p-4 text-left transition-colors ${fulfillment === "PICKUP" ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">Retirada</p>
                    <p className="mt-1 text-xs text-muted-foreground">Retire na loja</p>
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Seus dados</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Telefone *</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
              </div>
            </section>

            {fulfillment === "DELIVERY" && (
              <section className="rounded-3xl border bg-card p-5 shadow-soft">
                <p className="text-sm font-semibold">Endereço de entrega</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Rua *</span>
                    <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, avenida..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Número *</span>
                    <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Bairro *</span>
                    <input
                      list="delivery-neighborhoods"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Seu bairro"
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                    {availableNeighborhoods.length > 0 && (
                      <datalist id="delivery-neighborhoods">
                        {availableNeighborhoods.map((item) => <option key={item} value={item} />)}
                      </datalist>
                    )}
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Complemento</span>
                    <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, casa..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Ponto de referência</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Próximo a..." className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary" />
                </label>
                {deliveryZones.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedZone
                      ? `Taxa de entrega: ${formatCurrency(deliveryFee)} · ${selectedZone.estimated_minutes ?? settings.estimated_delivery_minutes} min`
                      : availableNeighborhoods.length > 0 ? "Selecione ou digite um dos bairros atendidos para calcular a taxa." : "A loja ainda não cadastrou áreas de entrega."}
                  </p>
                )}
              </section>
            )}

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <p className="text-sm font-semibold">Pagamento</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {availablePayments.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-2xl border p-4 text-left ${paymentMethod === method ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background"}`}
                  >
                    <p className="font-semibold">
                      {method === "PIX" ? "PIX" : method === "CASH" ? "Dinheiro" : method === "CARD_ON_DELIVERY" ? "Cartão na entrega" : "Cartão no local"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {method === "PIX" ? "Pagamento via PIX" : "Pagamento combinado com a loja"}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-5 shadow-soft">
              <label htmlFor="checkout-notes" className="text-sm font-semibold">Observações do pedido</label>
              <Textarea id="checkout-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-3" placeholder="Ex.: tocar a campainha, tirar cebola..." maxLength={500} />
            </section>
          </div>

          <aside className="h-fit rounded-3xl border bg-card p-5 shadow-soft lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Resumo</p>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.quantity}× {item.productName}{item.secondProductName ? ` + ${item.secondProductName}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{[item.sizeName, item.crustName].filter(Boolean).join(" · ")}</p>
                    {(item.complements ?? []).length > 0 && <p className="mt-1 text-xs text-primary">+ {(item.complements ?? []).map((complement) => complement.productName).join(", ")}</p>}
                  </div>
                  <span className="font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {fulfillment === "DELIVERY" && (
                <div className="flex justify-between"><span className="text-muted-foreground">Entrega</span><span>{selectedZone ? formatCurrency(deliveryFee) : "—"}</span></div>
              )}
              <div className="flex justify-between pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
            {error && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button disabled={submitting || items.length === 0 || !storeOpen} onClick={submitOrder} className="mt-5 h-12 w-full rounded-full">
              {!storeOpen ? "Loja fechada" : submitting ? "Enviando pedido..." : `Enviar pedido · ${formatCurrency(total)}`}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
              Ao enviar, o pedido será encaminhado diretamente para a loja.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

