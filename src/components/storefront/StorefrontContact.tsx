import type { OrganizationSettings } from "@/lib/domain/types";

type StorefrontContactProps = {
  settings: OrganizationSettings;
};

export function StorefrontContact({ settings }: StorefrontContactProps) {
  const address =
    [
      settings.address_street,
      settings.address_number,
      settings.address_neighborhood,
      settings.address_city,
    ]
      .filter(Boolean)
      .join(", ") || "Consulte a loja";

  return (
    <section id="contato" className="ppp-contact-section">
      <div className="ppp-contact-ticket">
        <div>
          <p className="ppp-contact-kicker">Visite</p>
          <h2>Venha comer com a gente.</h2>
          <div className="ppp-contact-details">
            <div>
              <span>Endereço</span>
              <strong>{address}</strong>
            </div>
            <div>
              <span>Horário</span>
              <strong>Terça a domingo, das 18h30 às 23h</strong>
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
          <a href="#cardapio">Conheça o menu</a>
        </div>
      </div>
    </section>
  );
}
