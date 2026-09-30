export const PROPOSAL_STATUS_LABELS = {
  DRAFT: "Rascunho",
  SENT: "Enviada",
  NEGOTIATION: "Negociação",
  ACCEPTED: "Aceita",
  REJECTED: "Rejeitada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
} as const;

export const CONTRACT_STATUS_LABELS = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  TERMINATED: "Encerrado",
  EXPIRED: "Expirado",
} as const;

export type ProposalStatus = keyof typeof PROPOSAL_STATUS_LABELS;
export type ContractStatus = keyof typeof CONTRACT_STATUS_LABELS;

export type CommercialProposal = {
  id: string;
  client_id: string;
  status: ProposalStatus;
  title: string;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommercialContract = {
  id: string;
  client_id: string;
  proposal_id: string | null;
  status: ContractStatus;
  contract_number: string | null;
  title: string;
  started_at: string | null;
  ended_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommercialClient = {
  id: string;
  legal_name: string | null;
  trade_name: string | null;
};

export type CommercialOverview = {
  proposals: CommercialProposal[];
  contracts: CommercialContract[];
  clients: CommercialClient[];
};
