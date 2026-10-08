import { Pizza, Plus } from "lucide-react";
import type { Category, Product } from "@/lib/domain/types";
import type { StorefrontTheme } from "@/features/storefront/themes/types";
import { formatCurrency } from "@/lib/domain/money";

type Props = { theme: StorefrontTheme; product: Product; category?: Category; index: number; displayPrice: number; imageUrl?: string; onSelect: (product: Product) => void; onAddSimple: (product: Product) => void; };

export function StorefrontProductCard({theme,product,category,index,displayPrice,imageUrl,onSelect,onAddSimple}: Props) {
  const isPizza = theme.id === "neroxa-classic";
  const isBurger = theme.id === "burger-club";
  const categoryName = category?.name ?? (isBurger ? "Hambúrguer" : "Pizza");
  return (
    <button type="button" onClick={() => product.kind === "PIZZA" ? onSelect(product) : onAddSimple(product)}
      className={isPizza ? "pc-menu-card group relative grid w-full overflow-hidden text-left" : isBurger ? "hc-menu-card group relative grid w-full overflow-hidden text-left" : "ppp-product-card group relative overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lifted"}>
      <div className={isPizza ? "pc-menu-image relative h-full min-h-0 overflow-hidden" : isBurger ? "hc-menu-image relative h-full min-h-0 overflow-hidden" : "ppp-product-card-image relative aspect-[1.32] overflow-hidden bg-card"}>
        {imageUrl ? <img src={imageUrl} alt={product.name} loading={index < 2 ? "eager" : "lazy"} className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" /> : <div className="grid size-full place-items-center text-[#ffc15e]/50"><Pizza className="size-12" strokeWidth={1.2} /></div>}
        {product.featured && <span className={isPizza ? "pc-menu-badge" : isBurger ? "hc-menu-badge" : "absolute left-4 top-4 rounded-full bg-[#ffc15e] px-4 py-2 text-[11px] font-bold text-[#0e0c0b]"}>Destaque</span>}
      </div>
      {isPizza ? <div className="pc-menu-content relative min-w-0"><div className="pc-menu-text"><p className="pc-menu-eyebrow">{categoryName}</p><h3>{product.name}</h3><span className="pc-menu-price">{formatCurrency(displayPrice)}</span><p className="pc-menu-desc">{product.description || "Uma pizza preparada para você."}</p></div><span className="pc-menu-add" aria-hidden="true"><Plus className="size-6" strokeWidth={2} /></span></div>
      : isBurger ? <div className="hc-menu-content relative min-w-0"><div className="hc-menu-text"><p className="hc-menu-eyebrow">{categoryName}</p><h3>{product.name}</h3><span className="hc-menu-price">{formatCurrency(displayPrice)}</span><p className="hc-menu-desc">{product.description || "Hambúrguer artesanal, ingredientes selecionados e molho da casa."}</p></div><span className="hc-menu-add" aria-hidden="true"><Plus className="size-6" strokeWidth={2} /></span></div>
      : <div className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 pr-1"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{categoryName}</p><p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{product.description || "Uma opção preparada para você."}</p></div><span className="shrink-0 rounded-lg bg-primary/10 px-3 py-2 font-display text-sm font-semibold text-accent">{formatCurrency(displayPrice)}</span></div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold uppercase tracking-[.08em]"><span>{product.allow_half ? "Meio a meio" : "Personalizar"}</span><span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background"><span aria-hidden="true" className="text-primary">+</span></span></div></div>}
    </button>
  );
}
