import type { OrganizationSettings } from "@/lib/domain/types";
import type { StorefrontContentConfig, StorefrontTheme } from "@/features/storefront/themes/types";

type StorefrontFooterProps = {
  theme: StorefrontTheme;
  settings: OrganizationSettings;
  organizationName: string;
  content?: StorefrontContentConfig;
};

export function StorefrontFooter({ theme, settings, organizationName, content }: StorefrontFooterProps) {
  if (theme.sections?.footer?.enabled === false) return null;
  const serviceMode =
    settings.delivery_enabled && settings.pickup_enabled
      ? "Entrega e retirada"
      : settings.delivery_enabled
        ? "Entrega"
        : settings.pickup_enabled
          ? "Retirada no local"
          : "Consulte a loja";
  const brandName = content?.brandName || organizationName;
  const footerText = content?.footerText || "Obrigado pela preferência.";
  const whatsapp = settings.whatsapp_phone;
  const socialLinks = settings.social_links && typeof settings.social_links === "object"
    ? Object.entries(settings.social_links as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
    : [];
  return (
    <footer id="contato" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-10 sm:px-6" aria-label="Informações e contato da loja">
      <div className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-lifted sm:p-10 lg:p-12">
        <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Contato</p>
            <h2 className="mt-3 break-words text-[clamp(2rem,8vw,4rem)] leading-[.95]">{brandName}</h2>
          </div>
          <a className="inline-flex w-fit items-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90" href="#cardapio">Ver o cardápio <span aria-hidden="true">→</span></a>
        </div>
        <div className="grid gap-5 py-7 sm:grid-cols-2 lg:grid-cols-3">
          <div><span className="block text-xs uppercase tracking-widest text-muted-foreground">Atendimento</span><strong className="mt-1 block font-semibold">{serviceMode}</strong><p className="mt-1 break-words text-sm text-muted-foreground">{whatsapp || "Entre em contato com a loja"}</p></div>
          <div><span className="block text-xs uppercase tracking-widest text-muted-foreground">Cardápio</span><strong className="mt-1 block font-semibold">{brandName}</strong><p className="mt-1 text-sm text-muted-foreground">Confira os produtos e opções disponíveis.</p></div>
          {theme.footer !== "minimal" && <div><span className="block text-xs uppercase tracking-widest text-muted-foreground">Redes e canais</span>{socialLinks.length ? <div className="mt-2 flex flex-wrap gap-3">{socialLinks.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">{label}</a>)}</div> : <p className="mt-1 text-sm text-muted-foreground">Os canais sociais ainda não foram configurados.</p>}</div>}
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{footerText}</span><a href="#inicio" className="w-fit hover:text-foreground">Voltar ao topo ↑</a>
        </div>
      </div>
    </footer>
  );
}
