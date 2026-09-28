import type { OrganizationSettings } from "@/lib/domain/types";

type StorefrontContactProps = {
  settings: OrganizationSettings;
};

export function StorefrontContact({ settings }: StorefrontContactProps) {
  return (
    <section id="contato" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6"><div className="rounded-[.75rem] border-2 border-secondary bg-primary p-7 text-primary-foreground shadow-lifted sm:p-10 lg:p-14"><p className="text-xs font-semibold uppercase tracking-[.2em] opacity-75">Contato</p><h2 className="mt-2 text-[clamp(4.5rem,15vw,10rem)] uppercase leading-[.75]">Bora pedir?</h2><div className="mt-10 grid gap-3 sm:grid-cols-3"><a href="#cardapio" className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)] transition-transform hover:-translate-y-1"><span className="block text-xs uppercase tracking-widest opacity-60">Cardápio</span><span className="mt-1 block font-semibold">Escolher agora</span></a><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">Atendimento</span><span className="mt-1 block font-semibold">{settings.delivery_enabled && settings.pickup_enabled ? "Delivery e retirada" : settings.delivery_enabled ? "Delivery" : "Retirada"}</span></div><div className="rounded-sm border-2 border-secondary bg-background p-4 text-foreground shadow-[4px_4px_0_rgba(0,0,0,.7)]"><span className="block text-xs uppercase tracking-widest opacity-60">WhatsApp</span><span className="mt-1 block font-semibold">{settings.whatsapp_phone || "Consulte a loja"}</span></div></div></div></section>
  );
}
