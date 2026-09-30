import { createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowRight, Building2, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MasterShell } from "@/features/master/shell/MasterShell";

export const Route = createFileRoute("/master")({
  component: MasterOverviewPage,
});

function MasterOverviewPage() {
  return (
    <MasterShell>
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6">
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Visão geral</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Neroxa Master</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Centro operacional da plataforma. Os módulos serão ativados conforme cada domínio estiver estruturado e validado.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Clientes" value="—" hint="Base comercial" />
          <Metric icon={Activity} label="MRR" value="—" hint="Receita recorrente" />
          <Metric icon={Building2} label="Implantações" value="—" hint="Em andamento" />
          <Metric icon={ShieldCheck} label="Segurança" value="Ativa" hint="Acesso por permissão" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Próximas áreas</h2>
                <p className="mt-1 text-xs text-slate-500">Construídas em módulos independentes.</p>
              </div>
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {[
                ["Comercial", "Leads, propostas e contratos"],
                ["Assinaturas", "Planos contratados e recorrência"],
                ["Financeiro", "Cobranças, pagamentos e inadimplência"],
                ["Implantação", "Projetos, tarefas e ativação"],
              ].map(([title, description]) => (
                <div key={title} className="flex items-center gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-200 bg-[#102a2e] p-5 text-slate-100 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Princípio</p>
            <h2 className="mt-2 text-lg font-semibold">Primeiro a fundação. Depois a escala.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Cada módulo terá suas próprias permissões, serviços e regras de negócio, sem transformar o Master em um painel monolítico.
            </p>
          </Card>
        </div>
      </div>
    </MasterShell>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return (
    <Card className="border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-4 w-4 text-slate-400" />
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  );
}
