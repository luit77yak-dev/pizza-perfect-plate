import type { Category, OrganizationSettings } from "@/lib/domain/types";

type StorefrontAboutProps = {
  settings: OrganizationSettings;
  categories: Category[];
};

export function StorefrontAbout({ settings, categories }: StorefrontAboutProps) {
  const gallery = [
    settings.hero_image_url,
    ...categories.slice(0, 3).map((category) => category.image_url),
  ].filter(Boolean).slice(0, 3);

  return (
    <section id="sobre" className="ppp-about-section">
      <div className="ppp-about-inner">
        <div className="ppp-about-ornament" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <p className="ppp-about-kicker">Nossa história</p>
        <h2>{settings.hero_title ? "Feito para ser lembrado." : "Uma história feita à mão."}</h2>
        <p className="ppp-about-copy">
          {settings.description ||
            "Ingredientes escolhidos, tempo de fermentação e cuidado em cada etapa para transformar um pedido comum em uma experiência especial."}
        </p>
        {gallery.length > 0 && (
          <div className="ppp-about-gallery">
            {gallery.map((image, index) => (
              <img
                key={"about-" + index}
                src={image!}
                alt=""
                loading="lazy"
              />
            ))}
          </div>
        )}
        <a href="#cardapio" className="ppp-about-cta">Ver o cardápio</a>
      </div>
    </section>
  );
}
