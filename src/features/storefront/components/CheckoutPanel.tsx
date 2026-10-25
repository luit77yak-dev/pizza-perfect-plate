import { rememberPrivateTrackingToken } from "@/lib/domain/private-tracking-capability";
import {
  cartReference,
  durableIntentState,
  withDurableCheckoutIntent,
} from "@/core/delivery/durable-checkout-intent";
import { cartOrderLines } from "@/core/delivery/cart-order-lines";
import type { PublicCatalog } from "@/core/delivery/services/public-catalog";
import { bindRequestIntent } from "@/core/delivery/request-intent";
import { validateCustomerDetails } from "@/core/delivery/customer-details";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/money";
import {
  readBuyerAmendmentToken,
  rememberBuyerAmendmentToken,
} from "@/lib/domain/order-amendment-capability";
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
  groupCatalog = null,
  instanceId,
  storeDomain,
  settings,
  deliveryZones,
  items,
  subtotal,
  onClose,
  onSuccess,
  onReviewPrices,
  storeOpen,
  storeStatusLabel,
  existingOrder = null,
}: {
  groupCatalog?: PublicCatalog | null;
  organization: Organization;
  instanceId: string;
  storeDomain: string;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onReviewPrices?: () => Promise<void>;
  onSuccess: (order: {
    recoveryPayload?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
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
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [priceReviewRequired, setPriceReviewRequired] = useState(false);
  const [reviewingPrices, setReviewingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A retry after a partial server failure must reuse its original key.
  const checkoutKeyRef = useRef<string | null>(null);
  const amendmentKeyRef = useRef<string | null>(null);
  const checkoutIntentRef = useRef<string | null>(null);
  const amendmentIntentRef = useRef<string | null>(null);

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

  const recoveryEnabled = import.meta.env["VITE_NEROXA_DURABLE_CHECKOUT_INTENTS"] === "true";
  const recovering =
    recoveryEnabled &&
    (() => {
      try {
        return durableIntentState(window.localStorage, instanceId) !== null;
      } catch {
        return true;
      }
    })();
  const submitOrder = async () => {
    if (priceReviewRequired || reviewingPrices || submitting) return;
    setError(null);

    if (!storeOpen && !recovering) {
      setError(`A loja está fechada. ${storeStatusLabel}.`);
      return;
    }

    // Only the domain-resolved store context may be used by this checkout.
    if (!instanceId || !storeDomain) {
      setError("Não foi possível identificar esta loja e seu domínio. Recarregue o cardápio.");
      return;
    }

    if (existingOrder) {
      if (items.length === 0) {
        setError("Adicione pelo menos um item.");
        return;
      }
      let appendItems: ReturnType<typeof cartOrderLines>;
      try {
        appendItems = cartOrderLines(items, groupCatalog);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Seleções inválidas.");
        return;
      }

      // With the secure checkout enabled, never call the historic phone-only
      // RPC: a buyer needs the private capability issued at order creation.
      if (import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true") {
        if (import.meta.env["VITE_NEROXA_CHECKOUT_AMENDMENTS"] !== "true") {
          setError("Adicionar itens com segurança ainda não está disponível nesta loja.");
          return;
        }
        const token = readBuyerAmendmentToken(instanceId, existingOrder.id);
        if (!token) {
          setError("A autorização deste pedido não está disponível nesta sessão.");
          return;
        }
        setSubmitting(true);
        try {
          const requestKey = (amendmentKeyRef.current ??= crypto.randomUUID());
          amendmentIntentRef.current = bindRequestIntent(amendmentIntentRef.current, {
            instanceId,
            orderId: existingOrder.id,
            items: appendItems,
          });
          const response = await fetch("/api/order-amend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              instance_id: instanceId,
              order_id: existingOrder.id,
              request_key: requestKey,
              token,
              items: appendItems,
            }),
          });
          const reply = (await response.json()) as {
            error?: string;
            code?: string;
            order_id?: string;
            order_number?: number;
            subtotal?: number;
            total?: number;
            payment_state?: string;
          };
          if (response.status === 409 && reply.code === "PRICE_CHANGED") {
            setPriceReviewRequired(true);
            amendmentKeyRef.current = null;
            amendmentIntentRef.current = null;
          }
          if (!response.ok) throw new Error(reply.error ?? "Complemento seguro indisponível.");
          if (!reply.order_id || !reply.order_number || reply.payment_state !== "NOT_SETTLED") {
            throw new Error("Não foi possível confirmar a inclusão do item.");
          }
          amendmentKeyRef.current = null;
          amendmentIntentRef.current = null;
          onSuccess({
            id: reply.order_id,
            number: reply.order_number,
            phone: existingOrder.phone,
            items: [...(existingOrder.items ?? []), ...items],
            subtotal: Number(reply.subtotal),
            total: Number(reply.total),
            fulfillment: existingOrder.fulfillment,
          });
        } catch (amendError) {
          setError(
            amendError instanceof Error ? amendError.message : "Não foi possível adicionar o item.",
          );
        } finally {
          setSubmitting(false);
        }
        return;
      }

      // Phone/UUID never authorize an amendment, including when the gateway is off.
      setError("Alteração segura indisponível. Solicite atendimento da loja.");
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
        instance_id: instanceId,
        store_domain: storeDomain,
        subtotal,
        ...(groupCatalog ? { expected_total: Math.round(total * 100) / 100 } : {}),
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
        idempotency_key: (checkoutKeyRef.current ??= crypto.randomUUID()),
        items: cartOrderLines(items, groupCatalog, recovering),
        ...(import.meta.env["VITE_NEROXA_DURABLE_CHECKOUT_INTENTS"] === "true"
          ? { client_cart_reference: await cartReference(items.map((item) => item.lineId)) }
          : {}),
      };

      const detailsError = validateCustomerDetails(payload);
      if (detailsError) throw new Error(detailsError);
      if (!recoveryEnabled)
        checkoutIntentRef.current = bindRequestIntent(checkoutIntentRef.current, payload);

      // Opt-in only while trusted ingress, credentials and the backend release gate
      // are being validated. Gateway errors NEVER fall back to the public RPC.
      let created: unknown;
      let recoveryPayload: Record<string, unknown> | undefined;
      if (import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true") {
        const send = async (
          requestPayload: Record<string, unknown>,
          resolve: (rolledBack?: boolean) => void,
        ) => {
          const response = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ p_order: requestPayload }),
          });
          const reply = (await response.json()) as {
            error?: string;
            code?: string;
            order_id?: string;
            order_number?: number;
            total?: number;
            amendment_token?: string;
            tracking_token?: string;
            snapshot?: Record<string, unknown>;
          };
          if (response.status === 409 && reply.code === "PRICE_CHANGED") {
            resolve(true);
            setPriceReviewRequired(true);
            checkoutKeyRef.current = null;
            checkoutIntentRef.current = null;
          }
          if (!response.ok) throw new Error(reply.error ?? "Checkout seguro indisponível.");
          if (!reply.order_id || !reply.order_number || !Number.isFinite(Number(reply.total)))
            throw new Error("Resposta incerta do checkout; recupere a mesma tentativa.");
          if (recoveryEnabled && (!reply.snapshot || reply.snapshot["instance_id"] !== instanceId))
            throw new Error(
              "Resposta incerta: backend não confirmou o contrato de recuperação desta loja.",
            );
          recoveryPayload = requestPayload;
          resolve();
          return reply;
        };
        if (import.meta.env["VITE_NEROXA_DURABLE_CHECKOUT_INTENTS"] === "true") {
          if (!groupCatalog || !navigator.locks)
            throw new Error("Recuperação segura indisponível; pedido não enviado.");
          let storage: Storage;
          try {
            storage = window.localStorage;
          } catch {
            throw new Error(
              "Armazenamento indisponível. Nenhum pedido foi enviado; solicite reconciliação segura antes de repetir uma tentativa incerta.",
            );
          }
          created = await withDurableCheckoutIntent(instanceId, payload, send, {
            storage,
            locks: navigator.locks,
          });
        } else created = await send(payload, () => {});
      } else {
        // A disabled gateway suspends creation; never downgrade to public RPC.
        throw new Error("Checkout seguro indisponível. Solicite atendimento da loja.");
      }

      const order = (Array.isArray(created) ? created[0] : created) as
        | {
            order_id?: string;
            order_number?: number;
            total?: number;
            amendment_token?: string;
            tracking_token?: string;
            snapshot?: Record<string, unknown>;
          }
        | null
        | undefined;
      if (!order?.order_number || !order?.order_id)
        throw new Error("Não foi possível criar o pedido.");
      if (order.tracking_token)
        rememberPrivateTrackingToken(instanceId, String(order.order_id), order.tracking_token);
      const createdTotal = Number(order.total);
      const fallbackTotal =
        fulfillment === "DELIVERY" ? subtotal + Number(selectedZone?.delivery_fee ?? 0) : subtotal;

      if (
        import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true" &&
        import.meta.env["VITE_NEROXA_CHECKOUT_AMENDMENTS"] === "true" &&
        order.amendment_token
      ) {
        // Capability is never stored in tracking/history localStorage.
        rememberBuyerAmendmentToken(instanceId, String(order.order_id), order.amendment_token);
      }
      onSuccess({
        ...(recoveryEnabled && recoveryPayload
          ? { recoveryPayload, ...(order.snapshot ? { snapshot: order.snapshot } : {}) }
          : {}),
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
    <div className="ppp-checkout-panel fixed inset-0 z-[140] overflow-y-auto bg-black/70 backdrop-blur-md">
      <div className="mx-auto min-h-screen max-w-4xl bg-[#06282d] px-4 pb-10 pt-0 text-[#f4eee2] sm:px-6">
        <div className="sticky top-0 z-30 -mx-4 mb-2 flex items-center justify-between gap-4 border-b border-white/10 bg-[#06282d]/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 sm:py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
              {existingOrder ? "Complementar pedido" : "Finalizar pedido"}
            </p>
            <h1 className="mt-1 text-3xl sm:text-4xl">
              {existingOrder ? `Pedido #${existingOrder.number}` : "Quase lá"}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-white/15 bg-white/[.06] text-white transition hover:bg-white/10"
            aria-label="Fechar checkout"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            {!existingOrder && (
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
            )}

            {!existingOrder && (
              <section className="rounded-3xl border bg-card p-5 shadow-soft">
                <p className="text-sm font-semibold">Seus dados</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Nome *
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Telefone *
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </section>
            )}

            {!existingOrder && fulfillment === "DELIVERY" && (
              <section className="rounded-3xl border bg-card p-5 shadow-soft">
                <p className="text-sm font-semibold">Endereço de entrega</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Rua *
                    </span>
                    <input
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Rua, avenida..."
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Número *
                    </span>
                    <input
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="123"
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Bairro *
                    </span>
                    <select
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      disabled={availableNeighborhoods.length === 0}
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
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
                    <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Complemento
                    </span>
                    <input
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto, casa..."
                      className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Ponto de referência
                  </span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Próximo a..."
                    className="h-11 w-full rounded-xl border bg-background px-3 outline-none focus:border-primary"
                  />
                </label>
                {deliveryZones.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedZone
                      ? `Taxa de entrega: ${formatCurrency(deliveryFee)} ${selectedZone.estimated_minutes ?? settings.estimated_delivery_minutes} min`
                      : availableNeighborhoods.length > 0
                        ? "Selecione um bairro cadastrado para calcular a taxa."
                        : "A loja ainda não cadastrou áreas de entrega."}
                  </p>
                )}
              </section>
            )}

            {!(
              existingOrder &&
              import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true" &&
              import.meta.env["VITE_NEROXA_CHECKOUT_AMENDMENTS"] === "true"
            ) && (
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
                        {method === "PIX"
                          ? "PIX"
                          : method === "CASH"
                            ? "Dinheiro"
                            : method === "CARD_ON_DELIVERY"
                              ? "Cartão na entrega"
                              : "Cartão no local"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {method === "PIX" ? "Pagamento via PIX" : "Pagamento combinado com a loja"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {existingOrder &&
              import.meta.env["VITE_NEROXA_CHECKOUT_GATEWAY"] === "true" &&
              import.meta.env["VITE_NEROXA_CHECKOUT_AMENDMENTS"] === "true" && (
                <section className="rounded-3xl border bg-card p-5 text-sm">
                  <p className="font-semibold">Valor adicional pendente</p>
                  <p className="mt-2 text-muted-foreground">
                    Adicionar itens não confirma nem cobra o pagamento. Combine a diferença com o
                    estabelecimento; ela será registrada como não liquidada.
                  </p>
                </section>
              )}

            {!existingOrder && (
              <section className="rounded-3xl border bg-card p-5 shadow-soft">
                <label htmlFor="checkout-notes" className="text-sm font-semibold">
                  Observações do pedido
                </label>
                <Textarea
                  id="checkout-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-3"
                  placeholder="Ex.: tocar a campainha, tirar cebola..."
                  maxLength={500}
                />
              </section>
            )}
          </div>

          <aside className="h-fit rounded-3xl border bg-card p-5 shadow-soft lg:sticky lg:top-6">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Resumo</p>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.lineId} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.quantity}× {item.productName}
                      {item.secondProductName ? ` + ${item.secondProductName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[item.sizeName, item.crustName].filter(Boolean).join(" ")}
                    </p>
                    {(item.complements ?? []).length > 0 && (
                      <p className="mt-1 text-xs text-primary">
                        +{" "}
                        {(item.complements ?? [])
                          .map((complement) => complement.productName)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="my-4 border-t" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {!existingOrder && fulfillment === "DELIVERY" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>{selectedZone ? formatCurrency(deliveryFee) : ""}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            {reviewNotice && (
              <p role="status" className="mt-4 text-sm text-muted-foreground">
                {reviewNotice}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {priceReviewRequired && (
              <Button
                className="mt-4 w-full"
                disabled={reviewingPrices || !onReviewPrices}
                onClick={async () => {
                  if (!onReviewPrices || reviewingPrices) return;
                  setReviewingPrices(true);
                  try {
                    await onReviewPrices();
                    setPriceReviewRequired(false);
                    setError(null);
                    setReviewNotice(
                      "Valores atualizados. Confira o resumo antes de confirmar novamente.",
                    );
                  } catch (reviewError) {
                    setError(
                      reviewError instanceof Error
                        ? reviewError.message
                        : "Catálogo indisponível. Tente revisar novamente.",
                    );
                  } finally {
                    setReviewingPrices(false);
                  }
                }}
              >
                {reviewingPrices ? "Atualizando valores..." : "Revisar preços"}
              </Button>
            )}
            <Button
              disabled={
                submitting ||
                reviewingPrices ||
                priceReviewRequired ||
                items.length === 0 ||
                (!storeOpen && !recovering)
              }
              onClick={submitOrder}
              className="mt-5 h-12 w-full rounded-full"
            >
              {!storeOpen && !recovering
                ? "Loja fechada"
                : submitting
                  ? "Enviando pedido..."
                  : recovering && !existingOrder
                    ? `Recuperar tentativa ${formatCurrency(total)}`
                    : existingOrder
                      ? `Confirmar complemento ${formatCurrency(subtotal)}`
                      : `Enviar pedido ${formatCurrency(total)}`}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
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
