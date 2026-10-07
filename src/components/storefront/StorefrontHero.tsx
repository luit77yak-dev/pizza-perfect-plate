import { ChevronRight, Pizza } from "lucide-react";
import type { OrganizationSettings, Product } from "@/lib/domain/types";

type StorefrontHeroProps = { organizationName: string; settings: OrganizationSettings; products: Product[] };

export function StorefrontHero({ organizationName, settings, products }: StorefrontHeroProps) {
  const featuredImage = settings.hero_image_url || products.find((product) => Boolean(product.image_url))?.image_url || null;
  return (
    <section className="ppp-reference-hero overflow-hidden bg-[#06282d]">
      <div className="relative min-h-[420px] sm:min-h-[540px] lg:min-h-[650px]">
        <div className="absolute inset-0">
          {featuredImage ? <img src={featuredImage} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-[#0a3035] text-[#f3ad4b]/40"><Pizza className="size-28" strokeWidth={1} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#041e22] via-[#041e22]/35 to-[#041e22]/35" />
        </div>
        <div className="relative z-10 flex min-h-[420px] flex-col justify-end px-5 pb-10 pt-28 sm:min-h-[540px] sm:px-8 sm:pb-14 lg:min-h-[650px] lg:px-12">
          <span className="mb-4 w-fit rounded-full border border-[#f3ad4b]/45 bg-[#06282d]/65 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.24em] text-[#f3ad4b] backdrop-blur">Feita na hora · Est. 2026</span>
          <h1 className="max-w-4xl font-display text-[clamp(2.8rem,10vw,7.5rem)] font-black uppercase leading-[.86] tracking-[-.04em] text-[#f4eee2]">{settings.hero_title && !/MASSA DE FERMENTA/i.test(settings.hero_title) ? settings.hero_title : "Pizza que fica na memória."}</h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#f4eee2]/72 sm:text-lg sm:leading-7">{settings.hero_subtitle || settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos."}</p>
          <a href="#cardapio" className="mt-6 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-[#f3ad4b] px-6 text-xs font-black uppercase tracking-[.12em] text-[#06282d] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#ffc66b]">{settings.hero_cta_label || "Pedir agora"}<ChevronRight className="size-4" /></a>
          <div className="pointer-events-none absolute bottom-4 right-4 hidden size-24 rotate-[-8deg] items-center justify-center rounded-full border-2 border-[#06282d] bg-[#f3ad4b] p-3 text-center font-display text-[9px] uppercase leading-3 text-[#06282d] shadow-[5px_5px_0_rgba(0,0,0,.55)] sm:flex sm:size-28">{organizationName}<br />feito na hora<br />pizza artesanal</div>
        </div>
      </div>
    </section>
  );
}
