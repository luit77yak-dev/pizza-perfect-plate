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
        <h2>{"Uma receita de família."}</h2>
        <p className="ppp-about-copy">
          {settings.description ||
            "Uma massa feita com tempo, ingredientes escolhidos e respeito pela tradição. Cada pizza é aberta à mão e assada para chegar à mesa com sabor, leveza e personalidade."}
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
        <a href="#cardapio" className="ppp-about-cta">Conheça o menu</a>
      </div>
    </section>
  );
}
