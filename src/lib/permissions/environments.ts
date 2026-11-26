/**
 * Ambientes da plataforma (briefing v2, seções 01 e 28) e quais perfis entram em cada um — FONTE ÚNICA.
 * Arquivo puro (sem servidor): pode ser importado em Server e Client Components.
 *
 * O site público não é um "ambiente" aqui: não exige conta. Os três ambientes privados dividem o mesmo banco
 * e o mesmo login; o que muda é quem entra e o que enxerga (matriz em ./matrix.ts, escopos em src/server/access).
 */
import type { UserRole } from "@/lib/domain";

export const ENVIRONMENTS = ["painel", "equipe", "cliente"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  painel: "Painel Administrativo",
  equipe: "Área da Equipe",
  cliente: "Área do Cliente",
};

/** Raiz de cada ambiente. `/equipe` e `/cliente` ainda não têm telas (ver ENVIRONMENT_READY). */
export const ENVIRONMENT_PATHS: Record<Environment, string> = {
  painel: "/painel",
  equipe: "/equipe",
  cliente: "/cliente",
};

/**
 * Quem entra onde. A ORDEM importa: o primeiro ambiente pronto da lista é para onde a pessoa vai depois do
 * login (o funcionário trabalha na Área da Equipe e também tem um painel restrito).
 */
export const ROLE_ENVIRONMENTS: Record<UserRole, readonly Environment[]> = {
  admin: ["painel"],
  socio: ["painel"],
  gestor: ["painel"],
  tecnico: ["painel"],
  funcionario: ["equipe", "painel"],
  freelancer: ["equipe"],
  cliente: ["cliente"],
};

/**
 * Ambientes que já têm telas. Enquanto um ambiente não estiver pronto, quem só tem ele não consegue entrar:
 * o login responde com uma mensagem clara e NÃO abre sessão (ver `landingFor` em ./landing.ts).
 * Ao publicar `/equipe` ou `/cliente`, troque para `true` aqui — é a única chave.
 */
export const ENVIRONMENT_READY: Record<Environment, boolean> = {
  painel: true,
  equipe: false,
  cliente: false,
};

/**
 * O painel "restrito" (perfis que NÃO podem ver todos os módulos: gestor, funcionário, ou um técnico com
 * negações individuais). Está ABERTO: todas as páginas do painel declaram a permissão que exigem
 * (`requirePermission`, `requireScopedPermission`, `requireProjectPermission` — tabela em docs/permissoes.md,
 * conferida página a página por `src/app/painel/pages-access.db.test.ts`), o menu e a visão geral só mostram o
 * que a pessoa pode ver, e projetos e tarefas filtram pelos projetos do funcionário.
 * Voltar para `false` fecha o login desses perfis de uma vez (o login responde com uma mensagem clara, sem
 * abrir sessão) — é o freio de emergência.
 */
export const RESTRICTED_PANEL_READY: boolean = true;

export function environmentsOf(role: UserRole): readonly Environment[] {
  return ROLE_ENVIRONMENTS[role] ?? [];
}

export function hasEnvironment(role: UserRole, environment: Environment): boolean {
  return environmentsOf(role).includes(environment);
}

/** Perfis que nunca entram no painel (freelancer, cliente): contas externas à operação interna. */
export function isExternalRole(role: UserRole): boolean {
  return !hasEnvironment(role, "painel");
}
