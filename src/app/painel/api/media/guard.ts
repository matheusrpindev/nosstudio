import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/request";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Autorização das rotas de API do painel (Route Handlers não podem usar `requireUser`, que redireciona):
 * exige sessão válida, senha já definida e mesma origem (CSRF). Devolve o usuário ou a resposta de erro.
 */
export async function authorize(request: Request): Promise<CurrentUser | Response> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return json({ error: "Sua sessão expirou. Entre novamente." }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origem da requisição não permitida." }, 403);
  return user;
}
