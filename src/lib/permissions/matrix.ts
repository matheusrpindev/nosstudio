/**
 * Permissões por módulo — FONTE ÚNICA (briefing v2, seção 28: "permissões por módulo e por projeto para ver,
 * editar, excluir, baixar e compartilhar").
 *
 * Arquivo puro: a mesma função `can()` esconde botões no cliente e barra no servidor (`requirePermission` em
 * `@/lib/auth`). O servidor é quem manda; esconder no cliente é só cortesia.
 *
 * A matriz vale para o PAINEL. Na Área da Equipe e na Área do Cliente o acesso é por escopo (projetos em que a
 * pessoa foi incluída, clientes a que a conta está vinculada) — ver `src/server/access`.
 */
import type { UserRole } from "@/lib/domain";
import { hasEnvironment } from "./environments";

// ------------------------------------------------------------------ módulos
export const MODULES = [
  "leads",
  "clientes",
  "propostas",
  "contratos",
  "projetos",
  "tarefas",
  "agenda",
  "conteudo",
  "financeiro",
  "societario",
  "marca",
  "arquivos",
  "equipe",
  "site",
  "relatorios",
  "usuarios",
  "config",
  "auditoria",
  "dados",
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  leads: "Leads",
  clientes: "Clientes",
  propostas: "Propostas e orçamentos",
  contratos: "Contratos",
  projetos: "Projetos",
  tarefas: "Tarefas",
  agenda: "Agenda",
  conteudo: "Conteúdo (calendário editorial)",
  financeiro: "Financeiro",
  societario: "Societário (pró-labore, retiradas, distribuição)",
  marca: "Marca",
  arquivos: "Arquivos",
  equipe: "Equipe",
  site: "Site",
  relatorios: "Relatórios",
  usuarios: "Usuários e permissões",
  config: "Configurações",
  auditoria: "Auditoria",
  dados: "Exportação de dados",
};

