import type { OrganizationSettings } from "@/lib/domain/types";

type StorefrontContactProps = {
  settings: OrganizationSettings;
};

export function StorefrontContact({ settings }: StorefrontContactProps) {
  return (
    <section id="contato" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
      <div className="rounded-2xl border border-secondary-foreground/10 bg-secondary p-7 text-secondary-foreground shadow-lifted sm:p-10 lg:p-14">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-accent">Contato</p>
        <h2 className="mt-3 text-[clamp(3.5rem,12vw,8rem)] leading-[.82]">Bora pedir?</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <a href="#cardapio" className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4 transition-colors hover:border-primary hover:bg-secondary-foreground/10"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Cardápio</span><span className="mt-1 block font-semibold">Escolher agora</span></a>
          <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">Atendimento</span><span className="mt-1 block font-semibold">{settings.delivery_enabled && settings.pickup_enabled ? "Delivery e retirada" : settings.delivery_enabled ? "Delivery" : "Retirada"}</span></div>
          <div className="rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4"><span className="block text-xs uppercase tracking-widest text-secondary-foreground/55">WhatsApp</span><span className="mt-1 block font-semibold">{settings.whatsapp_phone || "Consulte a loja"}</span></div>
        </div>
      </div>
    </section>
  );
}
