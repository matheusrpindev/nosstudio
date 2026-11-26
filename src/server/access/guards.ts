/**
 * Guardas que dependem do banco (membros de projeto, vínculo de cliente). Os guardas por perfil e por módulo
 * (`requireUser`, `requirePermission`, `requireEnvironment`…) ficam em `@/lib/auth`.
 */
import "server-only";
import { notFound, redirect } from "next/navigation";
import { NO_ACCESS_PATH, PANEL_HOME, requireEnvironment, type CurrentUser } from "@/lib/auth";
import { canUsePanelModule, panelAccess, type Action, type Module } from "@/lib/permissions";
import { canAccessProject, canInProject, moduleScope, type IdScope, type ProjectAction } from "./scope";

/**
 * PAINEL: exige a permissão `action` em `mod` PARA ESTE PROJETO. Passa quem tem a permissão no módulo inteiro
 * e, quando o alcance do perfil é "projetos" (funcionário), quem é membro do projeto com a permissão
 * correspondente. Use em páginas e ações de registros ligados a um projeto (tarefa, compromisso, arquivo…),
 * passando o `projectId` LIDO DO BANCO — nunca o que veio do formulário.
 */
export async function requireProjectPermission(mod: Module, action: Action, projectId: number | null | undefined): Promise<CurrentUser> {
  const user = await requireEnvironment("painel");
  if (!(await canInProject(user, mod, action, projectId))) redirect(panelAccess(user) === "integral" ? PANEL_HOME : NO_ACCESS_PATH);
  return user;
}

/**
 * PAINEL: guarda das páginas de LISTA e das ações dos módulos que filtram por projeto (projetos, tarefas — ver
 * `PROJECT_SCOPED_PANEL_MODULES`). Passa quem tem `action` em `mod` no módulo inteiro OU só "nos projetos em que
 * está"; devolve também o ESCOPO, e quem chama é OBRIGADO a usá-lo: listas com `inScope(coluna, scope)`,
 * registros com `scopeAllows(scope, projectId lido do banco)` ou `requireProjectPermission`.
 * Quem não tem a permissão de jeito nenhum é barrado como em `requirePermission`.
 */
export async function requireScopedPermission(mod: Module, action: Action): Promise<{ user: CurrentUser; scope: IdScope }> {
  const user = await requireEnvironment("painel");
  if (!canUsePanelModule(user, mod, action)) redirect(panelAccess(user) === "integral" ? PANEL_HOME : NO_ACCESS_PATH);
  return { user, scope: await moduleScope(user, mod, action) };
}

/**
 * ÁREA DA EQUIPE / ÁREA DO CLIENTE: exige que a pessoa possa `action` neste projeto (membro do projeto, ou
 * conta vinculada ao cliente do projeto). Projeto alheio ou inexistente → 404, a mesma resposta nos dois casos:
 * trocar o id da URL não revela se o projeto existe.
 */
export async function requireProjectAccess(environment: "equipe" | "cliente", projectId: number, action: ProjectAction = "ver"): Promise<CurrentUser> {
  const user = await requireEnvironment(environment);
  if (!(await canAccessProject(user, projectId, action))) notFound();
  return user;
}