// -------------------------------------------------------------------- ações
export const ACTIONS = ["ver", "editar", "excluir", "baixar", "compartilhar"] as const;
export type Action = (typeof ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<Action, string> = {
  ver: "Ver",
  editar: "Criar e editar",
  excluir: "Excluir",
  baixar: "Baixar",
  compartilhar: "Compartilhar",
};

/**
 * Alcance de uma permissão:
 * - `"todos"`: o módulo inteiro;
 * - `"projetos"`: só registros dos projetos em que a pessoa é membro (`project_members`) — quem confere o
 *   projeto é `canAccessProject` / `requireProjectPermission`, em `src/server/access`;
 * - `null`: sem permissão.
 */
export type Scope = "todos" | "projetos";
export type Cell = Scope | null;
export type PermissionRow = Record<Action, Cell>;
export type PermissionTable = Record<Module, PermissionRow>;

// ------------------------------------------------------------------- matriz
const T: Cell = "todos";
const P: Cell = "projetos";
const _: Cell = null;

/** Uma linha da matriz, na ordem das colunas: ver, editar, excluir, baixar, compartilhar. */
type Cells = readonly [ver: Cell, editar: Cell, excluir: Cell, baixar: Cell, compartilhar: Cell];
const TUDO: Cells = [T, T, T, T, T];
const NADA: Cells = [_, _, _, _, _];

const every = (cells: Cells): Record<Module, Cells> => Object.fromEntries(MODULES.map((mod) => [mod, cells])) as Record<Module, Cells>;

/**
 * MATRIZ PADRÃO POR PERFIL. Leia assim: perfil → módulo → [ver, editar, excluir, baixar, compartilhar].
 * T = o módulo inteiro · P = só nos projetos em que é membro · _ = não.
 *
 * - admin e sócio: tudo.
 * - técnico (suporte do desenvolvedor): usa o painel como hoje, mas não gerencia usuários, não exporta dados,
 *   não vê a auditoria nem o societário.
 * - gestor de projetos: a operação. Não exclui registros com histórico (clientes, contratos, projetos, fichas
 *   da equipe — propostas sim: o servidor só deixa excluir rascunhos e modelos) e não entra em financeiro,
 *   societário, site, relatórios, usuários, configurações, auditoria nem exportação.
 * - funcionário: só os projetos em que está — vê e edita projeto, tarefas, agenda, conteúdo e arquivos; vê e
 *   baixa a identidade visual desses projetos. Não exclui, não compartilha com o cliente, sem comercial e sem
 *   financeiro.
 * - freelancer e cliente: nada no painel (entram só na Área da Equipe / do Cliente, por escopo).
 */
const MATRIX: Record<UserRole, Record<Module, Cells>> = {
  admin: every(TUDO),
  socio: every(TUDO),
  tecnico: {
    ...every(TUDO),
    //            ver editar excluir baixar compartilhar
    societario:  [_, _, _, _, _],
    usuarios:    [_, _, _, _, _],
    auditoria:   [_, _, _, _, _],
    dados:       [_, _, _, _, _],
  },
  gestor: {
    //            ver editar excluir baixar compartilhar
    leads:       [T, T, T, T, T],
    clientes:    [T, T, _, T, T],
    propostas:   [T, T, T, T, T],
    contratos:   [T, T, _, T, T],
    projetos:    [T, T, _, T, T],
    tarefas:     [T, T, T, T, T],
    agenda:      [T, T, T, T, T],
    conteudo:    [T, T, T, T, T],
    financeiro:  [_, _, _, _, _],
    societario:  [_, _, _, _, _],
    marca:       [T, T, T, T, T],
    arquivos:    [T, T, T, T, T],
    equipe:      [T, T, _, T, T],
    site:        [_, _, _, _, _],
    relatorios:  [_, _, _, _, _],
    usuarios:    [_, _, _, _, _],
    config:      [_, _, _, _, _],
    auditoria:   [_, _, _, _, _],
    dados:       [_, _, _, _, _],
  },
  funcionario: {
    ...every(NADA),
    //            ver editar excluir baixar compartilhar
    projetos:    [P, P, _, P, _],
    tarefas:     [P, P, _, P, _],
    agenda:      [P, P, _, P, _],
    conteudo:    [P, P, _, P, _],
    arquivos:    [P, P, _, P, _],
    marca:       [P, _, _, P, _],
  },
  freelancer: every(NADA),
  cliente: every(NADA),
};

/** Perfis com acesso total e que administram o sistema (contas, permissões, societário). */
export const ADMIN_ROLES: readonly UserRole[] = ["admin", "socio"];
export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * Módulos reservados a administradores e sócios: não podem ser concedidos a outros perfis por ajuste
 * individual (senão um ajuste viraria escalada de privilégio: quem gerencia usuários cria administradores).
 */
export const RESERVED_MODULES: readonly Module[] = ["societario", "usuarios"];

/** Padrão do PERFIL (sem ajustes individuais). */
export function rolePermission(role: UserRole, mod: Module, action: Action): Cell {
  return MATRIX[role]?.[mod]?.[ACTIONS.indexOf(action)] ?? null;
}

// ------------------------------------------------------- ajustes por usuário
export type PermissionKey = `${Module}:${Action}`;

export function permissionKey(mod: Module, action: Action): PermissionKey {
  return `${mod}:${action}`;
}

export function isPermissionKey(value: unknown): value is PermissionKey {
  if (typeof value !== "string") return false;
  const [mod, action, ...rest] = value.split(":");
  return rest.length === 0 && (MODULES as readonly string[]).includes(mod) && (ACTIONS as readonly string[]).includes(action);
}

/**
 * Ajustes individuais sobre o padrão do perfil (coluna JSON `users.permissions`, validada por zod ao gravar):
 * - `grant`: concede a ação no módulo INTEIRO (alcance "todos"), mesmo que o perfil não tenha;
 * - `deny`: tira a ação. **Negação vence concessão** e vence o padrão do perfil.
 */
export type PermissionOverrides = { grant: PermissionKey[]; deny: PermissionKey[] };

export const NO_OVERRIDES: PermissionOverrides = Object.freeze({ grant: [], deny: [] }) as PermissionOverrides;

/**
 * Leitura TOLERANTE (ao carregar do banco): valor estranho vira "sem ajustes"; chave desconhecida é ignorada.
 * A validação ESTRITA, usada ao gravar, é o `permissionOverridesSchema` de ./schema.ts (zod — fica fora deste
 * arquivo para não levar o zod aos Client Components que só precisam de `can()`).
 */
export function parseOverrides(value: unknown): PermissionOverrides {
  if (!value || typeof value !== "object") return NO_OVERRIDES;
  const pick = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter(isPermissionKey))].sort() : []);
  const { grant, deny } = value as { grant?: unknown; deny?: unknown };
  return { grant: pick(grant), deny: pick(deny) };
}

