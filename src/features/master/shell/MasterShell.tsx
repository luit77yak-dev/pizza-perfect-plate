import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Database,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type MasterShellProps = {
  children: ReactNode;
};

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  active?: (pathname: string) => boolean;
  enabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral", to: "/master", icon: LayoutDashboard },
  { label: "Clientes", to: "/master-clientes", icon: Users },
  { label: "Comercial", to: "/master/comercial", icon: BriefcaseBusiness, enabled: false },
  { label: "Assinaturas", to: "/master/assinaturas", icon: CreditCard, enabled: false },
  { label: "Financeiro", to: "/master/financeiro", icon: BarChart3, enabled: false },
  { label: "Produtos", to: "/master/produtos", icon: Package, enabled: false },
  { label: "Implantação", to: "/master/implantacao", icon: FolderKanban, enabled: false },
  { label: "Domínios", to: "/master/dominios", icon: Globe2, enabled: false },
  { label: "Suporte", to: "/master/suporte", icon: CircleHelp, enabled: false },
  { label: "Configurações", to: "/master/configuracoes", icon: Settings, enabled: false },
];

export function MasterShell({ children }: MasterShellProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.active?.(location.pathname) ??
    (item.to === "/master" ? location.pathname === "/master" : location.pathname === item.to);

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200 bg-[#102a2e] text-slate-100 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
          <Link to="/master" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sm font-bold tracking-[0.16em] text-[#102a2e]">
              N
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                Plataforma
              </span>
              <span className="block text-lg font-semibold tracking-tight">Neroxa Master</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegação do Neroxa Master">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Operação
          </p>
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <MasterNavItem key={item.to} item={item} active={isActive(item)} onNavigate={() => setMobileOpen(false)} />
          ))}

          <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Gestão
          </p>
          {NAV_ITEMS.slice(2, 8).map((item) => (
            <MasterNavItem key={item.to} item={item} active={isActive(item)} onNavigate={() => setMobileOpen(false)} />
          ))}

          <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sistema
          </p>
          {NAV_ITEMS.slice(8).map((item) => (
            <MasterNavItem key={item.to} item={item} active={isActive(item)} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
              <ShieldCheck className="h-4 w-4 text-slate-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Equipe Neroxa</p>
              <p className="truncate text-[11px] text-slate-400">Acesso interno</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Neroxa</p>
              <p className="text-sm font-semibold text-slate-800">Master</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <Database className="h-4 w-4" />
            Plataforma operacional
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)]">{children}</main>
      </div>
    </div>
  );
}

function MasterNavItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  if (item.enabled === false) {
    return (
      <div
        className="group flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-slate-500"
        title="Módulo em construção"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-600">Em breve</span>
      </div>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition ${
        active
          ? "bg-white text-[#102a2e] shadow-sm"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
    </Link>
  );
}
