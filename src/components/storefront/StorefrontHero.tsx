import { Clock3, Pizza } from "lucide-react";
import type { OrganizationSettings, Product } from "@/lib/domain/types";

type StorefrontHeroProps = {
  organizationName: string;
  settings: OrganizationSettings;
  products: Product[];
};

function Ornament() {
  return (
    <svg viewBox="0 0 140 14" aria-hidden="true" className="ppp-ornament h-3 w-32">
      <path d="M2 7h50M88 7h50" />
      <circle cx="70" cy="7" r="4" />
      <circle cx="62" cy="7" r="1.5" />
      <circle cx="78" cy="7" r="1.5" />
    </svg>
  );
}

export function StorefrontHero({ organizationName, settings, products }: StorefrontHeroProps) {
  const heroImage =
    settings.hero_image_url ??
    products.find((product) => Boolean(product.image_url))?.image_url ??
    null;

  return (
    <section className="ppp-reference-hero">
      <div className="ppp-reference-hero-frame">
        <div className="ppp-reference-hero-grid">
          <div className="ppp-reference-hero-copy">
            <p className="ppp-reference-hero-eyebrow">Pizza napoletana</p>
            <h1>{settings.hero_title || "Farinha, água, sal e tempo."}</h1>
            <Ornament />
            <p className="ppp-reference-hero-sub">
              {settings.hero_subtitle ||
                settings.description ||
                "Massa descansada, forno bem quente e ingredientes escolhidos para respeitar a tradição napolitana."}
            </p>
            <div className="ppp-reference-hero-actions">
              <a href="#cardapio" className="ppp-hero-primary-cta">
                {settings.hero_cta_label || "Ver o cardápio"}
              </a>
              <span className="ppp-hero-hours">
                <Clock3 className="size-4" />
                Terça a domingo, das 18h30 às 23h
              </span>
            </div>
          </div>

          <figure className="ppp-reference-hero-media">
            {heroImage ? (
              <img
                src={heroImage}
                alt={organizationName}
                className="ppp-reference-hero-image"
                loading="eager"
              />
            ) : (
              <div className="grid size-full place-items-center text-secondary-foreground/40">
                <Pizza className="size-20" strokeWidth={1} />
              </div>
            )}
            <figcaption>{organizationName}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
