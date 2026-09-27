import { Clock3, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StorefrontHeaderProps = {
  organizationName: string;
  logoUrl: string | null;
  itemCount: number;
  selectedTrackedOrdersCount: number;
  onOpenCart: () => void;
};

export function StorefrontHeader({
  organizationName,
  logoUrl,
  itemCount,
  selectedTrackedOrdersCount,
  onOpenCart,
}: StorefrontHeaderProps) {
  return (
      <header className="ppp-reference-header absolute inset-x-0 top-0 z-[100] isolate border-b border-white/15 bg-black/55 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-[5.5rem] max-w-[1400px] items-center justify-between gap-6 px-5 sm:h-[6rem] sm:px-8 lg:px-12">
          <a href="#inicio" className="group flex min-w-0 items-center gap-3 text-white">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-9 rounded-full border border-white/35 object-cover sm:size-10" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/40 bg-black/20 font-display text-lg sm:size-10">{organizationName.charAt(0)}</span>
            )}
            <span className="truncate font-display text-xl font-medium tracking-[-.03em] sm:text-2xl">{organizationName}</span>
          </a>

          <nav className="hidden items-center gap-10 text-[10px] font-medium uppercase tracking-[.38em] text-white/75 md:flex">
            <a href="#cardapio" className="transition-colors hover:text-white">Cardápio</a>
            <a href="#sobre" className="transition-colors hover:text-white">A casa</a>
            <a href="#contato" className="transition-colors hover:text-white">Contato</a>
          </nav>

          <div className="relative z-[110] flex items-center gap-2">
            <Button size="sm" style={{ backgroundColor: "#f97316", borderColor: "#f97316", color: "#ffffff" }} className="gap-2 rounded-none px-3.5 font-body text-[10px] font-medium uppercase tracking-[.16em] text-white shadow-[3px_3px_0_rgba(0,0,0,.45)] transition-transform hover:-translate-y-0.5 sm:px-4" onClick={() => onOpenCart()}>
              <ShoppingBag className="size-3.5" />
              <span>{itemCount > 0 ? "Sacola" : "Pedir"}</span>
              {itemCount > 0 && <Badge className="rounded-full bg-white px-1.5 text-foreground">{itemCount}</Badge>}
            </Button>
            {selectedTrackedOrdersCount > 0 && <span className="flex items-center gap-1 rounded-full border border-white/25 bg-black/30 px-2 py-1 text-[9px] font-bold text-white/85"><Clock3 className="size-3" />{selectedTrackedOrdersCount}</span>}
          </div>
        </div>
      </header>

  );
}
