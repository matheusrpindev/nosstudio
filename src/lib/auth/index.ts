import "server-only";
import { redirect } from "next/navigation";
import {
  canEverywhere,
  hasEnvironment,
  isAdminRole,
  landingFor,
  MODULE_LABELS,
  panelAccess,
  PERMISSION_ACTION_LABELS,
  type Action,
  type Environment,
  type Module,
} from "@/lib/permissions";
import { PANEL_HOME } from "./next-path";
import { getSession, type CurrentUser } from "./session";

export type { CurrentUser } from "./session";

export const LOGIN_PATH = "/login";
export { PANEL_HOME };
export const FORCE_PASSWORD_PATH = "/painel/conta/senha";
/** Troca de senha de quem NÃO entra no painel (freelancer, cliente): tela neutra, fora de qualquer ambiente. */
export const ACCOUNT_PASSWORD_PATH = "/conta/senha";
/** Conta válida, mas sem acesso ao que tentou abrir e sem outro ambiente para onde ir. */
export const NO_ACCESS_PATH = `${LOGIN_PATH}?aviso=sem-acesso`;

/*
 * QUEM PASSA ONDE (detalhes e tabela "rota → permissão" em docs/permissoes.md)
 *
 *   getSessionUser / requireSessionUser   qualquer conta ativa com sessão, de qualquer ambiente
 *   requireEnvironment(env)               contas cujo PERFIL entra naquele ambiente (painel, equipe, cliente)
 *   requirePanelUser                      = requireEnvironment("painel")
 *   requirePermission(módulo, ação)       conta do painel COM a permissão no módulo inteiro
 *   requireScopedPermission /             (em @/server/access) módulos que filtram por projeto: passa também quem
 *   requireProjectPermission              só tem a permissão "nos projetos em que está" (funcionário)
 *   requireUser / getCurrentUser          conta do painel com acesso INTEGRAL (pode ver todos os módulos das
 *                                         telas atuais): é o guarda das páginas que ainda não checam módulo
 *   requireAdmin                          admin ou sócio
 *
 * Toda negação é decidida AQUI, no servidor, a cada requisição (o proxy.ts é só um atalho otimista).
 */

// --------------------------------------------------------------- leitura
/** Usuário da sessão (qualquer perfil, qualquer ambiente) ou `null`. Não diz NADA sobre o que ele pode ver. */
export async function getSessionUser(): Promise<CurrentUser | null> {
  return (await getSession())?.user ?? null;
}

/** Usuário logado cujo perfil entra no painel, ou `null`. */
export async function getPanelUser(): Promise<CurrentUser | null> {
  const user = await getSessionUser();
  return user && hasEnvironment(user.role, "painel") ? user : null;
}

/**
 * Usuário logado COM ACESSO INTEGRAL AO PAINEL, ou `null` — freelancer, cliente e perfis restritos contam como
 * "ninguém" aqui. É o que as telas e rotas atuais do painel esperam: todas foram escritas para quem vê tudo.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await getSessionUser();
  return user && panelAccess(user) === "integral" ? user : null;
}

// ------------------------------------------------------------- destinos
/**
 * Para onde mandar quem está logado mas não pode abrir algo do ambiente `from`: o ambiente da própria pessoa,
 * se for OUTRO (o cliente que digita /painel vai para /cliente); senão a tela de login com aviso. Nunca
 * devolve um caminho do mesmo ambiente — é o que impede um laço de redirecionamentos.
 */
function deniedPath(user: CurrentUser, from: Environment): string {
  const landing = landingFor(user);
  return landing.ok && landing.environment !== from ? landing.path : NO_ACCESS_PATH;
}

type RequireOptions = { allowPasswordChange?: boolean };

/** Onde esta conta troca a senha provisória: dentro do painel, se ela entra nele; senão na tela neutra. */
export function passwordChangePath(user: Pick<CurrentUser, "role">): string {
  return `${hasEnvironment(user.role, "painel") ? FORCE_PASSWORD_PATH : ACCOUNT_PASSWORD_PATH}?obrigatoria=1`;
}

function enforcePasswordChange(user: CurrentUser, options: RequireOptions): void {
  if (user.mustChangePassword && !options.allowPasswordChange) redirect(passwordChangePath(user));
}

// ---------------------------------------------------------------- guardas
/**
 * Qualquer conta com sessão válida (de qualquer ambiente). Só para o que é DA PRÓPRIA CONTA — trocar a senha,
 * encerrar sessões. Nunca use para mostrar dados da NÓS.
 */
