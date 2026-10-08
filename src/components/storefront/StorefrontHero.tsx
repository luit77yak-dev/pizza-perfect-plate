import { ArrowRight, Pizza } from "lucide-react";
import type { OrganizationSettings, Product } from "@/lib/domain/types";

type StorefrontHeroProps = {
  organizationName: string;
  settings: OrganizationSettings;
  products: Product[];
  isPizzaTheme?: boolean;
  isBurgerTheme?: boolean;
  statusLabel?: string;
};

const BURGER_CLUB_HERO_IMAGE =
  "https://images.unsplash.com/photo-1550547660-d9450f859349?w=1800&q=88&fm=jpg";

export function StorefrontHero({ organizationName, settings, products, isPizzaTheme = false, isBurgerTheme = false, statusLabel = "Fechado agora, abre às 18:00" }: StorefrontHeroProps) {
  const heroImage = isBurgerTheme
    ? BURGER_CLUB_HERO_IMAGE
    : isPizzaTheme
      ? settings.hero_image_url || products.find((product) => /pepperoni|margherita/i.test(product.name) && Boolean(product.image_url))?.image_url
      : settings.hero_image_url || products.find((product) => Boolean(product.image_url))?.image_url;

  return (
    <section className="ppp-reference-hero mx-auto max-w-none px-0 pb-0 pt-0 sm:px-0 sm:pb-0 sm:pt-0">
      <div className="ppp-reference-hero-frame relative isolate overflow-hidden">
        <div className="ppp-reference-hero-grid grid min-h-[min(760px,calc(100dvh-5.5rem))] lg:min-h-[760px] lg:grid-cols-1">
          <div className="ppp-reference-hero-copy relative z-20 flex min-w-0 flex-col justify-end p-[clamp(1.25rem,5vw,3.5rem)]">
            <p className="ppp-hero-status"><span aria-hidden="true" />{isPizzaTheme ? statusLabel : "Aberto agora"}</p>
            <h1 className="w-full max-w-4xl text-[clamp(2rem,8vw,8rem)] leading-[.86] tracking-[-.045em]">{isPizzaTheme ? <>A noite pede<br /> mais uma <em>fatia.</em></> : isBurgerTheme ? <>O sabor que<br /> <em>faz a diferença.</em></> : (settings.hero_title && !/MASSA DE FERMENTA/i.test(settings.hero_title) ? settings.hero_title : "Pizza que fica na memória.")}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">{isPizzaTheme ? "Massa de fermentação longa, forno a lenha e queijo que estica." : isBurgerTheme ? "Hambúrgueres artesanais, ingredientes selecionados e muito mais para você se deliciar." : (settings.hero_subtitle || settings.description || "Escolha seus sabores, monte sua pizza e peça em poucos passos.")}</p>
            <a href="#cardapio" className="mt-8 inline-flex w-fit items-center rounded-[14px] bg-[#ff6a3d] px-6 py-4 text-sm font-semibold text-white shadow-none transition-transform hover:-translate-y-0.5">{isPizzaTheme ? "Ver as pizzas" : isBurgerTheme ? "Ver as opções" : (settings.hero_cta_label || "Pedir agora")}{(isPizzaTheme || isBurgerTheme) && <ArrowRight className="ml-4 size-5" strokeWidth={2} />}</a>
          </div>
          <div className="ppp-reference-hero-media pointer-events-none absolute inset-0 z-0 min-h-[min(680px,calc(100dvh-5.5rem))] overflow-hidden bg-secondary p-0 lg:min-h-[760px]">
            <div className="relative h-full min-h-[560px] overflow-hidden bg-background/10 p-0 sm:min-h-[680px] lg:min-h-[760px]">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt=""
                  className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover"
                />
              ) : products.find((product) => Boolean(product.image_url)) ? (
                <img src={products.find((product) => Boolean(product.image_url))?.image_url ?? ""} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="grid h-full min-h-[560px] place-items-center text-secondary-foreground/50"><Pizza className="size-28" strokeWidth={1} /></div>
              )}
            </div>
            </div>
        </div>
      </div>
    </section>
  );
}
