import { useMemo, useState } from "react";
import { BarChart3, Bell, Check, ChevronDown, ChevronUp, CreditCard, MapPin, Menu, Package, Palette, Pizza, Plus, ShoppingBag, Store, Users, Volume2, VolumeX, X } from "lucide-react";

type Status = "RECEIVED" | "CONFIRMED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED";
type Payment = "PAID" | "PENDING";
type DemoOrder = { id: number; name: string; time: string; status: Status; payment: Payment; fulfillment: "Entrega" | "Retirada"; neighborhood: string; fee: number; items: { name: string; quantity: number; price: number }[]; updated: boolean };
type Section = "overview" | "orders" | "catalog" | "customers" | "delivery" | "store" | "appearance" | "payments";

const initialOrders: DemoOrder[] = [
  { id: 1042, name: "Mariana Costa", time: "19:42", status: "PREPARING", payment: "PAID", fulfillment: "Entrega", neighborhood: "Centro", fee: 6, items: [{ name: "Pizza Margherita", quantity: 1, price: 49.9 }, { name: "Refrigerante", quantity: 1, price: 8 }], updated: false },
  { id: 1043, name: "Rafael Lima", time: "19:49", status: "RECEIVED", payment: "PENDING", fulfillment: "Retirada", neighborhood: "—", fee: 0, items: [{ name: "Pizza Quatro Queijos", quantity: 2, price: 56 }], updated: false },
  { id: 1044, name: "Beatriz Alves", time: "19:54", status: "CONFIRMED", payment: "PAID", fulfillment: "Entrega", neighborhood: "Jardim América", fee: 9, items: [{ name: "Pizza Calabresa", quantity: 1, price: 52 }], updated: false },
];
const labels: Record<Status, string> = { RECEIVED: "Recebido", CONFIRMED: "Confirmado", PREPARING: "Em preparo", READY: "Pronto", OUT_FOR_DELIVERY: "Saiu para entrega", DELIVERED: "Entregue" };
const nav: { key: Section; label: string; icon: typeof Store }[] = [
  { key: "overview", label: "Visão geral", icon: BarChart3 }, { key: "orders", label: "Pedidos", icon: ShoppingBag },
  { key: "catalog", label: "Cardápio", icon: Pizza }, { key: "customers", label: "Clientes", icon: Users },
  { key: "delivery", label: "Entregas", icon: MapPin }, { key: "payments", label: "Pagamentos", icon: CreditCard },
  { key: "store", label: "Minha loja", icon: Store }, { key: "appearance", label: "Aparência", icon: Palette },
];
const money = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const total = (order: DemoOrder) => order.items.reduce((sum, item) => sum + item.quantity * item.price, order.fee);
const nextStatus = (order: DemoOrder): Status | null => {
  const flow: Status[] = order.fulfillment === "Entrega"
    ? ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]
    : ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "DELIVERED"];
  return flow[flow.indexOf(order.status) + 1] ?? null;
};
const zones = [{ name: "Centro", fee: 6, eta: "20–30 min" }, { name: "Jardim América", fee: 9, eta: "30–40 min" }, { name: "Setor Sul", fee: 12, eta: "40–50 min" }];

