import type { Category, OrganizationSettings } from "@/lib/domain/types";

type StorefrontAboutProps = {
  settings: OrganizationSettings;
  categories: Category[];
};

export function StorefrontAbout({ settings, categories }: StorefrontAboutProps) {
  return (
    <section id="sobre" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lifted">
        <div className="grid lg:grid-cols-[.9fr_1.1fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">A casa</p>
            <h2 className="mt-3 text-4xl leading-[.95] sm:text-6xl">Feita para quem ama pizza.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{settings.description || "Massa, molho, queijo e ingredientes escolhidos para transformar um pedido comum em uma experiência que dá vontade de repetir."}</p>
            <a href="#cardapio" className="mt-7 inline-flex w-fit rounded-full border border-primary bg-primary px-5 py-3 font-body text-xs font-semibold uppercase tracking-[.14em] text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90">Ver o cardápio</a>
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
