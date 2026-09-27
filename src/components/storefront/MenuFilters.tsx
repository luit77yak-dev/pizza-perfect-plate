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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 rounded-sm border-2 border-secondary px-4 py-2 text-sm font-semibold uppercase transition-colors ${selectedCategory === "all" ? "bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]" : "bg-card hover:-translate-y-0.5"}`}
        >
          Todos
        </button>
        {categories.filter((category) => mainProducts.some((product) => product.category_id === category.id)).map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`shrink-0 rounded-sm border-2 border-secondary px-4 py-2 text-sm font-semibold uppercase transition-colors ${selectedCategory === category.id ? "bg-primary text-primary-foreground shadow-[3px_3px_0_rgba(0,0,0,.75)]" : "bg-card hover:-translate-y-0.5"}`}
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
          className="h-11 w-full rounded-sm border-2 border-secondary bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:shadow-[3px_3px_0_rgba(0,0,0,.7)]"
        />
      </label>
    </div>
  );
}