export function FornoPanelDemo() {
  const [section, setSection] = useState<Section>("overview");
  const [orders, setOrders] = useState(initialOrders);
  const [expanded, setExpanded] = useState<number | null>(1042);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [seenUpdates, setSeenUpdates] = useState<number[]>([]);
  const paid = useMemo(() => orders.filter(o => o.payment === "PAID").reduce((n, o) => n + total(o), 0), [orders]);
  const pending = orders.filter(o => o.payment === "PENDING").length;
  const unread = orders.filter(o => o.updated && !seenUpdates.includes(o.id)).length;

  function notify(message: string) {
    setAlerts(current => [message, ...current].slice(0, 4));
    // Audio only after an explicit user gesture enabling it. Visual alerts always persist.
    if (soundEnabled && typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext;
        const ctx = new AudioContextClass();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.23);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(); oscillator.stop(ctx.currentTime + 0.24);
        oscillator.onended = () => { void ctx.close(); };
      } catch { /* Browsers may restrict audio; visible alerts remain available. */ }
    }
  }
  function simulateUpdate() {
    const target = orders.find(o => o.id === 1042);
    if (!target || target.status === "OUT_FOR_DELIVERY" || target.status === "DELIVERED") {
      notify("Alteração bloqueada: o pedido #1042 já saiu para entrega ou foi entregue.");
      return;
    }
    setOrders(current => current.map(o => o.id === 1042 ? { ...o, items: [...o.items, { name: "Sobremesa da casa", quantity: 1, price: 15 }], updated: true } : o));
    setSeenUpdates(current => current.filter(id => id !== 1042));
    setExpanded(1042);
    notify("Pedido #1042 atualizado: +1 sobremesa (simulação).");
  }
  function advance(order: DemoOrder) {
    const next = nextStatus(order);
    if (!next) return;
    setOrders(current => current.map(o => o.id === order.id ? { ...o, status: next } : o));
    notify(`Pedido #${order.id}: ${labels[next]}.`);
  }
  function navigate(key: Section) { setSection(key); setMobileMenu(false); }
  const title = nav.find(item => item.key === section)?.label ?? "Visão geral";

  return (
    <div className="forno-panel">
      <div className="forno-demo-banner">AMBIENTE DE DEMONSTRAÇÃO · Dados fictícios · Sem pedidos ou cobranças reais</div>
      <div className="forno-layout">
        <aside className={`forno-sidebar ${mobileMenu ? "is-open" : ""}`} aria-label="Menu do painel">
          <div className="forno-brand"><span className="forno-brand-symbol">✦</span><div><strong>FORNO DI PIETRA</strong><small>GESTÃO DO ESTABELECIMENTO</small></div><button className="forno-menu-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={19}/></button></div>
          <div className="forno-side-caption">OPERAÇÃO</div>
          <nav>{nav.map(({ key, label, icon: Icon }) => <button key={key} className={section === key ? "active" : ""} onClick={() => navigate(key)}><Icon size={18}/><span>{label}</span>{key === "orders" && unread > 0 && <b className="forno-nav-badge">{unread}</b>}</button>)}</nav>
          <div className="forno-side-bottom"><span className="forno-online-dot"/> Loja aberta <small>Modo fictício</small></div>
        </aside>
        {mobileMenu && <button className="forno-overlay" aria-label="Fechar navegação" onClick={() => setMobileMenu(false)}/>}
        <main className="forno-main">
          <header className="forno-topbar"><button className="forno-mobile-toggle" aria-label="Abrir menu" onClick={() => setMobileMenu(true)}><Menu size={23}/></button><div><span className="forno-eyebrow">PAINEL DO ESTABELECIMENTO</span><h1>{title}</h1></div><div className="forno-top-actions"><button title="Alternar som de notificações" aria-label={soundEnabled ? "Desativar som" : "Ativar som"} onClick={() => setSoundEnabled(v => !v)}>{soundEnabled ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><button title="Ver avisos" aria-label={`${alerts.length} avisos`} onClick={() => navigate("orders")}><Bell size={19}/>{unread > 0 && <span className="forno-notification-dot"/>}</button><span className="forno-avatar">FP</span></div></header>
          <div className="forno-content">
            {alerts.length > 0 && <div className="forno-alerts" role="status" aria-live="polite">{alerts.map((alert, i) => <div key={i}><Bell size={16}/><span>{alert}</span></div>)}</div>}
            {section === "overview" && <>
              <div className="forno-intro"><span className="forno-eyebrow">BEM-VINDO AO FORNO DI PIETRA</span><h2>Sua operação, em boas mãos.</h2><p>Uma visão elegante e prática de tudo o que acontece na sua cozinha.</p></div>
              <div className="forno-stats"><article><span>VENDAS PAGAS · DEMO</span><strong>{money(paid)}</strong><small>Somente pagamentos simulados</small></article><article><span>PEDIDOS ATIVOS</span><strong>{orders.filter(o => o.status !== "DELIVERED").length}</strong><small>Em atendimento</small></article><article><span>AGUARDANDO PAGAMENTO</span><strong>{pending}</strong><small>Sem cobrança real</small></article><article><span>ATUALIZAÇÕES PENDENTES</span><strong>{unread}</strong><small>Precisam de ciência</small></article></div>
              <div className="forno-section-heading"><div><span className="forno-eyebrow">ACOMPANHAMENTO</span><h2>Pedidos recentes</h2></div><button className="forno-text-button" onClick={() => navigate("orders")}>Ver todos →</button></div>
              {renderOrders(orders, expanded, setExpanded, advance, seenUpdates, setSeenUpdates)}
            </>}
            {section === "orders" && <>
              <div className="forno-section-heading"><div><span className="forno-eyebrow">CENTRAL DE PEDIDOS</span><h2>Pedidos da cozinha</h2></div><button className="forno-primary-button" onClick={simulateUpdate}><Plus size={16}/> Simular item adicional</button></div>
              <p className="forno-help">Simule a chegada de uma sobremesa ao pedido #1042. A atualização fica destacada até o operador confirmar a leitura. Não há checkout nem pagamento real.</p>
              <div className="forno-filters">{[["ALL","Todos"],["RECEIVED","Recebidos"],["PREPARING","Em preparo"],["READY","Prontos"],["OUT_FOR_DELIVERY","Em entrega"]].map(([key,label]) => <button key={key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
              {renderOrders(orders.filter(o => filter === "ALL" || o.status === filter), expanded, setExpanded, advance, seenUpdates, setSeenUpdates)}
            </>}
            {section === "catalog" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">CARDÁPIO</span><h2>Sabores da casa</h2></div><span className="forno-tag">Somente visualização</span></div><div className="forno-grid">{[["Margherita","49,90","Clássica com manjericão fresco"],["Quatro Queijos","56,00","Uma combinação cremosa"],["Calabresa","52,00","Tradicional e irresistível"],["Refrigerante","8,00","Bebida gelada"]].map(([name,price,desc]) => <article className="forno-product" key={name}><div className="forno-product-icon"><Pizza size={32}/></div><h3>{name}</h3><p>{desc}</p><strong>R$ {price}</strong></article>)}</div></>}
            {section === "customers" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">RELACIONAMENTO</span><h2>Clientes recentes</h2></div></div><div className="forno-table">{orders.map(o => <div key={o.id}><strong>{o.name}</strong><span>Pedido #{o.id}</span><span>{money(total(o))}</span></div>)}</div></>}
            {section === "delivery" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">ÁREAS DE ATENDIMENTO</span><h2>Bairros e taxas</h2></div><span className="forno-tag">Taxas fictícias</span></div><p className="forno-help">O proprietário define bairros atendidos e taxas fixas. Esta tela demonstra a apresentação, sem salvar alterações.</p><div className="forno-table">{zones.map(z => <div key={z.name}><strong><MapPin size={16}/>{z.name}</strong><span>{z.eta}</span><b>{money(z.fee)}</b></div>)}</div></>}
            {section === "payments" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">PAGAMENTOS</span><h2>Resumo financeiro</h2></div><span className="forno-tag">Simulação · Sem gateway</span></div><div className="forno-stats"><article><span>APROVADOS</span><strong>{money(paid)}</strong><small>Valores fictícios</small></article><article><span>PENDENTES</span><strong>{pending}</strong><small>Pedidos sem confirmação</small></article></div><div className="forno-table">{orders.map(o => <div key={o.id}><strong>Pedido #{o.id}</strong><span>{o.payment === "PAID" ? "Pagamento aprovado · simulado" : "Aguardando pagamento · simulado"}</span><b>{money(total(o))}</b></div>)}</div></>}
            {section === "store" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">ESTABELECIMENTO</span><h2>Minha loja</h2></div><span className="forno-tag">Prévia</span></div><div className="forno-detail-card"><h3>Forno di Pietra</h3><p>Pizzaria artesanal · Identidade premium</p><div className="forno-info-row"><span>Atendimento</span><strong>18h às 23h (fictício)</strong></div><div className="forno-info-row"><span>Modalidades</span><strong>Entrega e retirada</strong></div><div className="forno-info-row"><span>Regiões</span><strong>3 bairros de exemplo</strong></div></div></>}
            {section === "appearance" && <><div className="forno-section-heading"><div><span className="forno-eyebrow">IDENTIDADE VISUAL</span><h2>A essência da marca</h2></div></div><div className="forno-detail-card"><h3>Forno di Pietra · Tema premium</h3><p>O cardápio e o painel compartilham a mesma linguagem: grafite, creme, cobre e tipografia refinada.</p><div className="forno-swatches"><span style={{background:"#171a19"}}/><span style={{background:"#e9dfce"}}/><span style={{background:"#c99262"}}/><span style={{background:"#6f7b65"}}/></div><p>Em uma futura versão, outros estabelecimentos poderão usar identidades visuais totalmente diferentes sem duplicar o Delivery Engine.</p></div></>}
            <footer className="forno-footer">NEROXA DELIVERY <span>·</span> FORNO DI PIETRA <span>·</span> DEMONSTRAÇÃO ISOLADA</footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function renderOrders(orders: DemoOrder[], expanded: number | null, setExpanded: (id: number | null) => void, advance: (order: DemoOrder) => void, seenUpdates: number[], setSeenUpdates: (ids: number[]) => void) {
  return <div className="forno-order-list">{orders.length === 0 && <div className="forno-empty">Nenhum pedido neste filtro.</div>}{orders.map(order => {
    const isExpanded = expanded === order.id;
    const unread = order.updated && !seenUpdates.includes(order.id);
    const next = nextStatus(order);
    return <article key={order.id} className={`forno-order ${unread ? "forno-order-updated" : ""}`}>
      <button className="forno-order-head" onClick={() => setExpanded(isExpanded ? null : order.id)} aria-expanded={isExpanded}>
        <span className="forno-order-number">#{order.id}<small>{order.time}</small></span>
        <span className="forno-order-customer"><strong>{order.name}</strong><small>{order.fulfillment} · {order.neighborhood}</small></span>
        <span className={`forno-status status-${order.status.toLowerCase()}`}>{labels[order.status]}</span>
        <strong className="forno-order-price">{money(total(order))}</strong>
        {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
      </button>
      {unread && <div className="forno-update-badge"><Bell size={15}/> NOVOS ITENS · AGUARDANDO CIÊNCIA</div>}
      {isExpanded && <div className="forno-order-detail">
        <div className="forno-order-items">{order.items.map((item, index) => <div key={index}><span><b>{item.quantity}×</b> {item.name}{order.updated && index === order.items.length - 1 && <em> NOVO</em>}</span><strong>{money(item.quantity * item.price)}</strong></div>)}</div>
        <div className="forno-info-row"><span>Taxa de entrega</span><strong>{money(order.fee)}</strong></div>
        <div className="forno-info-row"><span>Pagamento</span><strong>{order.payment === "PAID" ? "Aprovado (simulado)" : "Pendente (simulado)"}</strong></div>
        <div className="forno-order-actions">
          {unread && <button className="forno-primary-button" onClick={() => setSeenUpdates([...seenUpdates, order.id])}><Check size={16}/> Confirmar ciência</button>}
          {next && <button className="forno-secondary-button" onClick={() => advance(order)}>Avançar para: {labels[next]}</button>}
        </div>
      </div>}
    </article>;
  })}</div>;
}
