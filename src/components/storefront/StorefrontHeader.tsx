import { useEffect, useState } from "react";
import { Clock3, Menu, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StorefrontHeaderProps = {
  organizationName: string;
  logoUrl: string | null;
  itemCount: number;
  selectedTrackedOrdersCount: number;
  onOpenCart: () => void;
  onOpenTracking: () => void;
  isPizzaTheme?: boolean;
};

export function StorefrontHeader({
  organizationName,
  logoUrl,
  itemCount,
  selectedTrackedOrdersCount,
  onOpenCart,
  onOpenTracking,
  isPizzaTheme = false,
}: StorefrontHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`ppp-reference-header ${scrolled ? "scrolled" : ""} absolute inset-x-0 top-0 z-[100]`}>
      <div className="mx-auto flex h-[5.25rem] max-w-[1400px] items-center justify-between gap-3 px-5 sm:h-[5.75rem] sm:px-8 lg:px-12">
        <a href="#inicio" className="group flex min-w-0 items-center gap-3 text-white">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ffc15e] text-[#ffc15e] font-display text-lg font-semibold sm:size-12">
            PC
          </span>
          <span className="truncate font-display text-xl font-semibold tracking-[-.035em] sm:text-2xl">
            {isPizzaTheme ? "Pizza Club" : organizationName}
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-xs font-medium text-white/70 lg:flex">
          <a href="#cardapio" className="transition-colors hover:text-white">Cardápio</a>
          <a href="#sobre" className="transition-colors hover:text-white">A casa</a>
          <a href="#contato" className="transition-colors hover:text-white">Contato</a>
        </nav>

        <div className="relative z-[110] flex items-center gap-2">
          {selectedTrackedOrdersCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenTracking}
              className="ppp-header-icon-button"
              aria-label="Acompanhar pedido"
            >
              <Clock3 className="size-5" strokeWidth={1.8} />
              <Badge className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ff6a3d] p-0 text-[9px] font-bold text-white">{selectedTrackedOrdersCount}</Badge>
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ppp-header-icon-button" onClick={onOpenCart} aria-label="Abrir carrinho">
            <ShoppingBag className="size-5" strokeWidth={1.8} />
            {itemCount > 0 && <Badge className="grid size-5 shrink-0 place-items-center rounded-full bg-[#ff6a3d] p-0 text-[9px] font-bold text-white">{itemCount}</Badge>}
          </Button>
          <Button size="sm" variant="ghost" className="ppp-header-icon-button lg:hidden" onClick={() => document.getElementById("cardapio")?.scrollIntoView({ behavior: "smooth" })} aria-label="Abrir cardápio">
            <Menu className="size-5" strokeWidth={1.8} />
          </Button>
        </div>
      </div>
    </header>
    </header>
  );
}
