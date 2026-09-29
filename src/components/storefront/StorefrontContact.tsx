import type { OrganizationSettings } from "@/lib/domain/types";

type StorefrontContactProps = {
  settings: OrganizationSettings;
};

export function StorefrontContact({ settings }: StorefrontContactProps) {
  return (
    <section id="contato" className="ppp-contact-section">
      <div className="ppp-contact-ticket">
        <div>
          <p className="ppp-contact-kicker">Visite</p>
          <h2>Quando quiser uma pizza especial.</h2>
          <div className="ppp-contact-details">
            <div>
              <span>Endereço</span>
              <strong>{settings.address || "Consulte a loja"}</strong>
            </div>
            <div>
              <span>Horário</span>
              <strong>Consulte o horário de atendimento</strong>
            </div>
            <div>
              <span>Atendimento</span>
              <strong>
                {settings.delivery_enabled && settings.pickup_enabled
                  ? "Salão, retirada e delivery"
                  : settings.delivery_enabled
                    ? "Delivery"
                    : "Retirada"}
              </strong>
            </div>
          </div>
        </div>
        <div className="ppp-contact-stub">
          <a href="#cardapio">Ver o cardápio</a>
        </div>
      </div>
    </section>
  );
}
