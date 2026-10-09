import type { Category, Product } from "@/lib/domain/types";
import type { StorefrontTheme } from "@/features/storefront/themes/types";

type Props = {
  theme: StorefrontTheme;
  categories: Category[];
  products: Product[];
  categoryProducts: Map<string, number>;
  selectedCategory: string;
  onSelectCategory: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

export function StorefrontCategoryNav({ theme, categories, products, categoryProducts, selectedCategory, onSelectCategory, searchTerm, onSearchTermChange }: Props) {
  const visibleCategories = categories.filter((category) => products.some((product) => product.category_id === category.id));
  const navigation = theme.categoryNavigation ?? "tabs";
  const isAccordion = navigation === "accordion";
  const isList = navigation === "list";
  const activeClass = "border-primary bg-primary text-primary-foreground";
  const inactiveClass = "border-border bg-card/50 text-muted-foreground hover:border-primary/50 hover:text-foreground";
  return (
    <div className="mb-8 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className={isAccordion || isList ? "grid min-w-0 gap-2 sm:min-w-[14rem]" : "scrollbar-none -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"}>
        <button type="button" onClick={() => onSelectCategory("all")} data-active={selectedCategory === "all"} aria-pressed={selectedCategory === "all"}
          className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${selectedCategory === "all" ? activeClass : inactiveClass}`}>Todos{theme.showProductCounts !== false && <span className="ml-1.5 opacity-60">{products.length}</span>}</button>
        {visibleCategories.map((category) => (
          <button type="button" key={category.id} onClick={() => onSelectCategory(category.id)} data-active={selectedCategory === category.id} aria-pressed={selectedCategory === category.id}
            className={`shrink-0 rounded-full border px-5 py-2.5 text-left text-sm font-medium transition-colors ${selectedCategory === category.id ? activeClass : inactiveClass} ${isAccordion ? "w-full rounded-lg" : ""}`}>
            {category.name}{theme.showProductCounts !== false && <span className="ml-1.5 opacity-60">{categoryProducts.get(category.id) ?? 0}</span>}
          </button>
        ))}
      </div>
      {theme.showSearch !== false && <label className="relative block shrink-0 sm:w-64">
        <span className="sr-only">Buscar no cardápio</span>
        <input type="search" value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} placeholder="Buscar no cardápio"
          className="h-11 w-full rounded-xl border border-border bg-card/50 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </label>}
    </div>
  );
}
