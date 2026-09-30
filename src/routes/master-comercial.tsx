import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isNeroxaStaff } from "@/features/master/clients/services";
import { MasterShell } from "@/features/master/shell/MasterShell";
import {
  CONTRACT_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  type CommercialContract,
  type CommercialProposal,
} from "@/features/master/commercial/types";
import { loadCommercialOverview } from "@/features/master/commercial/services";

export const Route = createFileRoute("/master/comercial")({
  component: MasterCommercialPage,
});

const proposalTone: Record<keyof typeof PROPOSAL_STATUS_LABELS, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-50 text-blue-700",
  NEGOTIATION: "bg-violet-50 text-violet-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  EXPIRED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const contractTone: Record<keyof typeof CONTRACT_STATUS_LABELS, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SUSPENDED: "bg-amber-50 text-amber-700",
  TERMINATED: "bg-red-50 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-500",
};

function MasterCommercialPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [proposals, setProposals] = useState<CommercialProposal[]>([]);
  const [contracts, setContracts] = useState<CommercialContract[]>([]);
  const [clients, setClients] = useState<{ id: string; legal_name: string | null; trade_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (initial = false) => {
    setError(null);
    initial ? setLoading(true) : setRefreshing(true);
    try {
      const staff = await isNeroxaStaff();
      setAuthorized(staff);
      if (!staff) return;

      const overview = await loadCommercialOverview();
      setProposals(overview.proposals);
      setContracts(overview.contracts);
      setClients(overview.clients);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o Comercial.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  const clientMap = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const metrics = useMemo(() => ({
    totalProposals: proposals.length,
    openProposals: proposals.filter((item) => ["SENT", "NEGOTIATION"].includes(item.status)).length,
    acceptedProposals: proposals.filter((item) => item.status === "ACCEPTED").length,
    activeContracts: contracts.filter((item) => item.status === "ACTIVE").length,
  }), [proposals, contracts]);

  const recentProposals = proposals.slice(0, 5);
  const recentContracts = contracts.slice(0, 5);

  if (authorized === false) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8">
          <ShieldCheck className="mb-4 h-8 w-8 text-slate-300" />
          <h1 className="text-2xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-300">
            O Comercial do Neroxa Master é exclusivo para a equipe interna.
          </p>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </div>
      </main>
    );
  }

  if (authorized === null || loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        <Loader2 className="h-7 w-7 animate-spin" />
      </main>
    );
  }

  return (
    <MasterShell>
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Gestão · Comercial
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Comercial</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Acompanhe propostas e contratos sem misturar regras comerciais com a operação dos clientes.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </section>

        {error && (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={FileText} label="Propostas" value={metrics.totalProposals} hint="Total registrado" />
          <Metric icon={Send} label="Em andamento" value={metrics.openProposals} hint="Enviadas ou em negociação" />
          <Metric icon={CheckCircle2} label="Aceitas" value={metrics.acceptedProposals} hint="Prontas para contrato" />
          <Metric icon={FileCheck2} label="Contratos ativos" value={metrics.activeContracts} hint="Vínculos comerciais ativos" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <CommercialList
            title="Propostas recentes"
            description="Últimas movimentações comerciais"
            icon={FileText}
            empty="Nenhuma proposta cadastrada ainda."
          >
            {recentProposals.map((proposal) => {
              const client = clientMap.get(proposal.client_id);
              return (
                <div key={proposal.id} className="flex items-center gap-3 border-b border-slate-100 py-3.5 last:border-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{proposal.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {client?.trade_name || client?.legal_name || "Cliente não identificado"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${proposalTone[proposal.status]}`}>
                    {PROPOSAL_STATUS_LABELS[proposal.status]}
                  </span>
                </div>
              );
            })}
          </CommercialList>

          <CommercialList
            title="Contratos recentes"
            description="Últimos vínculos comerciais registrados"
            icon={FileCheck2}
            empty="Nenhum contrato cadastrado ainda."
          >
            {recentContracts.map((contract) => {
              const client = clientMap.get(contract.client_id);
              return (
                <div key={contract.id} className="flex items-center gap-3 border-b border-slate-100 py-3.5 last:border-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{contract.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {contract.contract_number || "Sem número"} · {client?.trade_name || client?.legal_name || "Cliente não identificado"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${contractTone[contract.status]}`}>
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </span>
                </div>
              );
            })}
          </CommercialList>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#102a2e] text-white">
                <BriefcaseBusiness className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Fluxo comercial</h2>
                <p className="text-xs text-slate-500">A fundação já controla as transições críticas.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {["Lead", "Proposta", "Negociação", "Aceite", "Contrato"].map((step, index, all) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {step}
                  </span>
                  {index < all.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-200 bg-[#102a2e] p-5 text-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-300" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Próximo módulo</p>
            </div>
            <h2 className="mt-2 text-lg font-semibold">Assinaturas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Depois de contrato, a próxima camada registra plano, preço contratado e recorrência.
            </p>
            <Link to="/master" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white">
              Voltar ao Master <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <Clock3 className="h-4 w-4 shrink-0" />
            Esta visão usa apenas dados reais disponíveis no módulo Comercial; métricas financeiras ficam para o módulo Financeiro.
          </div>
        </Card>
      </div>
    </MasterShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-4 w-4 text-slate-400" />
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  );
}

function CommercialList({
  title,
  description,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4">
        {children || <p className="py-8 text-center text-xs text-slate-500">{empty}</p>}
      </div>
    </Card>
  );
}
