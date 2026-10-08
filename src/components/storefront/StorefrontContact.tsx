import type { OrganizationSettings } from "@/lib/domain/types";

type StorefrontContactProps = {
  settings: OrganizationSettings;
  isPizzaTheme?: boolean;
  isBurgerTheme?: boolean;
};

export function StorefrontContact({ settings, isPizzaTheme = false, isBurgerTheme = false }: StorefrontContactProps) {
  if (isBurgerTheme) {
    return (
      <footer id="contato" className="hc-footer">
        <div className="hc-footer-top">
          <div>
            <p className="hc-section-kicker">Contato</p>
            <h2>Burger <em>Club.</em></h2>
          </div>
          <a href="#cardapio">Ver o cardápio <span>→</span></a>
        </div>
        <div className="hc-footer-grid">
          <div>
            <span>Atendimento</span>
            <strong>{settings.delivery_enabled && settings.pickup_enabled ? "Salão e delivery" : settings.delivery_enabled ? "Delivery" : "Retirada"}</strong>
            <p>{settings.whatsapp_phone || "Consulte a loja"}</p>
          </div>
          <div>
            <span>Horários</span>
            <strong>Todos os dias</strong>
            <p>Consulte os horários da casa</p>
          </div>
          <div>
            <span>Cardápio</span>
            <strong>Burger Club</strong>
            <p>Hambúrgueres · Batatas · Combos · Bebidas</p>
          </div>
        </div>
        <div className="hc-footer-bottom">
          <span>Burger Club</span>
          <span>Feito para comer sem pressa.</span>
          <a href="#inicio">Voltar ao topo ↑</a>
        </div>
      </footer>
    );
  }

  if (!isPizzaTheme) {
    return (
      <section id="contato" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        <div className="rounded-2xl border border-secondary-foreground/10 bg-secondary p-7 text-secondary-foreground shadow-lifted sm:p-10 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Contato</p>
          <h2 className="mt-3 text-[clamp(3.5rem,12vw,8rem)] leading-[.82]">Pizza Club</h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <a href="#cardapio" className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4 transition-colors hover:border-primary hover:bg-secondary-foreground/10"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Cardápio</span><span className="mt-1 block font-semibold">Ver as pizzas</span></a>
            <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Atendimento</span><span className="mt-1 block font-semibold">{settings.delivery_enabled && settings.pickup_enabled ? "Salão e delivery" : settings.delivery_enabled ? "Delivery" : "Retirada"}</span></div>
            <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">WhatsApp</span><span className="mt-1 block font-semibold">{settings.whatsapp_phone || "Consulte a loja"}</span></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <footer id="contato" className="pc-footer">
      <div className="pc-footer-top">
        <div>
          <p className="pc-section-kicker">Pizza Club</p>
          <h2>Mais uma<br /><em>fatia?</em></h2>
        </div>
        <a className="pc-footer-cta" href="#cardapio">Ver as pizzas <span>→</span></a>
      </div>

      <div className="pc-footer-grid">
        <div>
          <span>Horários</span>
          <strong>Terça a domingo</strong>
          <p>18h às 0h</p>
        </div>
        <div>
          <span>Atendimento</span>
          <strong>{settings.delivery_enabled && settings.pickup_enabled ? "Salão e delivery" : settings.delivery_enabled ? "Delivery" : "Retirada"}</strong>
          <p>{settings.whatsapp_phone ? settings.whatsapp_phone : "Fale com a casa"}</p>
        </div>
        <div>
          <span>Cardápio</span>
          <strong>Pizza Club</strong>
          <p>Da casa · Assinatura · Para dividir</p>
        </div>
      </div>

      <div className="pc-footer-bottom">
        <span>Pizza Club</span>
        <span>Feito para comer sem pressa.</span>
        <a href="#inicio">Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}
