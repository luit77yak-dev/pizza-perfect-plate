import { useRef, useState } from "react";
import { Pizza, Plus } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { DemoConfigurator } from "./DemoConfigurator";
import { FornoCheckout } from "./experience/FornoCheckout";
import { FornoTracking } from "./experience/FornoTracking";
import { exampleDraft, cartDetails, cartAmounts } from "./engine/orders";
import type { Selection } from "./data/model";
import { useDemoData } from "./data/store";
import { demoCatalog, demoStyle } from "./data/catalog-adapter";
import {
  isAvailable,
  makeCartItem,
  minimumPrice,
  catalogToken,
  submitDemoOrder,
} from "./data/model";
import { CartPanel } from "@/features/cart/components/CartPanel";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem } from "@/lib/domain/types";

export function VisualDemo() {
  const { data: state, ready, warning, update } = useDemoData();
  const data = demoCatalog(state);
  const [token, setToken] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackedId, setTrackedId] = useState<number | undefined>();
  const [editOrigin, setEditOrigin] = useState<"cart" | "checkout">("cart");
  const submitting = useRef(false);
  const [draft, setDraft] = useState(() => exampleDraft());
  const [editing, setEditing] = useState<CartItem | null>(null);
  const [selections, setSelections] = useState<
    Record<string, { selection: Selection; notes: string }>
  >({});
  const stale = itemsChanged();
  function itemsChanged() {
    return token !== null && token !== catalogToken(state);
  }
  const [items, setItems] = useState<CartItem[]>([]);
  const [product, setProduct] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <div className="ppp-customer-shell ppp-forno-theme ppp-visual-demo" style={demoStyle(state)}>
      <div className="visual-demo-notice" role="note">
        DEMONSTRAÇÃO — Nenhum pedido será enviado. Utilize apenas dados fictícios.
      </div>
      <StorefrontHeader
        organizationName={state.store.name}
        logoUrl={state.store.logo || null}
        itemCount={items.reduce((n, item) => n + item.quantity, 0)}
        selectedTrackedOrdersCount={
          state.orders.filter((o) => o.name === "Visitante fictício").length
        }
        onOpenCart={() => setCartOpen(true)}
        onOpenTracking={() => setTrackingOpen(true)}
        isFornoTheme
      />
      <StorefrontHero
        organizationName={state.store.name}
        settings={data.settings}
        products={data.products}
        statusLabel={state.store.open ? "Aberta · simulação local" : "Fechada · simulação local"}
        isFornoTheme
      />
      {warning && (
        <p role="status" className="visual-demo-menu">
          {warning}
        </p>
      )}
      {confirmation && (
        <p role="status" className="visual-demo-menu">
          {confirmation}
        </p>
      )}
      <main id="cardapio" className="visual-demo-menu">
        {state.store.logo && (
          <img
            className="demo-store-logo"
            src={state.store.logo}
            alt={`Logo demonstrativo de ${state.store.name}`}
          />
        )}
        <h2>Cardápio de demonstração</h2>
        <p>Preços fictícios. Personalize sua pizza e experimente o carrinho local.</p>
        {data.categories
          .filter((c) => c.active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((category) => (
            <section key={category.id} aria-label={category.name}>
              <h3>{category.name}</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                {data.products
                  .filter(
                    (item) =>
                      item.category_id === category.id &&
                      state.products.some((p) => p.id === item.id && isAvailable(state, p)),
                  )
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="ppp-product-card group relative overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft"
                      disabled={!ready || !state.store.open}
                      onClick={() => setProduct(item.id)}
                      aria-label={`Personalizar ${item.name}`}
                    >
                      <div
                        data-without-image={!item.image_url || undefined}
                        className="ppp-product-card-image relative aspect-[1.32] overflow-hidden bg-card"
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="forno-product-placeholder">
                            <Pizza aria-hidden="true" strokeWidth={1.2} />
                          </div>
                        )}
                      </div>
                      <div className="forno-product-content p-4 sm:p-5">
                        <h3 className="mb-2 font-display">{item.name}</h3>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 pr-1">
                            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                              {category.name}
                            </p>
                            <p className="mt-2 text-sm leading-5 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span className="forno-product-price shrink-0 rounded-lg bg-primary/10 px-3 py-2 font-display text-sm font-semibold text-accent">
                            {formatCurrency(
                              minimumPrice(
                                state,
                                state.products.find((p) => p.id === item.id)!,
                              ),
                            )}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold uppercase tracking-[.08em]">
                          <span>Personalizar</span>
                          <Plus aria-hidden="true" size={20} />
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          ))}
      </main>
      <footer id="contato" className="visual-demo-menu">
        <h2 id="sobre">Uma casa fictícia, uma experiência real de navegação.</h2>
        <p>
          Sem cobrança ou dados reais. Configurações são salvas somente neste navegador. O carrinho
          é local à aba e apagado ao recarregar.
        </p>
        <p>{state.store.contact}</p>
        <p>{state.store.address}</p>
        <ul>
          {state.store.hours.map((h) => (
            <li key={h.weekday}>
              {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][h.weekday]}:{" "}
              {h.closed ? "Fechado" : `${h.opens}–${h.closes}`} · fictício
            </li>
          ))}
        </ul>
        <ul>
          {state.zones.map((z) => (
            <li key={z.id}>
              {z.name}: {formatCurrency(z.fee)}
            </li>
          ))}
        </ul>
      </footer>
      {product && (
        <DemoConfigurator
          key={editing?.lineId ?? product}
          productId={product}
          state={state}
          initialSelection={editing ? selections[editing.lineId]?.selection : undefined}
          initialQuantity={editing?.quantity}
          initialNotes={editing ? selections[editing.lineId]?.notes : undefined}
          onClose={() => {
            setProduct(null);
            if (editing) {
              setEditing(null);
              if (editOrigin === "checkout") setCheckoutOpen(true);
              else setCartOpen(true);
            }
          }}
          onAdd={(selection, quantity, notes) => {
            if (!state.store.open) throw Error("Loja fechada.");
            if (stale && items.length)
              throw Error("O catálogo mudou. Limpe o carrinho antes de adicionar.");
            const added = makeCartItem(state, product, selection, quantity, notes);
            if (editing) added.lineId = editing.lineId;
            setItems((current) =>
              editing
                ? current.map((i) => (i.lineId === editing.lineId ? added : i))
                : [...current, added],
            );
            setSelections((current) => ({ ...current, [added.lineId]: { selection, notes } }));
            if (editing) {
              setEditing(null);
              if (editOrigin === "checkout") setCheckoutOpen(true);
              else setCartOpen(true);
            } else setCartOpen(true);
            setToken(catalogToken(state));
            setProduct(null);
          }}
        />
      )}
      {cartOpen && (
        <CartPanel
          items={items}
          subtotal={cartAmounts(items, 0).subtotal}
          itemDetails={cartDetails}
          onContinueShopping={() => setCartOpen(false)}
          onEdit={(item) => {
            setEditOrigin("cart");
            setEditing(item);
            setProduct(item.productId);
            setCartOpen(false);
          }}
          onClose={() => setCartOpen(false)}
          onUpdate={(id, quantity) =>
            setItems((current) =>
              current.map((item) =>
                item.lineId === id
                  ? { ...item, quantity: Math.min(99, Math.max(1, quantity)) }
                  : item,
              ),
            )
          }
          onRemove={(id) => setItems((current) => current.filter((item) => item.lineId !== id))}
          onClear={() => {
            setItems([]);
            setSelections({});
            setToken(null);
          }}
          storeOpen={
            ready && state.store.open && (state.store.pickup || state.store.delivery) && !stale
          }
          storeStatusLabel={
            stale ? "Catálogo alterado — limpe e refaça o carrinho" : "Demonstração — loja fechada"
          }
          minOrderAmount={0}
          pickupEnabled={state.store.pickup}
          deliveryEnabled={state.store.delivery}
          onCheckout={() => {
            setCartOpen(false);
            setDraft((d) => ({ ...d, fulfillment: state.store.pickup ? "Retirada" : "Entrega" }));
            setCheckoutOpen(true);
          }}
        />
      )}
      {stale && items.length > 0 && (
        <p role="status" className="visual-demo-menu">
          O catálogo mudou. Os preços originais dos itens foram preservados. Limpe o carrinho e
          personalize novamente.
        </p>
      )}
      {trackingOpen && (
        <FornoTracking
          state={state}
          initialOrderId={trackedId}
          onClose={() => setTrackingOpen(false)}
        />
      )}
      {checkoutOpen && (
        <FornoCheckout
          state={state}
          items={items}
          draft={draft}
          setDraft={setDraft}
          stale={stale}
          onClose={() => setCheckoutOpen(false)}
          onCart={() => {
            setCheckoutOpen(false);
            setCartOpen(true);
          }}
          onEdit={(item) => {
            setEditOrigin("checkout");
            setEditing(item);
            setProduct(item.productId);
            setCheckoutOpen(false);
          }}
          onRemove={(id) => setItems((current) => current.filter((i) => i.lineId !== id))}
          onConfirm={(snapshot) => {
            if (submitting.current) return;
            submitting.current = true;
            try {
              const next = update((s) =>
                submitDemoOrder(
                  s,
                  items,
                  token ?? "",
                  draft.fulfillment,
                  draft.zoneId || null,
                  snapshot,
                ),
              );
              const created = next.orders.find((o) => o.requestId === snapshot.requestId)!;
              setTrackedId(created.id);
              setConfirmation(`Pedido #${created.id} simulado — nenhum pedido foi enviado.`);
              setItems([]);
              setSelections({});
              setToken(null);
              setDraft(exampleDraft());
              setCheckoutOpen(false);
              setTrackingOpen(true);
            } finally {
              submitting.current = false;
            }
          }}
        />
      )}
    </div>
  );
}
