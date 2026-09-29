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
    <header className="ppp-reference-header absolute inset-x-0 top-0 z-[100]">
      <div className="mx-auto grid h-[4.7rem] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-[5rem] sm:px-7 lg:px-10">
        <nav className="hidden items-center gap-6 text-[10px] font-medium tracking-[.08em] text-secondary-foreground/75 md:flex">
          <a href="#cardapio" className="transition-colors hover:text-secondary-foreground">Cardápio</a>
          <a href="#sobre" className="transition-colors hover:text-secondary-foreground">Nossa história</a>
        </nav>

        <a href="#inicio" className="flex items-center justify-center gap-2.5 text-secondary-foreground">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="size-8 rounded-[2px] border border-secondary-foreground/20 object-cover sm:size-9"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-[2px] border border-secondary-foreground/25 bg-secondary-foreground/5 text-sm sm:size-9">
              {organizationName.charAt(0)}
            </span>
          )}
          <span className="max-w-[10rem] truncate font-display text-lg italic font-semibold tracking-[-.025em] sm:max-w-none sm:text-xl">
            {organizationName}
          </span>
        </a>

        <div className="flex items-center justify-end gap-2">
          <nav className="mr-2 hidden items-center gap-6 text-[10px] font-medium tracking-[.08em] text-secondary-foreground/75 lg:flex">
            <a href="#contato" className="transition-colors hover:text-secondary-foreground">Visite</a>
          </nav>

          {selectedTrackedOrdersCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenTracking}
              className="gap-1.5 rounded-[2px] border border-secondary-foreground/15 bg-secondary-foreground/5 px-2.5 text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
              aria-label="Acompanhar pedido"
            >
              <Clock3 className="size-3.5" />
              <span className="hidden sm:inline">Acompanhar</span>
              <Badge className="rounded-[2px] bg-secondary-foreground px-1.5 text-secondary">
                {selectedTrackedOrdersCount}
              </Badge>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onOpenCart}
            className="gap-1.5 rounded-[2px] border border-primary bg-primary px-3.5 text-[10px] font-semibold text-primary-foreground shadow-none hover:bg-primary/90"
          >
            <ShoppingBag className="size-3.5" />
            <span>{itemCount > 0 ? "Sacola" : "Pedir"}</span>
            {itemCount > 0 && (
              <Badge className="rounded-[2px] bg-primary-foreground px-1.5 text-primary">
                {itemCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
