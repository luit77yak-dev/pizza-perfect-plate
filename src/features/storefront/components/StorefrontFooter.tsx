import type { OrganizationSettings } from "@/lib/domain/types";
import type { StorefrontTheme } from "@/features/storefront/themes/types";

type StorefrontFooterProps = {
  theme: StorefrontTheme;
  settings: OrganizationSettings;
  organizationName: string;
};

export function StorefrontFooter({ theme, settings, organizationName }: StorefrontFooterProps) {
  const serviceMode =
    settings.delivery_enabled && settings.pickup_enabled
      ? "Delivery e retirada"
      : settings.delivery_enabled
        ? "Delivery"
        : settings.pickup_enabled
          ? "Retirada no local"
          : "Consulte a loja";

  if (theme.id === "burger-club") {
    return (
      <footer id="contato" className="hc-footer">
        <div className="hc-footer-top">
          <div><p className="hc-section-kicker">Contato</p><h2>{organizationName}.</h2></div>
          <a href="#cardapio">Ver o cardápio <span>→</span></a>
        </div>
        <div className="hc-footer-grid">
          <div><span>Atendimento</span><strong>{serviceMode}</strong><p>{settings.whatsapp_phone || "Entre em contato com a loja"}</p></div>
          <div><span>Funcionamento</span><strong>Horários da loja</strong><p>Consulte a disponibilidade atualizada no atendimento</p></div>
          <div><span>Cardápio</span><strong>{organizationName}</strong><p>Confira os produtos e opções disponíveis no cardápio</p></div>
        </div>
        <div className="hc-footer-bottom"><span>{organizationName}</span><span>Obrigado pela preferência.</span><a href="#inicio">Voltar ao topo ↑</a></div>
      </footer>
    );
  }

  if (theme.id !== "neroxa-classic") {
    return (
      <section id="contato" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="rounded-2xl border border-secondary-foreground/10 bg-secondary p-7 text-secondary-foreground shadow-lifted sm:p-10 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Contato</p>
          <h2 className="mt-3 break-words text-[clamp(2.5rem,10vw,6rem)] leading-[.92]">{organizationName}</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <a href="#cardapio" className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4 transition-colors hover:border-primary hover:bg-secondary-foreground/10"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Cardápio</span><span className="mt-1 block font-semibold">Ver os produtos</span></a>
            <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Atendimento</span><span className="mt-1 block font-semibold">{serviceMode}</span></div>
            <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4 sm:col-span-2 lg:col-span-1"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">WhatsApp</span><span className="mt-1 block break-words font-semibold">{settings.whatsapp_phone || "Entre em contato com a loja"}</span></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <footer id="contato" className="ppp-engine-footer">
      <div className="ppp-engine-footer-top">
        <div><p className="ppp-engine-footer-kicker">{organizationName}</p><h2>Vamos fazer<br /><em>seu pedido?</em></h2></div>
        <a className="ppp-engine-footer-cta" href="#cardapio">Ver o cardápio <span>→</span></a>
      </div>
      <div className="ppp-engine-footer-grid">
        <div><span>Funcionamento</span><strong>Horários da loja</strong><p>Consulte a disponibilidade atualizada no atendimento</p></div>
        <div><span>Atendimento</span><strong>{serviceMode}</strong><p>{settings.whatsapp_phone || "Entre em contato com a loja"}</p></div>
        <div><span>Cardápio</span><strong>{organizationName}</strong><p>Confira os produtos e opções disponíveis no cardápio</p></div>
      </div>
      <div className="ppp-engine-footer-bottom"><span>{organizationName}</span><span>Obrigado pela preferência.</span><a href="#inicio">Voltar ao topo ↑</a></div>
    </footer>
  );
}
