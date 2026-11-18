/**
 * Navegação do painel — FONTE ÚNICA. A barra lateral, a barra inferior do celular, a gaveta "Mais" e o título
 * da barra superior saem todos daqui. Para um módulo novo aparecer no menu, basta acrescentar um item.
 * Arquivo puro (sem servidor): pode ser importado em Client Components.
 */
import {
  CalendarDays,
  Clapperboard,
  FileSignature,
  FileText,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MonitorSmartphone,
  Palette,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Contadores que o shell sabe mostrar ao lado de um item (calculados em `_shell/shell.tsx`). */
export type NavBadgeKey = "newLeads";
export type NavBadges = Partial<Record<NavBadgeKey, number>>;

export type NavItem = {
  href: string;
  label: string;
  /** Rótulo curto para a barra inferior do celular (quando o normal não cabe). */
  shortLabel?: string;
  icon: LucideIcon;
  /** Ativo só na rota exata (a raiz `/painel`); os demais ficam ativos por prefixo. */
  exact?: boolean;
  badge?: NavBadgeKey;
};

export type NavGroup = { label: string; items: readonly NavItem[] };

export const PANEL_NAV: readonly NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/painel", label: "Visão geral", shortLabel: "Início", icon: LayoutDashboard, exact: true },
      { href: "/painel/leads", label: "Leads", icon: Inbox, badge: "newLeads" },
      { href: "/painel/clientes", label: "Clientes", icon: Users },
      { href: "/painel/orcamentos", label: "Orçamentos", icon: FileText },
      { href: "/painel/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/painel/projetos", label: "Projetos", icon: Clapperboard },
      { href: "/painel/tarefas", label: "Tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/painel/contratos", label: "Contratos", icon: FileSignature },
      { href: "/painel/conteudo", label: "Conteúdo", icon: Megaphone },
      { href: "/painel/marca", label: "Marca", icon: Palette },
    ],
  },
  { label: "Site", items: [{ href: "/painel/site", label: "Editar site", icon: MonitorSmartphone }] },
  {
    label: "Sistema",
    items: [
      { href: "/painel/config", label: "Configurações", icon: Settings },
      { href: "/painel/ajuda", label: "Ajuda", icon: LifeBuoy },
    ],
  },
];

/** Atalhos da barra inferior do celular (o quinto botão é "Mais", com o menu completo). */
export const MOBILE_SHORTCUTS: readonly string[] = ["/painel", "/painel/leads", "/painel/orcamentos", "/painel/agenda"];

export const ALL_NAV_ITEMS: readonly NavItem[] = PANEL_NAV.flatMap((group) => group.items);

export function isNavItemActive(item: Pick<NavItem, "href" | "exact">, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Título da seção atual (barra superior do celular). Rotas fora do menu têm nomes próprios. */
export function sectionTitle(pathname: string): string {
  if (pathname.startsWith("/painel/conta")) return "Minha conta";
  if (pathname.startsWith("/painel/kit")) return "Kit de interface";
  const match = ALL_NAV_ITEMS.find((item) => !item.exact && isNavItemActive(item, pathname));
  return match?.label ?? (pathname === "/painel" ? "Visão geral" : "Painel");
}
