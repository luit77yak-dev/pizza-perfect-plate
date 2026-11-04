import { X } from "lucide-react";
import type {
  CartItem,
  DeliveryZone,
  FulfillmentType,
  Organization,
  OrganizationSettings,
} from "@/lib/domain/types";

type CheckoutPanelProps = {
  organization: Organization;
  settings: OrganizationSettings;
  deliveryZones: DeliveryZone[];
  items: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: (order: {
    id: string;
    number: number;
    phone: string;
    items?: CartItem[] | undefined;
    subtotal?: number | undefined;
    total?: number | undefined;
    fulfillment?: FulfillmentType | undefined;
    status?: string | undefined;
  }) => void;
  storeOpen: boolean;
  storeStatusLabel: string;
  existingOrder?: {
    id: string;
    number: number;
    phone: string;
    items?: CartItem[] | undefined;
    subtotal?: number | undefined;
    total?: number | undefined;
    fulfillment?: FulfillmentType | undefined;
  } | null;
};

/**
 * F02 release containment. The public phone/UUID RPCs are not valid buyer
 * authorization. Until the server capability backend is admitted, do not
 * collect customer details, send orders or pretend that checkout succeeded.
 * The original UI remains in git history and in the isolated candidate chain.
 */
export function CheckoutPanel({
  onClose,
  existingOrder = null,
}: CheckoutPanelProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="neroxa-checkout-suspended-title"
      className="ppp-checkout-panel fixed inset-0 z-[140] overflow-y-auto bg-black/70 backdrop-blur-md"
    >
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center bg-[#06282d] px-6 py-12 text-[#f4eee2]">
        <div className="rounded-3xl border border-white/15 bg-white/[.06] p-6 shadow-soft sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">
                Segurança NEROXA
              </p>
              <h1
                id="neroxa-checkout-suspended-title"
                className="mt-3 text-2xl font-semibold sm:text-3xl"
              >
                {existingOrder
                  ? "Alterações do pedido temporariamente indisponíveis"
                  : "Checkout temporariamente indisponível"}
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar aviso"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/20"
            >
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-5 text-sm leading-6 text-[#f4eee2]/85">
            Este canal está em validação de segurança. Nenhum pedido ou alteração
            será enviado aqui. Entre em contato com a loja pelo canal oficial
            para receber atendimento.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 min-h-11 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Voltar à loja
          </button>
        </div>
      </div>
    </div>
  );
}
