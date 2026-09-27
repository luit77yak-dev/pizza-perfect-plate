import type { Category, OrganizationSettings } from "@/lib/domain/types";

type StorefrontAboutProps = {
  settings: OrganizationSettings;
  categories: Category[];
};

export function StorefrontAbout({ settings, categories }: StorefrontAboutProps) {
  return (
    <section id="sobre" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="overflow-hidden rounded-[.75rem] border-2 border-secondary bg-secondary text-secondary-foreground shadow-lifted"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="p-7 sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">A casa</p><h2 className="mt-3 text-4xl uppercase leading-[.9] sm:text-6xl">Feita para quem ama pizza.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-secondary-foreground/75 sm:text-base">{settings.description || "Massa, molho, queijo e ingredientes escolhidos para transformar um pedido comum em uma experiência que dá vontade de repetir."}</p><a href="#cardapio" className="mt-7 inline-flex rounded-sm bg-primary px-5 py-3 font-display uppercase text-primary-foreground shadow-[5px_5px_0_rgba(0,0,0,.5)]">Ver o cardápio</a></div><div className="grid grid-cols-2 gap-3 bg-primary p-4 sm:p-6">{[data.settings.hero_image_url, ...data.categories.slice(0, 3).map((category) => category.image_url)].filter(Boolean).slice(0, 3).map((image, index) => <div key={`about-${index}`} className={`overflow-hidden rounded-sm border-2 border-secondary shadow-[5px_5px_0_rgba(0,0,0,.6)] ${index === 0 ? "col-span-2 aspect-[2/1] rotate-[-1.5deg]" : "aspect-square rotate-[1.5deg]"}`}><img src={image!} alt="" className="size-full object-cover transition duration-500 hover:scale-105" loading="lazy" /></div>)}</div></div></div></section>
  );
}
