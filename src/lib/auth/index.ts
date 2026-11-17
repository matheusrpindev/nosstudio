import "server-only";
import { redirect } from "next/navigation";
import { getSession, type CurrentUser } from "./session";

export type { CurrentUser } from "./session";

export const LOGIN_PATH = "/login";
export const PANEL_HOME = "/painel";
export const FORCE_PASSWORD_PATH = "/painel/conta/senha";

/** Usuário logado ou `null`. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getSession())?.user ?? null;
}

/**
 * Garante que há um usuário logado — use no topo de TODA página, Server Action e Route Handler do painel.
 * (O proxy.ts só faz um redirecionamento otimista; a autorização de verdade é esta checagem no servidor.)
 *
 * Contas marcadas com "trocar a senha" são levadas à tela de troca, a menos que `allowPasswordChange`.
 */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (user.mustChangePassword && !options.allowPasswordChange) redirect(`${FORCE_PASSWORD_PATH}?obrigatoria=1`);
  return user;
}

/** Como `requireUser`, mas exige perfil de administrador (gestão de usuários, exportações). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect(PANEL_HOME);
  return user;
}

/** Só aceita caminhos internos do painel como destino pós-login (evita open redirect). */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return PANEL_HOME;
  if (!next.startsWith("/painel") || next.startsWith("//") || next.includes("\\") || next.includes("://")) return PANEL_HOME;
  return next;
}
