import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MapPin,
  Menu,
  Palette,
  Pizza,
  Plus,
  ShoppingBag,
  Store,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { useCustomerDialog } from "@/features/storefront/hooks/use-customer-dialog";

import { useDemoData } from "./data/store";
import { notifyState, appendDemoItem } from "./data/model";
import type { DemoOrder } from "./data/model";
import { demoStyle } from "./data/catalog-adapter";
import { DemoCatalogManager, DemoStoreEditor } from "./DemoManagement";
type Status = DemoOrder["status"];
type Section =
  | "overview"
  | "orders"
  | "catalog"
  | "customers"
  | "delivery"
  | "store"
  | "appearance"
  | "payments";

const labels: Record<Status, string> = {
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
};
const nav: { key: Section; label: string; icon: typeof Store }[] = [
  { key: "overview", label: "Visão geral", icon: BarChart3 },
  { key: "orders", label: "Pedidos", icon: ShoppingBag },
  { key: "catalog", label: "Cardápio", icon: Pizza },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "delivery", label: "Entregas", icon: MapPin },
  { key: "payments", label: "Pagamentos", icon: CreditCard },
  { key: "store", label: "Minha loja", icon: Store },
  { key: "appearance", label: "Aparência", icon: Palette },
];
const money = (amount: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
const total = (order: DemoOrder) =>
  order.items.reduce((sum, item) => sum + item.quantity * item.price, order.fee);
const nextStatus = (order: DemoOrder): Status | null => {
  const flow: Status[] =
    order.fulfillment === "Entrega"
      ? ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]
      : ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "DELIVERED"];
  const index = flow.indexOf(order.status);
  return index < 0 ? null : (flow[index + 1] ?? null);
};
export function FornoPanelDemo() {
  const [section, setSection] = useState<Section>("overview");
  const { data: state, ready, warning, update, reset } = useDemoData();
  const orders = state.orders,
    zones = state.zones;
  const setOrders = (fn: (orders: DemoOrder[]) => DemoOrder[]) =>
    update((s) => ({ ...s, orders: fn(s.orders) }));
  const setZones = (fn: (zones: typeof state.zones) => typeof state.zones) =>
    update((s) => ({ ...s, zones: fn(s.zones) }));
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(1042);
  const alerts = state.notifications;
  const unreadNotices = alerts.filter((n) => !n.read).length;
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [isMobile, setIsMobile] = useState(false);

  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneFee, setZoneFee] = useState("");
  const [zoneError, setZoneError] = useState("");
  const menuRef = useCustomerDialog(() => setMobileMenu(false), isMobile && mobileMenu);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const update = () => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileMenu(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!isMobile || !mobileMenu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile, mobileMenu]);
  const paid = useMemo(() => orders.reduce((n, o) => n + o.paidAmount, 0), [orders]);
  const pending = orders.filter((o) => o.payment === "PENDING").length;
  const unread = orders.filter((o) => o.updated).length;
  const pendingAmount = orders.reduce((n, o) => n + Math.max(0, total(o) - o.paidAmount), 0);

  function notify(message: string) {
    update((s) => notifyState(s, message, message));
    // Audio only after an explicit user gesture enabling it. Visual alerts always persist.
    if (soundEnabled && typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext;
        const ctx = new AudioContextClass();
        void ctx.resume().catch(() => {});
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.23);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.24);
        oscillator.onended = () => {
          void ctx.close();
        };
      } catch {
        /* Browsers may restrict audio; visible alerts remain available. */
      }
    }
  }
  function simulateUpdate() {
    try {
      update((s) => appendDemoItem(s, 1042, { name: "Sobremesa da casa", quantity: 1, price: 15 }));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Alteração bloqueada.");
      return;
    }
    setFilter("ALL");
    setSection("orders");
    setExpanded(1042);
    notify("Pedido #1042 atualizado: +1 sobremesa; valor adicional pendente (simulação).");
  }
  function advance(order: DemoOrder) {
    const next = nextStatus(order);
    if (!next) return;
    setOrders((current) =>
      current.map((o) => (o.id === order.id ? { ...o, status: nextStatus(o) ?? o.status } : o)),
    );
    notify(`Pedido #${order.id}: ${labels[next]}.`);
  }
  function acknowledge(id: number) {
    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? {
              ...order,
              updated: false,
              items: order.items.map((item) => ({ ...item, added: false })),
            }
          : order,
      ),
    );
    notify(`Pedido #${id}: ciência confirmada (simulação).`);
  }
  function resetZoneForm() {
    setEditingZone(null);
    setZoneName("");
    setZoneFee("");
    setZoneError("");
  }
  function saveZone() {
    const name = zoneName.trim();
    const fee = Number(zoneFee);
    if (!name || !zoneFee.trim() || !Number.isFinite(fee) || fee < 0 || fee > 9999) {
      setZoneError("Informe um bairro e uma taxa válida entre R$ 0 e R$ 9.999.");
      return;
    }
    if (
      zones.some(
        (zone) =>
          zone.id !== editingZone &&
          zone.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      setZoneError("Este bairro já existe na demonstração.");
      return;
    }
    if (!editingZone && zones.length >= 50) {
      setZoneError("Limite demonstrativo de 50 bairros atingido.");
      return;
    }
    const rounded = Math.round((fee + Number.EPSILON) * 100) / 100;
    setZones((current) =>
      editingZone
        ? current.map((zone) => (zone.id === editingZone ? { ...zone, name, fee: rounded } : zone))
        : [...current, { id: crypto.randomUUID(), name, fee: rounded, eta: "30–40 min" }],
    );
    resetZoneForm();
    notify("Bairro e taxa atualizados apenas nesta demonstração.");
  }
  function navigate(key: Section) {
    setSection(key);
    setMobileMenu(false);
  }
  const title = nav.find((item) => item.key === section)?.label ?? "Visão geral";

  return (
    <div className="forno-panel" style={demoStyle(state)}>
      <div className="forno-demo-banner" role="note">
        AMBIENTE DE DEMONSTRAÇÃO · Dados fictícios · Sem pedidos ou cobranças reais
      </div>
      <div className="forno-layout">
        <aside
          className={`forno-sidebar ${mobileMenu ? "is-open" : ""}`}
          id="demo-panel-menu"
          aria-label="Menu do painel"
          ref={menuRef}
          role={isMobile && mobileMenu ? "dialog" : undefined}
          aria-modal={isMobile && mobileMenu ? true : undefined}
          data-customer-dialog={isMobile && mobileMenu ? true : undefined}
          tabIndex={-1}
          inert={isMobile && !mobileMenu}
        >
          <div className="forno-brand">
            <span className="forno-brand-symbol">✦</span>
            <div>
              <strong>{state.store.name}</strong>
              <small>GESTÃO DO ESTABELECIMENTO</small>
            </div>
            <button
              className="forno-menu-close"
              onClick={() => setMobileMenu(false)}
              aria-label="Fechar menu"
            >
              <X size={19} />
            </button>
          </div>
          <div className="forno-side-caption">OPERAÇÃO</div>
          <nav>
            {nav.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={section === key ? "active" : ""}
                aria-current={section === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "orders" && unread > 0 && <b className="forno-nav-badge">{unread}</b>}
              </button>
            ))}
          </nav>
          <div className="forno-side-bottom">
            <span className="forno-online-dot" />{" "}
            {state.store.open ? "Loja aberta" : "Loja fechada"} <small>Modo fictício</small>
          </div>
        </aside>
        {mobileMenu && (
          <button
            className="forno-overlay"
            aria-label="Fechar navegação"
            onClick={() => setMobileMenu(false)}
          />
        )}
        <main className="forno-main" inert={isMobile && mobileMenu}>
          <header className="forno-topbar">
            <button
              className="forno-mobile-toggle"
              aria-label="Abrir menu"
              aria-controls="demo-panel-menu"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={23} />
            </button>
            <div>
              <span className="forno-eyebrow">PAINEL DO ESTABELECIMENTO</span>
              <h1>{title}</h1>
            </div>
            <div className="forno-top-actions">
              <button
                title="Alternar som de notificações"
                aria-label={soundEnabled ? "Desativar som" : "Ativar som"}
                aria-pressed={soundEnabled}
                onClick={() => setSoundEnabled((v) => !v)}
              >
                {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
              </button>
              <button
                title="Ver avisos"
                aria-label={`Ver avisos: ${unreadNotices}`}
                aria-expanded={noticesOpen}
                aria-controls="demo-notifications"
                onClick={() => setNoticesOpen((v) => !v)}
              >
                <Bell size={19} />
                {unreadNotices > 0 && <b className="forno-nav-badge">{unreadNotices}</b>}
              </button>
              <span className="forno-avatar">FP</span>
            </div>
          </header>
          <div className="forno-content">
            {warning && (
              <p role="status" className="forno-help">
                {warning}
              </p>
            )}
            {!ready && <p role="status">Carregando dados locais…</p>}
            {noticesOpen && (
              <section
                id="demo-notifications"
                className="demo-notifications"
                aria-label="Central de notificações"
              >
                <div className="forno-section-heading">
                  <h2>Notificações · {unreadNotices} não lidas</h2>
                  <button className="forno-secondary-button" onClick={() => setNoticesOpen(false)}>
                    Fechar avisos
                  </button>
                </div>
                <div className="demo-actions">
                  <button
                    className="forno-secondary-button"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        notifications: s.notifications.map((n) => ({ ...n, read: true })),
                      }))
                    }
                  >
                    Marcar todas como lidas
                  </button>
                  <button
                    className="forno-secondary-button"
                    onClick={() => update((s) => ({ ...s, notifications: [] }))}
                  >
                    Limpar notificações
                  </button>
                </div>
                {alerts.length === 0 && <p>Nenhuma notificação.</p>}
                {alerts.map((n) => (
                  <article key={n.id}>
                    <p>{n.message}</p>
                    <small>{n.read ? "Lida" : "Não lida"}</small>
                    <div className="demo-actions">
                      {!n.read && (
                        <button
                          className="forno-secondary-button"
                          aria-label={`Marcar como lida: ${n.message}`}
                          onClick={() =>
                            update((s) => ({
                              ...s,
                              notifications: s.notifications.map((v) =>
                                v.id === n.id ? { ...v, read: true } : v,
                              ),
                            }))
                          }
                        >
                          Marcar como lida
                        </button>
                      )}
                      <button
                        className="forno-secondary-button"
                        aria-label={`Dispensar: ${n.message}`}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            notifications: s.notifications.filter((v) => v.id !== n.id),
                          }))
                        }
                      >
                        Dispensar
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
            {section === "overview" && (
              <>
                <div className="forno-intro">
                  <span className="forno-eyebrow">
                    BEM-VINDO · {state.store.name.toLocaleUpperCase("pt-BR")}
                  </span>
                  <h2>Sua operação, em boas mãos.</h2>
                  <p>Uma visão elegante e prática de tudo o que acontece na sua cozinha.</p>
                </div>
                <div className="forno-stats">
                  <article>
                    <span>VENDAS PAGAS · DEMO</span>
                    <strong>{money(paid)}</strong>
                    <small>Somente pagamentos simulados</small>
                  </article>
                  <article>
                    <span>PEDIDOS ATIVOS</span>
                    <strong>{orders.filter((o) => o.status !== "DELIVERED").length}</strong>
                    <small>Em atendimento</small>
                  </article>
                  <article>
                    <span>AGUARDANDO PAGAMENTO</span>
                    <strong>{pending}</strong>
                    <small>Sem cobrança real</small>
                  </article>
                  <article>
                    <span>ATUALIZAÇÕES PENDENTES</span>
                    <strong>{unread}</strong>
                    <small>Precisam de ciência</small>
                  </article>
                </div>
                <div className="forno-section-heading">
                  <div>
                    <span className="forno-eyebrow">ACOMPANHAMENTO</span>
                    <h2>Pedidos recentes</h2>
                  </div>
                  <button className="forno-text-button" onClick={() => navigate("orders")}>
                    Ver todos →
                  </button>
                </div>
                {renderOrders(orders, expanded, setExpanded, advance, acknowledge)}
              </>
            )}
            {section === "orders" && (
              <>
                <div className="forno-section-heading">
                  <div>
                    <span className="forno-eyebrow">CENTRAL DE PEDIDOS</span>
                    <h2>Pedidos da cozinha</h2>
                  </div>
                  <button className="forno-primary-button" onClick={simulateUpdate}>
                    <Plus size={16} /> Simular item adicional
                  </button>
                </div>
                <p className="forno-help">
                  Simule a chegada de uma sobremesa ao pedido #1042. A atualização fica destacada
                  até o operador confirmar a leitura. Não há checkout nem pagamento real.
                </p>
                <div className="forno-filters" aria-label="Filtrar pedidos">
                  {(
                    [
                      ["ALL", "Todos"],
                      ["RECEIVED", "Recebidos"],
                      ["CONFIRMED", "Confirmados"],
                      ["PREPARING", "Em preparo"],
                      ["READY", "Prontos"],
                      ["OUT_FOR_DELIVERY", "Em entrega"],
                      ["DELIVERED", "Entregues"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={filter === key ? "selected" : ""}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {renderOrders(
                  orders.filter((o) => filter === "ALL" || o.status === filter),
                  expanded,
                  setExpanded,
                  advance,
                  acknowledge,
                )}
              </>
            )}
            {section === "catalog" && ready && (
              <DemoCatalogManager state={state} update={update} notify={notify} />
            )}
            {section === "customers" && (
              <section>
                <div className="forno-section-heading">
                  <h2>Clientes fictícios</h2>
                </div>
                <label className="demo-search">
                  Pesquisar cliente
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Nome fictício"
                  />
                </label>
                <div className="demo-list">
                  {[...new Set(orders.map((o) => o.name))]
                    .filter((name) =>
                      name
                        .toLocaleLowerCase("pt-BR")
                        .includes(customerSearch.toLocaleLowerCase("pt-BR")),
                    )
                    .map((name) => (
                      <article key={name}>
                        <button
                          className="forno-secondary-button"
                          aria-expanded={customerName === name}
                          onClick={() => setCustomerName((c) => (c === name ? null : name))}
                        >
                          {name}
                        </button>
                        {customerName === name && (
                          <>
                            <p>Cliente fictício · nenhum dado privado consultado.</p>
                            {renderOrders(
                              orders.filter((o) => o.name === name),
                              expanded,
                              setExpanded,
                              advance,
                              acknowledge,
                            )}
                          </>
                        )}
                      </article>
                    ))}
                </div>
                {![...new Set(orders.map((o) => o.name))].some((name) =>
                  name
                    .toLocaleLowerCase("pt-BR")
                    .includes(customerSearch.toLocaleLowerCase("pt-BR")),
                ) && <p className="forno-empty">Nenhum cliente fictício encontrado.</p>}
              </section>
            )}
            {section === "delivery" && (
              <>
                <div className="forno-section-heading">
                  <div>
                    <span className="forno-eyebrow">ÁREAS DE ATENDIMENTO</span>
                    <h2>Bairros e taxas</h2>
                  </div>
                  <span className="forno-tag">Taxas fictícias</span>
                </div>
                <p className="forno-help">
                  O proprietário define bairros atendidos e taxas fixas. As alterações abaixo são
                  salvas neste navegador, compartilhadas com a loja e não mudam pedidos existentes.
                </p>
                <form
                  className="forno-zone-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveZone();
                  }}
                >
                  <label htmlFor="demo-zone-name">
                    Bairro fictício
                    <input
                      id="demo-zone-name"
                      aria-invalid={Boolean(zoneError)}
                      aria-describedby={zoneError ? "demo-zone-error" : undefined}
                      value={zoneName}
                      onChange={(event) => setZoneName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label htmlFor="demo-zone-fee">
                    Taxa fictícia (R$)
                    <input
                      id="demo-zone-fee"
                      aria-invalid={Boolean(zoneError)}
                      aria-describedby={zoneError ? "demo-zone-error" : undefined}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="9999"
                      step="0.01"
                      value={zoneFee}
                      onChange={(event) => setZoneFee(event.target.value)}
                      required
                    />
                  </label>
                  <button className="forno-primary-button" type="submit">
                    {editingZone ? "Salvar taxa simulada" : "Adicionar bairro fictício"}
                  </button>
                  {editingZone && (
                    <button
                      className="forno-secondary-button"
                      type="button"
                      onClick={resetZoneForm}
                    >
                      Cancelar edição
                    </button>
                  )}
                  {zoneError && (
                    <p role="alert" id="demo-zone-error">
                      {zoneError}
                    </p>
                  )}
                </form>
                {zones.length === 0 ? (
                  <div className="forno-empty">Nenhum bairro fictício cadastrado.</div>
                ) : (
                  <div className="forno-table">
                    {zones.map((z) => (
                      <div key={z.id}>
                        <strong>
                          <MapPin size={16} />
                          {z.name}
                        </strong>
                        <span>{z.eta}</span>
                        <b>{money(z.fee)}</b>
                        <div className="forno-zone-actions">
                          <button
                            className="forno-secondary-button"
                            aria-label={`Editar bairro ${z.name}`}
                            onClick={() => {
                              setEditingZone(z.id);
                              setZoneName(z.name);
                              setZoneFee(String(z.fee));
                              setZoneError("");
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="forno-secondary-button"
                            aria-label={`Remover bairro ${z.name}`}
                            onClick={() => {
                              setZones((current) => current.filter((zone) => zone.id !== z.id));
                              if (editingZone === z.id) resetZoneForm();
                              notify("Bairro removido apenas da demonstração.");
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {section === "payments" && (
              <>
                <div className="forno-section-heading">
                  <div>
                    <span className="forno-eyebrow">PAGAMENTOS</span>
                    <h2>Resumo financeiro</h2>
                  </div>
                  <span className="forno-tag">Simulação · Sem gateway</span>
                </div>
                <div className="forno-stats">
                  <article>
                    <span>APROVADOS</span>
                    <strong>{money(paid)}</strong>
                    <small>Valores fictícios</small>
                  </article>
                  <article>
                    <span>PENDENTES</span>
                    <strong>{pending}</strong>
                    <small>{money(pendingAmount)} em aberto · simulado</small>
                  </article>
                </div>
                <div className="forno-table">
                  {orders.map((o) => (
                    <div key={o.id}>
                      <strong>Pedido #{o.id}</strong>
                      <span>
                        {o.payment === "PAID"
                          ? "Pagamento aprovado · simulado"
                          : o.paidAmount > 0
                            ? `Adicional pendente: ${money(total(o) - o.paidAmount)} · simulado`
                            : "Aguardando pagamento · simulado"}
                      </span>
                      <b>{money(total(o))}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
            {section === "store" && ready && (
              <DemoStoreEditor key="store" state={state} update={update} notify={notify} />
            )}
            {section === "appearance" && ready && (
              <DemoStoreEditor
                key="appearance"
                state={state}
                update={update}
                notify={notify}
                appearance
              />
            )}
            <div className="demo-actions demo-reset">
              <a
                href="/visual-demo/"
                target="_blank"
                rel="noreferrer"
                className="forno-secondary-button"
              >
                Abrir cardápio demonstrativo
              </a>
              <button
                className="forno-secondary-button"
                disabled={!ready}
                onClick={() => setResetOpen(true)}
              >
                Restaurar demonstração
              </button>
            </div>
            {resetOpen && (
              <div className="forno-detail-card" role="group" aria-label="Confirmar restauração">
                <p>
                  Restaurar produtos, loja, pedidos e notificações fictícios neste navegador? Os
                  carrinhos abertos precisarão ser refeitos.
                </p>
                <button
                  className="forno-primary-button"
                  onClick={() => {
                    reset();
                    setResetOpen(false);
                    setSection("overview");
                    setExpanded(1042);
                  }}
                >
                  Confirmar restauração
                </button>
                <button className="forno-secondary-button" onClick={() => setResetOpen(false)}>
                  Cancelar restauração
                </button>
              </div>
            )}
            <footer className="forno-footer">
              NEROXA DELIVERY <span>·</span> FORNO DI PIETRA <span>·</span> DEMONSTRAÇÃO ISOLADA
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function renderOrders(
  orders: DemoOrder[],
  expanded: number | null,
  setExpanded: (id: number | null) => void,
  advance: (order: DemoOrder) => void,
  acknowledge: (id: number) => void,
) {
  return (
    <div className="forno-order-list">
      {orders.length === 0 && <div className="forno-empty">Nenhum pedido neste filtro.</div>}
      {orders.map((order) => {
        const isExpanded = expanded === order.id;
        const unread = order.updated;
        const next = nextStatus(order);
        return (
          <article key={order.id} className={`forno-order ${unread ? "forno-order-updated" : ""}`}>
            <button
              className="forno-order-head"
              onClick={() => setExpanded(isExpanded ? null : order.id)}
              aria-expanded={isExpanded}
              aria-controls={`demo-order-${order.id}`}
              aria-label={`Pedido #${order.id} de ${order.name}, ${labels[order.status]}`}
            >
              <span className="forno-order-number">
                #{order.id}
                <small>{order.time}</small>
              </span>
              <span className="forno-order-customer">
                <strong>{order.name}</strong>
                <small>
                  {order.fulfillment} · {order.neighborhood}
                </small>
              </span>
              <span className={`forno-status status-${order.status.toLowerCase()}`}>
                {labels[order.status]}
              </span>
              <strong className="forno-order-price">{money(total(order))}</strong>
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {unread && (
              <div className="forno-update-badge">
                <Bell size={15} /> NOVOS ITENS · AGUARDANDO CIÊNCIA
              </div>
            )}
            {isExpanded && (
              <div className="forno-order-detail" id={`demo-order-${order.id}`}>
                <div className="forno-order-items">
                  {order.items.map((item, index) => (
                    <div key={index}>
                      <span>
                        <b>{item.quantity}×</b> {item.name}
                        {unread && item.added && <em> NOVO</em>}
                      </span>
                      <strong>{money(item.quantity * item.price)}</strong>
                    </div>
                  ))}
                </div>
                <div className="forno-info-row">
                  <span>Taxa de entrega</span>
                  <strong>{money(order.fee)}</strong>
                </div>
                <div className="forno-info-row">
                  <span>Pagamento</span>
                  <strong>
                    {order.payment === "PAID" ? "Aprovado (simulado)" : "Pendente (simulado)"}
                  </strong>
                </div>
                <div className="forno-order-actions">
                  {unread && (
                    <button className="forno-primary-button" onClick={() => acknowledge(order.id)}>
                      <Check size={16} /> Confirmar ciência
                    </button>
                  )}
                  {next && (
                    <button className="forno-secondary-button" onClick={() => advance(order)}>
                      Avançar para: {labels[next]}
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
