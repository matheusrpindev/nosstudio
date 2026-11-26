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
import { canUsePanelModule, type Module, type PermissionSubject } from "@/lib/permissions";

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
  /**
   * Módulo de permissões do item: ele só aparece para quem pode VER o módulo (`visibleNavHrefs`). Sem módulo =
   * vale para qualquer conta do painel (Visão geral, Ajuda).
   */
  module?: Module;
};

export type NavGroup = { label: string; items: readonly NavItem[] };

export const PANEL_NAV: readonly NavGroup[] = [
  {
    label: "Operação",
    items: [
      { href: "/painel", label: "Visão geral", shortLabel: "Início", icon: LayoutDashboard, exact: true },
      { href: "/painel/leads", label: "Leads", icon: Inbox, badge: "newLeads", module: "leads" },
      { href: "/painel/clientes", label: "Clientes", icon: Users, module: "clientes" },
      { href: "/painel/orcamentos", label: "Orçamentos", icon: FileText, module: "propostas" },
      { href: "/painel/agenda", label: "Agenda", icon: CalendarDays, module: "agenda" },
      { href: "/painel/projetos", label: "Projetos", icon: Clapperboard, module: "projetos" },
      { href: "/painel/tarefas", label: "Tarefas", icon: ListChecks, module: "tarefas" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/financeiro", label: "Financeiro", icon: Wallet, module: "financeiro" },
      { href: "/painel/contratos", label: "Contratos", icon: FileSignature, module: "contratos" },
      { href: "/painel/conteudo", label: "Conteúdo", icon: Megaphone, module: "conteudo" },
      { href: "/painel/marca", label: "Marca", icon: Palette, module: "marca" },
    ],
  },
  { label: "Site", items: [{ href: "/painel/site", label: "Editar site", icon: MonitorSmartphone, module: "site" }] },
  {
    label: "Sistema",
    items: [
      { href: "/painel/config", label: "Configurações", icon: Settings, module: "config" },
      { href: "/painel/ajuda", label: "Ajuda", icon: LifeBuoy },
    ],
  },
];

export const ALL_NAV_ITEMS: readonly NavItem[] = PANEL_NAV.flatMap((group) => group.items);

/**
 * Atalhos da barra inferior do celular, em ordem de preferência: entram os QUATRO primeiros que a pessoa pode
 * abrir (o quinto botão é "Mais", com o menu completo). Para os sócios são os quatro primeiros da lista.
 */
export const MOBILE_SHORTCUTS: readonly string[] = [
  "/painel",
  "/painel/leads",
  "/painel/orcamentos",
  "/painel/agenda",
  "/painel/projetos",
  "/painel/tarefas",
  "/painel/clientes",
  "/painel/ajuda",
];
export const MOBILE_SHORTCUT_COUNT = 4;

/**
 * Itens do menu que esta pessoa pode abrir (pelos hrefs) — calculado no SERVIDOR (`_shell/shell.tsx`) e passado
 * aos componentes do menu, que só desenham o que estiver na lista. Esconder é cortesia: cada página confere a
 * permissão de novo (`requirePermission`).
 */
export function visibleNavHrefs(subject: PermissionSubject): string[] {
  return ALL_NAV_ITEMS.filter((item) => !item.module || canUsePanelModule(subject, item.module, "ver")).map((item) => item.href);
}

/** Os grupos do menu só com os itens permitidos (grupo sem item some). */
export function filterNav(allowed: readonly string[]): NavGroup[] {
  return PANEL_NAV.map((group) => ({ ...group, items: group.items.filter((item) => allowed.includes(item.href)) })).filter((group) => group.items.length > 0);
}

/** Atalhos da barra inferior para quem tem estes itens liberados. */
export function mobileShortcuts(allowed: readonly string[]): NavItem[] {
  return MOBILE_SHORTCUTS.filter((href) => allowed.includes(href))
    .slice(0, MOBILE_SHORTCUT_COUNT)
    .map((href) => ALL_NAV_ITEMS.find((item) => item.href === href))
    .filter((item) => item !== undefined);
}

export function isNavItemActive(item: Pick<NavItem, "href" | "exact">, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Título da seção atual (barra superior do celular). Rotas fora do menu têm nomes próprios. */
export function sectionTitle(pathname: string): string {
  if (pathname.startsWith("/painel/conta")) return "Minha conta";
  if (pathname.startsWith("/painel/notificacoes")) return "Notificações";
  if (pathname.startsWith("/painel/kit")) return "Kit de interface";
  const match = ALL_NAV_ITEMS.find((item) => !item.exact && isNavItemActive(item, pathname));
  return match?.label ?? (pathname === "/painel" ? "Visão geral" : "Painel");
}
