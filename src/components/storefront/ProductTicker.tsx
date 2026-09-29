import type { Product } from "@/lib/domain/types";

type ProductTickerProps = {
  products: Product[];
};

export function ProductTicker({ products }: ProductTickerProps) {
  return (
    <div className="ppp-product-ticker mb-12 overflow-hidden border-y-2 border-secondary bg-secondary text-secondary-foreground" aria-hidden="true">
      <div className="ppp-ticker-run flex min-w-max items-center gap-8 py-4 font-display text-sm uppercase tracking-[.08em] text-white">
        {products.slice(0, 8).map((product) => <span key={product.id} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
        {products.slice(0, 8).map((product) => <span key={`ticker-${product.id}`} className="inline-flex items-center gap-8">{product.name}<span>✦</span></span>)}
      </div>
    </div>
  );
}
