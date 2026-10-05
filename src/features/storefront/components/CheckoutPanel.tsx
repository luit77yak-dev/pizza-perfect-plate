import { useState } from "react";
import { X } from "lucide-react";
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
} from "@/lib/domain/types";

export function CheckoutPanel({
  organization,
  settings,
  deliveryZones,
  items,
  subtotal,
  onClose,
  onSuccess,
  storeOpen,
  storeStatusLabel,
  existingOrder = null,
}: {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: (order: {
    id: string;
    number: number;
    phone: string;
    items?: CartItem[] | undefined;
    subtotal?: number | undefined;
    total?: number | undefined;
    fulfillment?: FulfillmentType | undefined;
    status?: string | undefined;
  }) => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  existingOrder?: {
    id: string;
    number: number;
    phone: string;
    items?: CartItem[] | undefined;
    subtotal?: number | undefined;
    total?: number | undefined;
    fulfillment?: FulfillmentType | undefined;
  } | null;
}) {
  const [fulfillment, setFulfillment] = useState<FulfillmentType>(
    existingOrder?.fulfillment ?? (settings.delivery_enabled ? "DELIVERY" : "PICKUP"),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    settings.payment_methods[0] ?? "PIX",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(existingOrder?.phone ?? "");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedZone =
    fulfillment === "DELIVERY"
      ? (deliveryZones.find((zone) =>
          zone.neighborhoods.some(
            (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
          ),
        ) ?? null)
      : null;

  const matchedNeighborhood =
    selectedZone?.neighborhoods.find(
      (item) => normalizeNeighborhood(item) === normalizeNeighborhood(neighborhood),
    ) ?? null;

  const availableNeighborhoods = Array.from(
    new Set(
      deliveryZones.flatMap((zone) =>
        zone.neighborhoods.map((item) => item.trim()).filter(Boolean),
      ),
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

    if (existingOrder) {
      if (items.length === 0) {
        setError("Adicione pelo menos um item.");
        return;
      }
      setSubmitting(true);
      try {
        const appendItems = items.flatMap((item) => [
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
        ]);
        const { data: appended, error: appendError } = await supabase.rpc(
          "append_public_order_items_with_payment",
          {
            p_order_id: existingOrder.id,
            p_customer_phone: existingOrder.phone,
            p_items: appendItems,
            p_payment_method: paymentMethod,
          },
        );
        if (appendError) throw appendError;
        const order = Array.isArray(appended) ? appended[0] : appended;
        if (!order?.order_number || !order?.order_id) {
          throw new Error("Não foi possível adicionar o complemento ao pedido.");
        }
        onSuccess({
          id: String(order.order_id),
          number: Number(order.order_number),
          phone: existingOrder.phone,
          items: [...(existingOrder.items ?? []), ...items],
          subtotal: Number(order.subtotal),
          total: Number(order.total),
          fulfillment: existingOrder.fulfillment,
        });
      } catch (appendError) {
        const message =
          appendError instanceof Error
            ? appendError.message
            : typeof appendError === "object" && appendError !== null && "message" in appendError
              ? String((appendError as { message?: unknown }).message ?? "Não foi possível adicionar o complemento.")
              : "Não foi possível adicionar o complemento.";
        setError(message);
      } finally {
        setSubmitting(false);
      }
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
      if (deliveryZones.length === 0 || availableNeighborhoods.length === 0) {
        setError("A loja ainda não cadastrou bairros para entrega.");
        return;
      }
      if (!matchedNeighborhood || !selectedZone) {
        setError("Selecione um bairro atendido pela loja.");
        return;
      }
    }
    const minOrderAmount = Number(settings.min_order_amount ?? 0);
    if (fulfillment === "DELIVERY" && minOrderAmount > 0 && subtotal < minOrderAmount) {
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
        address_neighborhood:
          fulfillment === "DELIVERY" ? (matchedNeighborhood ?? neighborhood.trim()) : null,
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

      const { data: created, error: createError } = await supabase.rpc("create_public_order", {
        p_order: payload,
      });
      if (createError) throw createError;

      const order = (Array.isArray(created) ? created[0] : created) as { order_id?: string; order_number?: number; total?: number } | null | undefined;
      if (!order?.order_number || !order?.order_id)
        throw new Error("Não foi possível criar o pedido.");
      const createdTotal = Number(order.total);
      const fallbackTotal =
        fulfillment === "DELIVERY"
          ? subtotal + Number(selectedZone?.delivery_fee ?? 0)
          : subtotal;

      onSuccess({
        id: String(order.order_id),
        number: Number(order.order_number),
        phone: phone.trim(),
        items,
        subtotal,
        total: Number.isFinite(createdTotal) ? createdTotal : fallbackTotal,
        fulfillment,
        status: "RECEIVED",
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : typeof submitError === "object" && submitError !== null && "message" in submitError
            ? String(
                (submitError as { message?: unknown }).message ??
                  "Não foi possível enviar o pedido.",
              )
            : "Não foi possível enviar o pedido.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-black/70 backdrop-blur-md">
      <div className="mx-auto min-h-screen max-w-4xl bg-[#06282d] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-0 text-[#f4eee2] sm:px-6">
        <div className="sticky top-0 z-30 -mx-4 mb-2 flex items-center justify-between gap-4 border-b border-[#f4eee2]/10 bg-[#06282d]/95 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl sm:-mx-6 sm:px-6 sm:py-5">
          <div>
            <p className="text-sm text-[#f4eee2]/60">
              {existingOrder ? "Complementar pedido" : "Passo final"}
            </p>
            <h1 className="mt-0.5 font-display text-[32px] font-medium leading-tight sm:text-4xl">{existingOrder ? `Pedido #${existingOrder.number}` : "Quase lá"}</h1>
          </div>
          <button
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#f4eee2]/20 text-[#f4eee2] transition hover:bg-white/10"
            aria-label="Fechar checkout"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            {!existingOrder && (
            <section className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
              <h2 className="font-display text-xl font-medium">Como você quer receber?</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {settings.delivery_enabled && (
                  <button
                    onClick={() => setFulfillment("DELIVERY")}
                    className={`min-h-[72px] rounded-2xl border p-4 text-left transition-colors ${fulfillment === "DELIVERY" ? "border-primary bg-primary/10" : "border-[#f4eee2]/12 bg-[#041e22] hover:border-[#f4eee2]/30"}`}
                  >
                    <p className="text-base font-medium">Entrega</p>
                    <p className="mt-1 text-[13px] text-[#f4eee2]/60">Receba no seu endereço</p>
                  </button>
                )}
                {settings.pickup_enabled && (
                  <button
                    onClick={() => setFulfillment("PICKUP")}
                    className={`min-h-[72px] rounded-2xl border p-4 text-left transition-colors ${fulfillment === "PICKUP" ? "border-primary bg-primary/10" : "border-[#f4eee2]/12 bg-[#041e22] hover:border-[#f4eee2]/30"}`}
                  >
                    <p className="text-base font-medium">Retirada</p>
                    <p className="mt-1 text-[13px] text-[#f4eee2]/60">Retire na loja, sem pedido mínimo</p>
                  </button>
                )}
              </div>
            </section>
            )}

            {!existingOrder && (
            <section className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
              <h2 className="font-display text-xl font-medium">Seus dados</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                    Nome *
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                    Telefone *
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                  />
                </label>
              </div>
            </section>
            )}

            {!existingOrder && fulfillment === "DELIVERY" && (
              <section className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
                <h2 className="font-display text-xl font-medium">Endereço de entrega</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                      Rua *
                    </span>
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Rua, avenida..."
                      className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                      Número *
                    </span>
                    <input
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="123"
                      className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                      Bairro *
                    </span>
                    <select
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      disabled={availableNeighborhoods.length === 0}
                      className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {availableNeighborhoods.length > 0
                          ? "Selecione seu bairro"
                          : "Nenhum bairro cadastrado"}
                      </option>
                      {availableNeighborhoods.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                      Complemento
                    </span>
                    <input
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto, casa..."
                      className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1.5 block text-[13px] text-[#f4eee2]/65">
                    Ponto de referência
                  </span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Próximo a..."
                    className="h-12 w-full rounded-xl border border-[#f4eee2]/15 bg-[#041e22] px-3.5 text-[#f4eee2] outline-none placeholder:text-[#f4eee2]/35 focus:border-primary"
                  />
                </label>
                {deliveryZones.length > 0 && (
                  <p className="mt-3 text-xs text-[#f4eee2]/60">
                    {selectedZone
                      ? `Taxa de entrega: ${formatCurrency(deliveryFee)} · ${selectedZone.estimated_minutes ?? settings.estimated_delivery_minutes} min`
                      : availableNeighborhoods.length > 0
                        ? "Selecione um bairro cadastrado para calcular a taxa."
                        : "A loja ainda não cadastrou áreas de entrega."}
                  </p>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
              <h2 className="font-display text-xl font-medium">Pagamento</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {availablePayments.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-[72px] rounded-2xl border p-4 text-left transition-colors ${paymentMethod === method ? "border-primary bg-primary/10" : "border-[#f4eee2]/12 bg-[#041e22] hover:border-[#f4eee2]/30"}`}
                  >
                    <p className="text-base font-medium">
                      {method === "PIX"
                        ? "PIX"
                        : method === "CASH"
                          ? "Dinheiro"
                          : method === "CARD_ON_DELIVERY"
                            ? "Cartão na entrega"
                            : "Cartão no local"}
                    </p>
                    <p className="mt-1 text-xs text-[#f4eee2]/60">
                      {method === "PIX" ? "Pagamento via PIX" : "Pagamento combinado com a loja"}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {!existingOrder && (
            <section className="rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5">
              <label htmlFor="checkout-notes" className="font-display text-xl font-medium">
                Observações do pedido
              </label>
              <Textarea
                id="checkout-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-3 min-h-[88px] rounded-xl border-[#f4eee2]/15 bg-[#041e22] text-[#f4eee2] placeholder:text-[#f4eee2]/35"
                placeholder="Ex.: tocar a campainha, tirar cebola..."
                maxLength={500}
              />
            </section>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-[#f4eee2]/12 bg-[#0a3035] p-5 lg:sticky lg:top-6">
            <h2 className="font-display text-xl font-medium">Resumo do pedido</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.quantity}× {item.productName}
                      {item.secondProductName ? ` + ${item.secondProductName}` : ""}
                    </p>
                    <p className="text-xs text-[#f4eee2]/60">
                      {[item.sizeName, item.crustName].filter(Boolean).join(" · ")}
                    </p>
                    {(item.complements ?? []).length > 0 && (
                      <p className="mt-1 text-[13px] text-[#f3ad4b]">
                        +{" "}
                        {(item.complements ?? [])
                          .map((complement) => complement.productName)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="font-display text-base text-[#f3ad4b]">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t border-[#f4eee2]/10" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#f4eee2]/60">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {!existingOrder && fulfillment === "DELIVERY" && (
                <div className="flex justify-between">
                  <span className="text-[#f4eee2]/60">Entrega</span>
                  <span>{selectedZone ? formatCurrency(deliveryFee) : "—"}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-base">Total</span>
                <span className="font-display text-[28px] font-medium text-[#f3ad4b]">{formatCurrency(total)}</span>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/15 p-3 text-sm text-[#ffb4a8]">
                {error}
              </p>
            )}
            <Button
              disabled={submitting || items.length === 0 || !storeOpen}
              onClick={submitOrder}
              className="mt-5 h-14 w-full rounded-2xl bg-primary text-base font-semibold text-[#1b0f08] hover:brightness-105 disabled:bg-[#f4eee2]/10 disabled:text-[#f4eee2]/50"
            >
              {!storeOpen
                ? "Loja fechada"
                : submitting
                  ? "Enviando pedido..."
                  : existingOrder
                    ? `Confirmar complemento · ${formatCurrency(subtotal)}`
                    : `Enviar pedido · ${formatCurrency(total)}`}
            </Button>
            <p className="mt-3 text-center text-[13px] leading-5 text-[#f4eee2]/55">
              {existingOrder
                ? "O complemento será adicionado ao pedido em andamento após a confirmação."
                : "Ao enviar, o pedido será encaminhado diretamente para a loja."}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
