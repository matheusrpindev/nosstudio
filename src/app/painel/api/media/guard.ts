import { authorizePermission, type CurrentUser } from "@/lib/auth";
import type { Action } from "@/lib/permissions";
import { isSameOrigin } from "@/lib/request";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Autorização das rotas de API do painel (Route Handlers não podem usar `requireUser`, que redireciona):
 * exige sessão válida de uma conta do painel, senha já definida, a permissão `action` no módulo Arquivos e
 * mesma origem (CSRF). Devolve o usuário ou a resposta de erro (401 sem sessão; 403 nos demais casos).
 * Freelancer e cliente não enviam nem apagam nada por aqui: o envio de arquivos de projeto terá rota própria.
 */
export async function authorize(request: Request, action: Action = "editar"): Promise<CurrentUser | Response> {
  const user = await authorizePermission("arquivos", action);
  if (user instanceof Response) return user;
  if (!isSameOrigin(request)) return json({ error: "Origem da requisição não permitida." }, 403);
  return user;
}
