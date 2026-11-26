/**
 * Para onde cada pessoa vai depois do login, e quem pode usar o quê hoje. Arquivo puro.
 */
import { USER_ROLE_LABELS } from "@/lib/domain";
import { ENVIRONMENT_LABELS, ENVIRONMENT_PATHS, ENVIRONMENT_READY, environmentsOf, hasEnvironment, RESTRICTED_PANEL_READY, type Environment } from "./environments";
import { canEverywhere, type Module, type PermissionSubject } from "./matrix";

/**
 * Módulos que as telas ATUAIS do painel mostram a quem passa por `requireUser()` (inclusive misturados: a
 * visão geral soma o financeiro, a ficha do cliente lista contratos e lançamentos…). As telas só de
 * administrador (usuários, auditoria, exportação, notificações) têm a própria checagem e não entram aqui.
 */
export const LEGACY_PANEL_MODULES: readonly Module[] = [
  "leads",
  "clientes",
  "propostas",
  "contratos",
  "projetos",
  "tarefas",
  "agenda",
  "conteudo",
  "financeiro",
  "marca",
  "arquivos",
  "site",
  "config",
];

/**
 * Tipo de acesso ao painel:
 * - `"integral"`: pode VER, por inteiro, todos os módulos das telas atuais → passa em `requireUser()`;
 * - `"restrito"`: entra no painel, mas só em páginas/ações que checam a permissão do módulo
 *   (`requirePermission`) ou que valem para qualquer conta do painel (`requirePanelUser`);
 * - `null`: o perfil não entra no painel.
 */
export type PanelAccess = "integral" | "restrito" | null;

export function panelAccess(subject: PermissionSubject): PanelAccess {
  if (!hasEnvironment(subject.role, "painel")) return null;
  return LEGACY_PANEL_MODULES.every((mod) => canEverywhere(subject, mod, "ver")) ? "integral" : "restrito";
}

/** O que já tem telas. O padrão são as chaves de ./environments.ts; os testes passam outros valores. */
export type Readiness = { environments: Record<Environment, boolean>; restrictedPanel: boolean };
export const CURRENT_READINESS: Readiness = { environments: ENVIRONMENT_READY, restrictedPanel: RESTRICTED_PANEL_READY };

/** A pessoa consegue entrar neste ambiente HOJE (perfil + telas prontas)? */
export function canEnterNow(subject: PermissionSubject, environment: Environment, readiness: Readiness = CURRENT_READINESS): boolean {
  if (!hasEnvironment(subject.role, environment) || !readiness.environments[environment]) return false;
  if (environment !== "painel") return true;
  return panelAccess(subject) === "integral" || readiness.restrictedPanel;
}

/** Ambientes em que a pessoa pode entrar hoje, na ordem de preferência do perfil (base do "alternar ambiente"). */
export function availableEnvironments(subject: PermissionSubject, readiness: Readiness = CURRENT_READINESS): Environment[] {
  return environmentsOf(subject.role).filter((environment) => canEnterNow(subject, environment, readiness));
}

export type Landing =
  | { ok: true; environment: Environment; path: string }
  /** Conta válida, mas nenhum ambiente dela tem telas ainda. `message` é o texto (pt-BR) para a pessoa. */
  | { ok: false; message: string };

/**
 * Destino depois do login. Quando nenhum ambiente do perfil está pronto, NÃO há destino: o login mostra a
 * mensagem e não abre sessão (nada de cair no painel, nada de erro 500).
 */
export function landingFor(subject: PermissionSubject, readiness: Readiness = CURRENT_READINESS): Landing {
  const [environment] = availableEnvironments(subject, readiness);
  if (environment) return { ok: true, environment, path: ENVIRONMENT_PATHS[environment] };
  const pending = environmentsOf(subject.role).map((item) => ENVIRONMENT_LABELS[item]);
  const where = pending.length > 1 ? `${pending.slice(0, -1).join(", ")} e ${pending.at(-1)}` : (pending[0] ?? "o sistema");
  return {
    ok: false,
    message: `Sua conta (${USER_ROLE_LABELS[subject.role]}) está ativa, mas o acesso a ${where} ainda não foi liberado. Fale com a NÓS Studio para saber quando estará disponível.`,
  };
}
