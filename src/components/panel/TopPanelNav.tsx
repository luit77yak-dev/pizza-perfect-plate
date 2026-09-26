import { BarChart3, MapPin, Package, Settings2, ShoppingBag } from "lucide-react";

export type PanelView = "overview" | "catalog" | "operations" | "settings" | "orders";

export function TopPanelNav({
  activeView,
  onChange,
  role,
}: {
  activeView: PanelView;
  onChange: (view: PanelView) => void;
  role: string | null;
}) {
  const items: Array<{ view: PanelView; icon: typeof BarChart3; label: string }> = [
    { view: "overview", icon: BarChart3, label: "Visão geral" },
    ...(["OWNER", "ADMIN"].includes(role ?? "")
      ? [
          { view: "catalog" as PanelView, icon: Package, label: "Cardápio" },
          { view: "operations" as PanelView, icon: MapPin, label: "Operação" },
          { view: "settings" as PanelView, icon: Settings2, label: "Configurações" },
        ]
      : []),
    { view: "orders", icon: ShoppingBag, label: "Pedidos" },
  ];

  return (
    <nav
      className="border-t bg-background/95 px-4 py-2 backdrop-blur-xl sm:px-6"
      aria-label="Navegação do painel"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.view === activeView;

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onChange(item.view)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