/**
 * Por que estes ajustes não podem ser gravados para este perfil (mensagem pt-BR) — ou `null` se podem.
 * - admin e sócio não recebem ajustes: precisam conseguir administrar (ninguém tranca o sistema negando
 *   "usuarios" ao último administrador). Para restringir alguém, mude o PERFIL.
 * - freelancer e cliente não usam o painel: nada a conceder.
 * - módulos reservados não são concedidos por ajuste.
 */
export function overridesProblem(role: UserRole, overrides: PermissionOverrides): string | null {
  const empty = overrides.grant.length === 0 && overrides.deny.length === 0;
  if (empty) return null;
  if (isAdminRole(role)) return "Administradores e sócios sempre têm acesso total. Para restringir, mude o perfil da conta.";
  if (!hasEnvironment(role, "painel")) return "Este perfil não usa o painel: o acesso dele é definido pelos projetos e clientes vinculados.";
  const reserved = overrides.grant.find((key) => RESERVED_MODULES.includes(key.split(":")[0] as Module));
  if (reserved) return `"${MODULE_LABELS[reserved.split(":")[0] as Module]}" é exclusivo de administradores e sócios e não pode ser concedido por ajuste.`;
  return null;
}

// ------------------------------------------------------------------ decisão
/** O mínimo que as funções de permissão precisam saber de alguém. `CurrentUser` serve. */
export type PermissionSubject = { role: UserRole; permissions?: PermissionOverrides | null };

function resolve(subject: PermissionSubject, mod: Module, action: Action): Cell {
  const { role } = subject;
  if (isAdminRole(role)) return "todos";
  // a matriz é do painel: quem não entra nele não tem nada, com ou sem ajuste
  if (!hasEnvironment(role, "painel")) return null;
  const overrides = subject.permissions ?? NO_OVERRIDES;
  if (overrides.deny.includes(permissionKey(mod, action))) return null;
  if (!RESERVED_MODULES.includes(mod)) {
    if (overrides.grant.includes(permissionKey(mod, action))) return "todos";
    // conceder qualquer ação num módulo dá também o "ver" dele (não existe editar sem enxergar)
    if (action === "ver" && overrides.grant.some((key) => key.startsWith(`${mod}:`))) return "todos";
  }
  return rolePermission(role, mod, action);
}

/**
 * Alcance efetivo de `action` em `mod` para esta pessoa (perfil + ajustes individuais).
 * Sem "ver" não há mais nada: negar o "ver" de um módulo tira todas as ações dele.
 */
export function permissionScope(subject: PermissionSubject, mod: Module, action: Action): Cell {
  const scope = resolve(subject, mod, action);
  if (scope === null || action === "ver") return scope;
  return resolve(subject, mod, "ver") === null ? null : scope;
}

/**
 * A pessoa pode fazer `action` em `mod`? `true` também quando o alcance é só "projetos" — para decidir
 * sobre um registro específico, use o servidor (`requirePermission`, `requireProjectPermission`).
 */
export function can(subject: PermissionSubject, mod: Module, action: Action): boolean {
  return permissionScope(subject, mod, action) !== null;
}

/** Pode no módulo INTEIRO (sem depender de ser membro de um projeto)? */
export function canEverywhere(subject: PermissionSubject, mod: Module, action: Action): boolean {
  return permissionScope(subject, mod, action) === "todos";
}

/** A tabela efetiva inteira de alguém (para a tela de permissões e para os testes). */
export function permissionTable(subject: PermissionSubject): PermissionTable {
  return Object.fromEntries(
    MODULES.map((mod) => [mod, Object.fromEntries(ACTIONS.map((action) => [action, permissionScope(subject, mod, action)]))]),
  ) as PermissionTable;
}
