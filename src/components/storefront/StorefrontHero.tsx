import { Pizza } from "lucide-react";
import type { OrganizationSettings, Product } from "@/lib/domain/types";

type StorefrontHeroProps = {
  organizationName: string;
  settings: OrganizationSettings;
  products: Product[];
  isPizzaTheme?: boolean;
  statusLabel?: string;
};

export function StorefrontHero({ organizationName, settings, products, isPizzaTheme = false, statusLabel = "Fechado agora, abre às 18:00" }: StorefrontHeroProps) {
  return (
    <section className="ppp-reference-hero mx-auto max-w-none px-0 pb-0 pt-0 sm:px-0 sm:pb-0 sm:pt-0">
      <div className="ppp-reference-hero-frame relative isolate overflow-hidden">
        <div className="ppp-reference-hero-grid grid min-h-[min(760px,calc(100dvh-5.5rem))] lg:min-h-[760px] lg:grid-cols-1">
          <div className="ppp-reference-hero-copy relative z-20 flex min-w-0 flex-col justify-end p-[clamp(1.25rem,5vw,3.5rem)]">
            <p className="ppp-hero-status"><span aria-hidden="true" />{isPizzaTheme ? statusLabel : "Aberto agora"}</p>
            <h1 className="w-full max-w-4xl text-[clamp(2rem,8vw,8rem)] leading-[.86] tracking-[-.045em]">{isPizzaTheme ? "A noite pede mais uma fatia." : (settings.hero_title && !/MASSA DE FERMENTA/i.test(settings.hero_title) ? settings.hero_title : "Pizza que fica na memória.")}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">{isPizzaTheme ? "Massa de fermentação longa, forno a lenha e queijo que estica." : (settings.hero_subtitle || settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos.")}</p>
            <a href="#cardapio" className="mt-8 inline-flex w-fit items-center rounded-[14px] bg-[#ff6a3d] px-6 py-4 text-sm font-semibold text-white shadow-none transition-transform hover:-translate-y-0.5">{isPizzaTheme ? "Ver as pizzas" : (settings.hero_cta_label || "Pedir agora")}</a>
          </div>
          <div className="ppp-reference-hero-media pointer-events-none absolute inset-0 z-0 min-h-[min(680px,calc(100dvh-5.5rem))] overflow-hidden bg-secondary p-0 lg:min-h-[760px]">
            <div className="relative h-full min-h-[560px] overflow-hidden bg-background/10 p-0 sm:min-h-[680px] lg:min-h-[760px]">
              {settings.hero_image_url ? (
                <img src={settings.hero_image_url} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" />
              ) : products.find((product) => Boolean(product.image_url)) ? (
                <img src={products.find((product) => Boolean(product.image_url))?.image_url ?? ""} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="grid h-full min-h-[560px] place-items-center text-secondary-foreground/50"><Pizza className="size-28" strokeWidth={1} /></div>
              )}
            </div>
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex size-24 rotate-[-8deg] items-center justify-center rounded-full border-2 border-secondary bg-primary p-3 text-center font-display text-[9px] uppercase leading-3 text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.7)] sm:bottom-4 sm:left-4 sm:size-28 sm:text-[10px]">{isPizzaTheme ? "Pizza Club" : organizationName}<br />feito na hora<br />pizza artesanal</div>
          </div>
        </div>
      </div>
    </section>
  );
}
