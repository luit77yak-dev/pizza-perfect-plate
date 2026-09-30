export const CLIENT_STATUSES = [
  "LEAD",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTED",
  "IMPLEMENTATION",
  "ACTIVE",
  "PAUSED",
  "DELINQUENT",
  "CANCELLED",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type NeroxaClient = {
  id: string;
  organization_id: string | null;
  status: ClientStatus;
  legal_name: string | null;
  trade_name: string | null;
  tax_id: string | null;
  notes: string | null;
  acquired_at: string | null;
  contracted_at: string | null;
  activated_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NeroxaClientContact = {
  id: string;
  client_id: string;
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Lead",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  CONTRACTED: "Contratado",
  IMPLEMENTATION: "Implantação",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DELINQUENT: "Inadimplente",
  CANCELLED: "Cancelado",
};

export const STATUS_TONE: Record<ClientStatus, string> = {
  LEAD: "border-slate-300 bg-slate-100 text-slate-700",
  PROPOSAL: "border-blue-200 bg-blue-50 text-blue-700",
  NEGOTIATION: "border-violet-200 bg-violet-50 text-violet-700",
  CONTRACTED: "border-amber-200 bg-amber-50 text-amber-700",
  IMPLEMENTATION: "border-orange-200 bg-orange-50 text-orange-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAUSED: "border-slate-300 bg-slate-100 text-slate-600",
  DELINQUENT: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

export const ALLOWED_TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  LEAD: ["PROPOSAL", "CANCELLED"],
  PROPOSAL: ["NEGOTIATION", "CONTRACTED", "CANCELLED"],
  NEGOTIATION: ["PROPOSAL", "CONTRACTED", "CANCELLED"],
  CONTRACTED: ["IMPLEMENTATION", "CANCELLED"],
  IMPLEMENTATION: ["ACTIVE", "PAUSED", "CANCELLED"],
  ACTIVE: ["PAUSED", "DELINQUENT", "CANCELLED"],
  PAUSED: ["ACTIVE", "DELINQUENT", "CANCELLED"],
  DELINQUENT: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
};
