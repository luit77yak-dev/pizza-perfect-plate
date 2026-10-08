import type { Category, Product } from "@/lib/domain/types";

type MenuFiltersProps = {
  categories: Category[];
  mainProducts: Product[];
  categoryProducts: Map<string, number>;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isPizzaTheme?: boolean;
  isBurgerTheme?: boolean;
};

export function MenuFilters({
  categories,
  mainProducts,
  categoryProducts,
  selectedCategory,
  setSelectedCategory,
  searchTerm,
  setSearchTerm,
  isPizzaTheme = false,
  isBurgerTheme = false,
}: MenuFiltersProps) {
  return (
    <div className={`${isBurgerTheme ? "hc-filters" : isPizzaTheme ? "pc-filters" : "ppp-menu-filters"} mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setSelectedCategory("all")}
          data-active={selectedCategory === "all"}
          aria-pressed={selectedCategory === "all"}
          className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${selectedCategory === "all" ? "border-[#ffc15e] bg-[#f7efe6] text-[#0e0c0b]" : "border-white/15 text-white/65 hover:border-white/30 hover:text-white"}`}
        >
          Todos
        </button>
        {categories.filter((category) => mainProducts.some((product) => product.category_id === category.id)).map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            data-active={selectedCategory === category.id}
            aria-pressed={selectedCategory === category.id}
            className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${selectedCategory === category.id ? "border-[#ffc15e] bg-[#f7efe6] text-[#0e0c0b]" : "border-white/15 text-white/65 hover:border-white/30 hover:text-white"}`}
          >
            {category.name}
            {!isPizzaTheme && !isBurgerTheme && <span className="ml-1.5 opacity-60">{categoryProducts.get(category.id) ?? 0}</span>}
          </button>
        ))}
      </div>
      <label className={`relative block shrink-0 sm:w-64 ${isPizzaTheme || isBurgerTheme ? "hidden" : ""}`}>
        <span className="sr-only">Buscar no cardápio</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar no cardápio"
          className="h-11 w-full rounded-xl border border-border bg-card/50 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
    </div>
  );
}
