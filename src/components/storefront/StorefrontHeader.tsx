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
    <header className="ppp-reference-header absolute inset-x-0 top-0 z-[100] border-b border-white/10 bg-[#061f23]/88 text-[#f4eee2] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-[1400px] items-center justify-between gap-3 px-4 sm:h-[5rem] sm:px-8 lg:px-12">
        <a href="#inicio" className="group flex min-w-0 items-center gap-2.5">
          {logoUrl ? <img src={logoUrl} alt="" className="size-9 rounded-full border border-white/20 object-cover sm:size-10" /> : <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#f3ad4b]/50 bg-[#f3ad4b]/10 font-display text-lg text-[#f3ad4b] sm:size-10">{organizationName.charAt(0)}</span>}
          <span className="truncate font-display text-lg font-medium tracking-[-.03em] sm:text-2xl">{organizationName}</span>
        </a>
        <nav className="hidden items-center gap-10 text-[10px] font-bold uppercase tracking-[.28em] text-white/65 md:flex">
          <a href="#cardapio" className="transition-colors hover:text-[#f3ad4b]">Cardápio</a>
          <a href="#sobre" className="transition-colors hover:text-[#f3ad4b]">A casa</a>
          <a href="#contato" className="transition-colors hover:text-[#f3ad4b]">Contato</a>
        </nav>
        <div className="flex items-center gap-2">
          {selectedTrackedOrdersCount > 0 && <Button size="sm" variant="ghost" onClick={onOpenTracking} className="h-10 rounded-full border border-white/10 bg-white/[.05] px-3 text-[#f4eee2] hover:bg-white/[.1] hover:text-white" aria-label="Acompanhar pedido"><Clock3 className="size-5" /><span className="hidden sm:inline">Acompanhar</span><Badge className="grid size-5 place-items-center rounded-full bg-[#f3ad4b] p-0 text-[9px] font-black text-[#06282d]">{selectedTrackedOrdersCount}</Badge></Button>}
          <Button size="sm" onClick={onOpenCart} className="h-10 rounded-full bg-[#f3ad4b] px-3.5 text-[10px] font-black uppercase tracking-[.12em] text-[#06282d] hover:bg-[#ffc66b]"><ShoppingBag className="size-5" /><span className="hidden sm:inline">{itemCount > 0 ? "Sacola" : "Pedir"}</span>{itemCount > 0 && <Badge className="grid size-5 place-items-center rounded-full bg-[#06282d] p-0 text-[9px] font-black text-[#f3ad4b]">{itemCount}</Badge>}</Button>
          <details className="relative md:hidden">
            <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-white/10 bg-white/[.05] [&::-webkit-details-marker]:hidden"><Menu className="size-5" /></summary>
            <div className="absolute right-0 top-12 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#06282d] p-2 shadow-2xl">
              <a href="#cardapio" className="block rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-white/75 hover:bg-white/[.06] hover:text-[#f3ad4b]">Cardápio</a>
              <a href="#sobre" className="block rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-white/75 hover:bg-white/[.06] hover:text-[#f3ad4b]">A casa</a>
              <a href="#contato" className="block rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-white/75 hover:bg-white/[.06] hover:text-[#f3ad4b]">Contato</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
