import { Leaf, ShieldCheck, Star, Truck } from "lucide-react";
import type { Category, OrganizationSettings } from "@/lib/domain/types";
import type { StorefrontTheme } from "@/features/storefront/themes/types";

type StorefrontAboutProps = {
  theme: StorefrontTheme;
  settings: OrganizationSettings;
  categories: Category[];
};

export function StorefrontAbout({ theme, settings, categories }: StorefrontAboutProps) {
  if (theme.id === "burger-club") {
    return (
      <section id="sobre" className="hc-about-section">
        <div className="hc-about-inner">
          <div className="hc-about-copy">
            <p className="hc-section-kicker">A casa</p>
            <h2>Artesanal.<br /><em>Sem atalhos.</em></h2>
            <p>Hambúrgueres feitos para chegar quentes, suculentos e cheios de sabor. Ingredientes selecionados e um cardápio pensado para pedir sem complicação.</p>
            <a href="#cardapio">Ver o cardápio <span>→</span></a>
          </div>
          <div className="hc-about-visual">
            <div className="hc-about-image">
              <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=85&fm=jpg" alt="" loading="lazy" />
            </div>
            <div className="hc-trust-grid">
              <div><Truck /><strong>Entrega rápida</strong><span>Na sua região</span></div>
              <div><ShieldCheck /><strong>Pagamento seguro</strong><span>Diversas opções</span></div>
              <div><Leaf /><strong>Ingredientes frescos</strong><span>Qualidade garantida</span></div>
              <div><Star /><strong>Avaliações reais</strong><span>Clientes satisfeitos</span></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (theme.id !== "neroxa-classic") {
    return (
      <section id="sobre" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lifted">
          <div className="grid lg:grid-cols-[.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Sobre</p>
              <h2 className="mt-3 text-4xl leading-[.95] sm:text-6xl">Fogo alto, mesa cheia</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{settings.description || "Massa, molho, queijo e ingredientes escolhidos para transformar um pedido comum em uma experiência que dá vontade de repetir."}</p>
              <a href="#cardapio" className="mt-7 inline-flex w-fit rounded-full border border-primary bg-primary px-5 py-3 font-body text-xs font-semibold uppercase tracking-[.14em] text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90">Ver as pizzas</a>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-secondary p-3 sm:p-4">
              {[settings.hero_image_url, ...categories.slice(0, 3).map((category) => category.image_url)].filter(Boolean).slice(0, 3).map((image, index) => (
                <div key={`about-${index}`} className={`overflow-hidden rounded-xl border border-secondary-foreground/10 ${index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}>
                  <img src={image!} alt="" className="size-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const images = [settings.hero_image_url, ...categories.map((category) => category.image_url)].filter(Boolean).slice(0, 3);
  return (
    <section id="sobre" className="pc-about-section">
      <div className="pc-about-inner">
        <div className="pc-about-copy">
          <p className="pc-section-kicker">Nossa casa</p>
          <h2>Fogo alto,<br /><em>mesa cheia.</em></h2>
          <p>{settings.description || "O Pizza Club nasceu para reunir amigos em volta do forno. Pizza boa, drinks gelados e nenhuma pressa para ir embora."}</p>
          <a href="#cardapio">Ver as pizzas <span>→</span></a>
        </div>
        <div className="pc-about-collage">
          {images.map((image, index) => (
            <div key={`pc-about-${index}`} className={`pc-about-photo pc-about-photo-${index + 1}`}>
              <img src={image!} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
