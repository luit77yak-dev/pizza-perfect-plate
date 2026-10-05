import { Clock3, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StorefrontHeaderProps = {
  organizationName: string;
  logoUrl: string | null;
  itemCount: number;
  selectedTrackedOrdersCount: number;
  onOpenCart: () => void;
  onOpenTracking: () => void;
};

export function StorefrontHeader({
  organizationName,
  logoUrl,
  itemCount,
  selectedTrackedOrdersCount,
  onOpenCart,
  onOpenTracking,
}: StorefrontHeaderProps) {
  return (
      <header className="ppp-reference-header absolute inset-x-0 top-0 z-[100] isolate border-b bg-secondary/80 text-secondary-foreground backdrop-blur-xl">
        <div className="mx-auto flex h-[5.5rem] max-w-[1400px] items-center justify-between gap-6 px-5 sm:h-[6rem] sm:px-8 lg:px-12">
          <a href="#inicio" className="group flex min-w-0 items-center gap-3 text-secondary-foreground">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="size-9 rounded-full border border-secondary-foreground/35 object-cover sm:size-10" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-secondary-foreground/40 bg-secondary-foreground/5 font-display text-lg sm:size-10">{organizationName.charAt(0)}</span>
            )}
            <span className="truncate font-display text-xl font-medium tracking-[-.03em] sm:text-2xl">{organizationName}</span>
          </a>

          <nav className="hidden items-center gap-10 text-[10px] font-medium uppercase tracking-[.38em] text-secondary-foreground/75 md:flex">
            <a href="#cardapio" className="transition-colors hover:text-secondary-foreground">Cardápio</a>
            <a href="#sobre" className="transition-colors hover:text-secondary-foreground">A casa</a>
            <a href="#contato" className="transition-colors hover:text-secondary-foreground">Contato</a>
          </nav>

          <div className="relative z-[110] flex items-center gap-2">
            {selectedTrackedOrdersCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenTracking}
                className="min-h-10 min-w-[76px] shrink-0 justify-center gap-2 rounded-lg border border-secondary-foreground/25 bg-secondary-foreground/10 px-3 text-secondary-foreground shadow-sm hover:bg-secondary-foreground/15 hover:text-secondary-foreground sm:min-w-0 sm:px-4"
                aria-label="Acompanhar pedido"
              >
                <Clock3 className="size-7 shrink-0" strokeWidth={2} />
                <span className="hidden text-[9px] font-medium uppercase tracking-[.14em] sm:inline">Acompanhar</span>
                <Badge className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary-foreground p-0 text-[10px] font-black text-secondary">{selectedTrackedOrdersCount}</Badge>
              </Button>
            )}
            <Button size="sm" className="min-h-10 min-w-[76px] shrink-0 justify-center gap-2 rounded-lg border border-primary bg-primary px-3.5 font-body text-[10px] font-bold uppercase tracking-[.16em] text-primary-foreground shadow-lifted transition-transform hover:-translate-y-0.5 hover:bg-primary/90 sm:min-w-0 sm:px-4" onClick={onOpenCart}>
              <ShoppingBag className="size-7 shrink-0" strokeWidth={2} />
              <span>{itemCount > 0 ? "Sacola" : "Pedir"}</span>
              {itemCount > 0 && <Badge className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-foreground p-0 text-[10px] font-black text-primary">{itemCount}</Badge>}
            </Button>
          </div>
        </div>

      <nav className="ppp-mobile-step-nav" aria-label="Etapas do pedido">
        <a href="#inicio">Início</a>
        <a href="#cardapio">Montar pizza</a>
        <button type="button" onClick={onOpenCart}>Carrinho{itemCount > 0 ? " · " + itemCount : ""}</button>
        <button type="button" onClick={onOpenCart}>Finalizar</button>
      </nav>
      </header>

  );
}
