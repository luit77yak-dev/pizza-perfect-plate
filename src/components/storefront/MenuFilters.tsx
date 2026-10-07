import type { Category, Product } from "@/lib/domain/types";

type MenuFiltersProps = {
  categories: Category[];
  mainProducts: Product[];
  categoryProducts: Map<string, number>;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
};

export function MenuFilters({
  categories,
  mainProducts,
  categoryProducts,
  selectedCategory,
  setSelectedCategory,
  searchTerm,
  setSearchTerm,
}: MenuFiltersProps) {
  return (
    <div className="ppp-menu-filters mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium transition-colors ${selectedCategory === "all" ? "border-primary text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Todos
        </button>
        {categories.filter((category) => mainProducts.some((product) => product.category_id === category.id)).map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium transition-colors ${selectedCategory === category.id ? "border-primary text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {category.name}
            <span className="ml-1.5 opacity-60">{categoryProducts.get(category.id) ?? 0}</span>
          </button>
        ))}
      </div>
      <label className="relative block shrink-0 sm:w-64">
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
