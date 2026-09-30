import {useEffect,useMemo,useState} from "react";
import {createFileRoute} from "@tanstack/react-router";
import {AlertTriangle,CalendarClock,CheckCircle2,CircleDollarSign,CreditCard,Loader2,RefreshCw,ShieldCheck,WalletCards} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {isNeroxaStaff} from "@/features/master/clients/services";
import {MasterShell} from "@/features/master/shell/MasterShell";
import {INVOICE_STATUS_LABELS,type Invoice, type Payment} from "@/features/master/finance/types";
import {loadFinanceOverview} from "@/features/master/finance/services";

export const Route=createFileRoute("/master/financeiro")({component:MasterFinancePage});
const tone:Record<keyof typeof INVOICE_STATUS_LABELS,string>={PENDING:"bg-blue-50 text-blue-700",PAID:"bg-emerald-50 text-emerald-700",OVERDUE:"bg-red-50 text-red-700",CANCELLED:"bg-slate-100 text-slate-500",REFUNDED:"bg-violet-50 text-violet-700",NEGOTIATION:"bg-amber-50 text-amber-700"};
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const date=(v:string|null)=>v?new Intl.DateTimeFormat("pt-BR").format(new Date(v+"T12:00:00")):"—";

function MasterFinancePage(){
 const [authorized,setAuthorized]=useState<boolean|null>(null),[invoices,setInvoices]=useState<Invoice[]>([]),[payments,setPayments]=useState<Payment[]>([]),[clients,setClients]=useState<{id:string;legal_name:string|null;trade_name:string|null}[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState<string|null>(null);
 const load=async(initial=false)=>{setError(null);initial?setLoading(true):setRefreshing(true);try{const staff=await isNeroxaStaff();setAuthorized(staff);if(!staff)return;const o=await loadFinanceOverview();setInvoices(o.invoices);setPayments(o.payments);setClients(o.clients)}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar o financeiro.")}finally{setLoading(false);setRefreshing(false)}};
 useEffect(()=>{void load(true)},[]);
 const clientMap=useMemo(()=>new Map(clients.map(c=>[c.id,c])),[clients]);
 const metrics=useMemo(
  () => ({
   total: invoices.length,
   pending: invoices.filter((i)=>i.status==="PENDING").reduce((sum,i)=>sum+i.total_amount,0),
   overdue: invoices.filter((i)=>i.status==="OVERDUE").reduce((sum,i)=>sum+i.total_amount,0),
   paid: invoices.filter((i)=>i.status==="PAID").reduce((sum,i)=>sum+i.total_amount,0),
   payments: payments.filter((p)=>p.status==="CONFIRMED").reduce((sum,p)=>sum+p.amount,0),
  }),
  [invoices,payments],
 );
 const invoiceRows=invoices.slice(0,10).map((i)=>{
  const c=clientMap.get(i.client_id);
  return (
   <div key={i.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
    <div className="min-w-0 flex-1">
     <p className="text-sm font-medium">{i.invoice_number}</p>
     <p className="truncate text-xs text-slate-500">{c?.trade_name||c?.legal_name||"Cliente não identificado"} · vence {date(i.due_date)}</p>
    </div>
    <div className="flex items-center justify-between gap-3 sm:justify-end">
     <p className="text-sm font-semibold">{money(i.total_amount)}</p>
     <span className={"rounded-full px-2.5 py-1 text-[10px] font-medium "+tone[i.status]}>{INVOICE_STATUS_LABELS[i.status]}</span>
    </div>
   </div>
  );
 });
 const confirmedPayments=payments.filter((p)=>p.status==="CONFIRMED");
 const paymentRows=confirmedPayments.slice(0,5).map((p)=>(
  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
   <div className="min-w-0">
    <p className="text-xs font-medium">{clientMap.get(p.client_id)?.trade_name||clientMap.get(p.client_id)?.legal_name||"Cliente"}</p>
    <p className="text-[11px] text-slate-400">{p.method} · {date(p.paid_at)}</p>
   </div>
   <p className="text-sm font-semibold">{money(p.amount)}</p>
  </div>
 ));
 if(authorized===false)return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8"><ShieldCheck className="mb-4 h-8 w-8 text-slate-300"/><h1 className="text-2xl font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-slate-300">Financeiro é uma área interna do Neroxa Master.</p></div></main>;
 if(authorized===null||loading)return <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100"><Loader2 className="h-7 w-7 animate-spin"/></main>;
 return <MasterShell><div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6">
 <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Gestão · Financeiro</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Acompanhe faturas, recebimentos e valores em aberto sem misturar cobrança com a operação comercial.</p></div><Button variant="outline" onClick={()=>void load()} disabled={refreshing}><RefreshCw className={refreshing?"h-4 w-4 animate-spin":"h-4 w-4"}/>Atualizar</Button></section>
 {error&&<Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>}
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={CreditCard} label="Faturas" value={metrics.total.toString()} hint="Total registrado"/><Metric icon={CircleDollarSign} label="Em aberto" value={money(metrics.pending)} hint="Faturas pendentes"/><Metric icon={AlertTriangle} label="Inadimplência" value={money(metrics.overdue)} hint="Faturas vencidas"/><Metric icon={CheckCircle2} label="Recebido" value={money(metrics.paid)} hint="Faturas quitadas"/></div>
 <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)]">
 <Card className="border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#102a2e] text-white"><WalletCards className="h-4 w-4"/></div><div><h2 className="text-base font-semibold">Faturas</h2><p className="text-xs text-slate-500">Acompanhamento por vencimento e status</p></div></div><div className="mt-4 divide-y divide-slate-100">{invoiceRows}{invoices.length===0&&<div className="py-12 text-center"><WalletCards className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 text-sm font-medium text-slate-700">Nenhuma fatura cadastrada</p><p className="mt-1 text-xs text-slate-500">As faturas criadas no Master aparecerão aqui.</p></div>}</div></Card>
 <Card className="border-slate-200 bg-[#102a2e] p-5 text-slate-100 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recebimentos</p><h2 className="mt-2 text-lg font-semibold">Pagamentos confirmados</h2><p className="mt-2 text-sm leading-6 text-slate-300">Os pagamentos ficam separados das faturas para manter histórico e conciliação.</p><div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-[11px] text-slate-400">Total confirmado</p><p className="mt-1 text-2xl font-semibold">{money(metrics.payments)}</p></div><div className="mt-4 space-y-2">{paymentRows}{confirmedPayments.length===0&&<p className="py-6 text-center text-xs text-slate-400">Nenhum pagamento confirmado.</p>}</div><div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-slate-400"><CalendarClock className="h-4 w-4"/>Cobrança e automações entram em uma etapa posterior.</div></Card>
 </div></div></MasterShell>;
}
function Metric({icon:Icon,label,value,hint}:{icon:typeof CreditCard;label:string;value:string;hint:string}){return <Card className="border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-4 w-4 text-slate-400"/><p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></Card>}
