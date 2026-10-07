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

export function MenuFilters({ categories, mainProducts, categoryProducts, selectedCategory, setSelectedCategory, searchTerm, setSearchTerm }: MenuFiltersProps) {
  const visibleCategories = categories.filter((category) => mainProducts.some((product) => product.category_id === category.id));
  const active = "shrink-0 rounded-full border border-[#f3ad4b] bg-[#f3ad4b] px-4 py-2 text-[10px] font-black uppercase tracking-[.12em] text-[#06282d]";
  const inactive = "shrink-0 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[10px] font-black uppercase tracking-[.12em] text-white/60 transition hover:text-white";

  return (
    <div className="ppp-menu-filters mb-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#f3ad4b]">Cardápio</p>
          <h3 className="mt-1 font-display text-2xl font-black uppercase tracking-[-.02em] text-[#f4eee2] sm:text-3xl">Escolha seu sabor</h3>
        </div>
        <label className="relative hidden w-56 shrink-0 sm:block">
          <span className="sr-only">Buscar no cardápio</span>
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar..." className="h-10 w-full rounded-full border border-white/10 bg-white/[.05] px-4 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#f3ad4b]/60 focus:ring-2 focus:ring-[#f3ad4b]/20" />
        </label>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        <button onClick={() => setSelectedCategory("all")} className={selectedCategory === "all" ? active : inactive}>Todos</button>
        {visibleCategories.map((category) => (
          <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={selectedCategory === category.id ? active : inactive}>
            {category.name}<span className="ml-1 opacity-55">{categoryProducts.get(category.id) ?? 0}</span>
          </button>
        ))}
      </div>
      <label className="relative mt-3 block sm:hidden">
        <span className="sr-only">Buscar no cardápio</span>
        <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar no cardápio" className="h-11 w-full rounded-full border border-white/10 bg-white/[.05] px-4 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#f3ad4b]/60 focus:ring-2 focus:ring-[#f3ad4b]/20" />
      </label>
    </div>
  );
}
