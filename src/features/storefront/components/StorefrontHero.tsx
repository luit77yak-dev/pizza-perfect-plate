import { ArrowRight, Image as ImageIcon } from "lucide-react";
import type { OrganizationSettings, Product } from "@/lib/domain/types";
import type { StorefrontContentConfig, StorefrontTheme } from "@/features/storefront/themes/types";

type StorefrontHeroProps = {
  organizationName: string;
  settings: OrganizationSettings;
  products: Product[];
  statusLabel?: string;
  theme: StorefrontTheme;
  content?: StorefrontContentConfig;
};

export function StorefrontHero({ organizationName, settings, products, statusLabel = "Status da loja indisponível", theme, content }: StorefrontHeroProps) {
  const heroImage = content?.heroImageUrl || settings.hero_image_url || products.find((product) => Boolean(product.image_url))?.image_url;
  const brandName = content?.brandName || organizationName;
  const title = content?.heroTitle || settings.hero_title || `Bem-vindo à ${brandName}`;
  const subtitle = content?.heroSubtitle || settings.hero_subtitle || settings.description || "Conheça nosso cardápio e faça seu pedido em poucos passos.";
  const ctaLabel = content?.heroCtaLabel || settings.hero_cta_label || "Ver o cardápio";
  void theme;

  return (
    <section className="ppp-reference-hero ppp-engine-hero mx-auto max-w-none px-0 pb-0 pt-0 sm:px-0 sm:pb-0 sm:pt-0">
      <div className="ppp-reference-hero-frame relative isolate overflow-hidden">
        <div className="ppp-reference-hero-grid grid min-h-[min(680px,calc(100dvh-5.5rem))] lg:min-h-[720px]">
          <div className="ppp-reference-hero-copy relative z-20 flex min-w-0 flex-col justify-end p-[clamp(1.25rem,5vw,3.5rem)]">
            <p className="ppp-hero-status"><span aria-hidden="true" />{statusLabel}</p>
            <h1 className="w-full max-w-4xl text-[clamp(2rem,8vw,8rem)] leading-[.86] tracking-[-.045em]">{title}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">{subtitle}</p>
            <a href="#cardapio" className="mt-8 inline-flex w-fit items-center rounded-[14px] bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">{ctaLabel}<ArrowRight className="ml-4 size-5" strokeWidth={2} /></a>
          </div>
          <div className="ppp-reference-hero-media pointer-events-none absolute inset-0 z-0 min-h-[min(680px,calc(100dvh-5.5rem))] overflow-hidden bg-secondary p-0 lg:min-h-[720px]">
            <div className="relative h-full min-h-[560px] overflow-hidden bg-background/10 p-0 sm:min-h-[600px] lg:min-h-[720px]">
              {heroImage ? <img src={heroImage} alt="" className="ppp-reference-hero-image absolute inset-0 h-full w-full object-cover" fetchPriority="high" /> : <div className="grid h-full min-h-[560px] place-items-center text-secondary-foreground/50"><ImageIcon className="size-28" strokeWidth={1} /></div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
