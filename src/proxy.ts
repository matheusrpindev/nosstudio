import { NextResponse, type NextRequest } from "next/server";
import { createNonce, PRIVATE_CSP_PATH, privateCsp } from "@/lib/security/csp";

/**
 * Duas tarefas, só nos ambientes privados e nas telas de acesso (ver `config.matcher`):
 *
 * 1. Content-Security-Policy com NONCE (src/lib/security/csp.ts): um nonce novo por requisição vai no cabeçalho
 *    da resposta e no da requisição — o Next lê o da requisição e põe o nonce nos scripts dele. O site público
 *    não passa por aqui: é estático e recebe a política sem nonce do next.config.ts.
 * 2. Checagem OTIMISTA de acesso aos ambientes privados (painel, Área da Equipe, Área do Cliente): sem cookie de
 *    sessão, nem tenta renderizar — manda para o login. O proxy NÃO sabe o perfil de ninguém: quem decide se a
 *    conta entra naquele ambiente e o que ela vê é o servidor, em cada página/ação, via `requireUser()`,
 *    `requirePermission()` e `requireEnvironment()` (src/lib/auth). Aqui também renovamos a validade do cookie
 *    a cada visita (sessão deslizante de 30 dias).
 *
 * `/equipe` e `/cliente` ainda não têm telas (respondem 404 a quem está logado); já entram no matcher para que
 * as rotas nasçam atrás da mesma barreira. Os prefixos repetem `ENVIRONMENT_PATHS` de src/lib/permissions — o
 * matcher precisa ser literal.
 */
const COOKIE_NAMES = ["__Host-nos_session", "nos_session"];
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const PRIVATE_AREA = /^\/(painel|equipe|cliente)(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PRIVATE_AREA.test(pathname)) {
    const cookie = COOKIE_NAMES.map((name) => request.cookies.get(name)).find(Boolean);
    if (!cookie?.value) {
      // Chamadas de API dos ambientes recebem 401 em JSON (um redirecionamento viraria HTML de login no fetch).
      if (/^\/(painel|equipe|cliente)\/api\//.test(pathname)) {
        return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
      }
      const login = new URL("/login", request.url);
      const next = pathname + request.nextUrl.search;
      if (next !== "/painel") login.searchParams.set("next", next);
      return NextResponse.redirect(login);
    }
    const response = withCsp(request);
    // Só renova em navegações de página (não em prefetch/RSC), para não reescrever o cookie a todo momento.
    const isPageVisit = request.method === "GET" && request.headers.get("sec-fetch-dest") === "document";
    if (isPageVisit) {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: cookie.name.startsWith("__Host-"),
        sameSite: "lax",
        path: "/",
        maxAge: THIRTY_DAYS,
      });
    }
    return response;
  }

  return withCsp(request);
}

/** Segue para a página com a política com nonce nos dois sentidos (requisição → Next; resposta → navegador). */
function withCsp(request: NextRequest): NextResponse {
  if (!PRIVATE_CSP_PATH.test(request.nextUrl.pathname)) return NextResponse.next();
  const policy = privateCsp(createNonce(), { dev: process.env.NODE_ENV !== "production" });
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/equipe/:path*",
    "/cliente/:path*",
    "/conta/:path*",
    "/login",
    "/recuperar-senha",
    "/redefinir-senha",
    "/convite",
  ],
};
