import { ArrowRight } from "lucide-react";
import type { Category, Product } from "@/lib/domain/types";
import type { StorefrontTheme } from "@/features/storefront/themes/types";
import { getPrice } from "@/core/delivery/services/store-rules";
import { StorefrontCategoryNav } from "./StorefrontCategoryNav";
import { StorefrontProductCard } from "./StorefrontProductCard";

type Props = { theme: StorefrontTheme; categories: Category[]; products: Product[]; sizes: { id: string }[]; prices: Parameters<typeof getPrice>[2]; categoryProducts: Map<string, number>; selectedCategory: string; onSelectCategory: (value: string) => void; searchTerm: string; onSearchTermChange: (value: string) => void; onSelectProduct: (product: Product) => void; onAddSimpleProduct: (product: Product) => void; imageFallbacks?: Record<string, string>; };

export function StorefrontMenu({theme,categories,products,sizes,prices,categoryProducts,selectedCategory,onSelectCategory,searchTerm,onSearchTermChange,onSelectProduct,onAddSimpleProduct,imageFallbacks={}}: Props) {
  const isPizza = theme.id === "neroxa-classic";
  const isBurger = theme.id === "burger-club";
  return (
    <section id="cardapio" className="ppp-reference-menu mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
      {isPizza ? <><StorefrontCategoryNav {...{theme,categories,products,categoryProducts,selectedCategory,onSelectCategory,searchTerm,onSearchTermChange}} /><div className="pc-menu-title"><h2>Mais pedidas</h2><button type="button" onClick={() => onSelectCategory("all")}>Ver todas <ArrowRight className="size-4" strokeWidth={2} /></button></div></>
      : isBurger ? <><StorefrontCategoryNav {...{theme,categories,products,categoryProducts,selectedCategory,onSelectCategory,searchTerm,onSearchTermChange}} /><div className="hc-menu-title"><h2>Mais pedidas</h2><button type="button" onClick={() => onSelectCategory("all")}>Ver todas <ArrowRight className="size-4" strokeWidth={2} /></button></div></>
      : <><div className="ppp-reference-menu-heading mb-8 flex flex-col items-start justify-center gap-3 text-left"><p className="text-xs font-semibold uppercase tracking-[.35em] text-primary">Cardápio</p><h2 className="mt-1 max-w-3xl text-4xl leading-[.95] sm:text-6xl">Escolha seu <em>burger.</em></h2><p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Assadas a 450 graus em menos de dois minutos.</p></div><StorefrontCategoryNav {...{theme,categories,products,categoryProducts,selectedCategory,onSelectCategory,searchTerm,onSearchTermChange}} /></>}
      {products.length === 0 ? <div className="rounded-3xl border border-dashed bg-card p-12 text-center"><p className="font-medium">Nenhum produto nesta categoria.</p><p className="mt-1 text-sm text-muted-foreground">Tente outra categoria.</p></div>
      : <div className={isPizza ? "pc-menu-list grid gap-5" : isBurger ? "hc-menu-list grid gap-5" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{products.map((product,index) => { const category=categories.find((item)=>item.id===product.category_id); const displayPrice=getPrice(product,sizes[0]?.id ?? null,prices); return <StorefrontProductCard key={product.id} theme={theme} product={product} category={category} index={index} displayPrice={displayPrice} imageUrl={product.image_url || category?.image_url || imageFallbacks[product.name]} onSelect={onSelectProduct} onAddSimple={onAddSimpleProduct} />; })}</div>}
    </section>
  );
}
