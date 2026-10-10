import { useState } from "react";
import { Pizza, Plus } from "lucide-react";
import { StorefrontHeader } from "@/components/storefront/StorefrontHeader";
import { StorefrontHero } from "@/components/storefront/StorefrontHero";
import { ProductConfigurator } from "@/features/storefront/components/ProductConfigurator";
import { CartPanel } from "@/features/cart/components/CartPanel";
import { calculateCartSubtotal } from "@/lib/domain/pricing";
import { formatCurrency } from "@/lib/domain/money";
import type { CartItem, Product } from "@/lib/domain/types";
import { createDemoCatalog } from "./catalog";

export function VisualDemo() {
  const [data] = useState(createDemoCatalog);
  const [items, setItems] = useState<CartItem[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <div className="ppp-customer-shell ppp-forno-theme ppp-visual-demo">
      <div className="visual-demo-notice" role="note">
        DEMONSTRAÇÃO — Nenhum pedido será enviado. Utilize apenas dados fictícios.
      </div>
      <StorefrontHeader
        organizationName="Forno di Pietra"
        logoUrl={null}
        itemCount={items.reduce((n, item) => n + item.quantity, 0)}
        selectedTrackedOrdersCount={0}
        onOpenCart={() => setCartOpen(true)}
        onOpenTracking={() => {}}
        isFornoTheme
      />
      <StorefrontHero
        organizationName="Forno di Pietra"
        settings={data.settings}
        products={data.products}
        statusLabel="Horário fictício: 18h às 23h"
        isFornoTheme
      />
      <main id="cardapio" className="visual-demo-menu">
        <h2>Cardápio de demonstração</h2>
        <p>Preços fictícios. Personalize sua pizza e experimente o carrinho local.</p>
        {data.categories.map((category) => (
          <section key={category.id} aria-label={category.name}>
            <h3>{category.name}</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {data.products
                .filter((item) => item.category_id === category.id)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ppp-product-card group relative overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft"
                    onClick={() => setProduct(item)}
                    aria-label={`Personalizar ${item.name}`}
                  >
                    <div
                      data-without-image
                      className="ppp-product-card-image relative aspect-[1.32] overflow-hidden bg-card"
                    >
                      <div className="forno-product-placeholder">
                        <Pizza aria-hidden="true" strokeWidth={1.2} />
                      </div>
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
                          {formatCurrency(item.base_price)}
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
          Sem entrega, cobrança ou dados de estabelecimentos reais. O carrinho é apagado ao
          recarregar esta página.
        </p>
      </footer>
      {product && (
        <ProductConfigurator
          product={product}
          data={data}
          onClose={() => setProduct(null)}
          onAdded={(added) => {
            setItems((current) => [...current, ...added]);
            setProduct(null);
          }}
        />
      )}
      {cartOpen && (
        <CartPanel
          items={items}
          subtotal={calculateCartSubtotal(items)}
          onClose={() => setCartOpen(false)}
          onUpdate={(id, quantity) =>
            setItems((current) =>
              current.map((item) =>
                item.lineId === id ? { ...item, quantity: Math.max(1, quantity) } : item,
              ),
            )
          }
          onRemove={(id) => setItems((current) => current.filter((item) => item.lineId !== id))}
          onClear={() => setItems([])}
          storeOpen={false}
          storeStatusLabel="Demonstração — checkout indisponível"
          minOrderAmount={0}
          pickupEnabled={false}
          deliveryEnabled={false}
          onCheckout={() => {}}
        />
      )}
    </div>
  );
}