export async function requireSessionUser(options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  enforcePasswordChange(user, options);
  return user;
}

/**
 * Garante que há um usuário logado cujo perfil entra em `environment`. Use no topo de toda página, Server
 * Action e Route Handler de um ambiente. Quem é de outro ambiente é mandado para o dele.
 */
export async function requireEnvironment(environment: Environment, options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  if (!hasEnvironment(user.role, environment)) redirect(deniedPath(user, environment));
  enforcePasswordChange(user, options);
  return user;
}

/** Qualquer conta do painel (inclusive as restritas). Para páginas comuns a todos: Minha conta, Ajuda. */
export const requirePanelUser = (options: RequireOptions = {}) => requireEnvironment("painel", options);
/** Área da Equipe (funcionário, freelancer). O que cada um vê lá é decidido por projeto: `src/server/access`. */
export const requireTeamUser = (options: RequireOptions = {}) => requireEnvironment("equipe", options);
/** Área do Cliente (perfil cliente). O que cada conta vê é decidido pelos clientes vinculados a ela. */
export const requireClientUser = (options: RequireOptions = {}) => requireEnvironment("cliente", options);

/**
 * Guarda de quem pode ver TUDO: exige sessão e acesso integral ao painel (admin, sócio, técnico sem negações).
 * Freelancer e cliente nunca passam; gestor e funcionário também não. As páginas e ações dos módulos NÃO usam
 * este guarda — declaram módulo e ação (`requirePermission`…); ele ficou para a demonstração do kit e como base
 * de `requireAdmin`.
 * (O proxy.ts só faz um redirecionamento otimista; a autorização de verdade é esta checagem no servidor.)
 *
 * Contas marcadas com "trocar a senha" são levadas à tela de troca, a menos que `allowPasswordChange`.
 */
export async function requireUser(options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await requireEnvironment("painel", options);
  if (panelAccess(user) !== "integral") redirect(NO_ACCESS_PATH);
  return user;
}

/** Como `requireUser`, mas exige administrador ou sócio (gestão de usuários, exportações, auditoria). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdminRole(user.role)) redirect(PANEL_HOME);
  return user;
}

/**
 * Exige a permissão `action` em `mod` no módulo INTEIRO (perfil + ajustes individuais). É o guarda de toda
 * página e Server Action de um módulo do painel. Quem só tem a permissão "nos projetos em que está"
 * (funcionário) NÃO passa aqui: para um registro de projeto use `requireProjectPermission(mod, action, projectId)`
 * de `@/server/access`.
 *
 * Sem sessão → login. Sem a permissão → início do painel (como `requireAdmin` sempre fez); quem nem entra no
 * painel vai para o ambiente dele.
 */
export async function requirePermission(mod: Module, action: Action, options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await requireEnvironment("painel", options);
  if (!canEverywhere(user, mod, action)) redirect(panelAccess(user) === "integral" ? PANEL_HOME : NO_ACCESS_PATH);
  return user;
}

// ------------------------------------------------- Route Handlers (JSON)
const apiError = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Texto do 403 de uma permissão negada. */
export function permissionDeniedMessage(mod: Module, action: Action): string {
  return `Você não tem permissão para esta ação (${PERMISSION_ACTION_LABELS[action].toLowerCase()} em ${MODULE_LABELS[mod]}).`;
}

/**
 * Variante de `requirePermission` para Route Handlers (que não podem redirecionar um `fetch`): devolve o
 * usuário ou a resposta de erro pronta — 401 sem sessão; 403 com troca de senha pendente, sem acesso ao painel
 * ou sem a permissão.
 *
 *   const user = await authorizePermission("financeiro", "baixar");
 *   if (user instanceof Response) return user;
 */
export async function authorizePermission(mod: Module, action: Action): Promise<CurrentUser | Response> {
  const user = await getSessionUser();
  if (!user) return apiError("Sua sessão expirou. Entre novamente.", 401);
  if (user.mustChangePassword) return apiError("Troque a senha antes de continuar.", 403);
  if (!hasEnvironment(user.role, "painel")) return apiError("Sua conta não tem acesso ao painel.", 403);
  if (!canEverywhere(user, mod, action)) return apiError(permissionDeniedMessage(mod, action), 403);
  return user;
}

export { can, canEverywhere, canUsePanelModule, isAdminRole, permissionScope } from "@/lib/permissions";
export { safeNextPath } from "./next-path";
