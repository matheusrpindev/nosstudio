import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem OTIMISTA de acesso ao painel: sem cookie de sessão, nem tenta renderizar — manda para o login.
 * A autorização de verdade acontece no servidor, em cada página/ação, via `requireUser()` (src/lib/auth).
 * Aqui também renovamos a validade do cookie a cada visita (sessão deslizante de 30 dias).
 */
const COOKIE_NAMES = ["__Host-nos_session", "nos_session"];
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function proxy(request: NextRequest) {
  const cookie = COOKIE_NAMES.map((name) => request.cookies.get(name)).find(Boolean);

  if (!cookie?.value) {
    // Chamadas de API do painel recebem 401 em JSON (um redirecionamento viraria HTML de login no fetch).
    if (request.nextUrl.pathname.startsWith("/painel/api/")) {
      return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/painel") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
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

export const config = {
  matcher: ["/painel/:path*"],
};
