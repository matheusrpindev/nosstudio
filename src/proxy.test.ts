import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ENVIRONMENT_PATHS, ENVIRONMENTS } from "@/lib/permissions";
import { config, proxy } from "./proxy";

const visit = (path: string, cookie?: string) => proxy(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} }));

describe("proxy: barreira otimista dos ambientes privados", () => {
  it("cobre a raiz de todos os ambientes definidos em src/lib/permissions e as telas de acesso (CSP com nonce)", () => {
    const environments = ENVIRONMENTS.map((environment) => `${ENVIRONMENT_PATHS[environment]}/:path*`);
    const access = ["/conta/:path*", "/login", "/recuperar-senha", "/redefinir-senha", "/convite"];
    expect([...config.matcher].sort()).toEqual([...environments, ...access].sort());
  });

  it("sem cookie de sessão: página vai para o login (com o destino), API recebe 401 em JSON", async () => {
    for (const path of ["/painel/clientes", "/equipe/projetos/3", "/cliente"]) {
      const response = visit(path);
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    }
    expect(new URL(visit("/painel").headers.get("location")!).search).toBe("");
    for (const path of ["/painel/api/media", "/equipe/api/arquivos", "/cliente/api/galerias/1"]) {
      const response = visit(path);
      expect(response.status, path).toBe(401);
      expect(await response.json()).toEqual({ error: "Sua sessão expirou. Entre novamente." });
    }
  });

  it("com cookie: deixa passar — quem decide o acesso é o servidor (o proxy não conhece o perfil)", () => {
    for (const path of ["/painel/financeiro", "/equipe", "/cliente/projetos/9"]) {
      const response = visit(path, "nos_session=qualquer-valor");
      expect(response.status, path).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });
});

describe("proxy: Content-Security-Policy com nonce", () => {
  const nonceOf = (policy: string | null) => policy?.match(/'nonce-([^']+)'/)?.[1] ?? null;

  it("telas de acesso e ambientes privados: política com nonce novo a cada resposta, repassada ao Next na requisição", () => {
    for (const [path, cookie] of [["/login", undefined], ["/convite", undefined], ["/conta/senha", undefined], ["/painel/site", "nos_session=x"]] as const) {
      const first = visit(path, cookie);
      const policy = first.headers.get("content-security-policy");
      expect(nonceOf(policy), path).toBeTruthy();
      expect(policy).toContain("'strict-dynamic'");
      // o Next lê o nonce do cabeçalho da REQUISIÇÃO (repassado pelo proxy via x-middleware-request-*)
      expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
      expect(nonceOf(visit(path, cookie).headers.get("content-security-policy"))).not.toBe(nonceOf(policy));
    }
  });

  it("redirecionamento para o login e 401 da API não precisam de política", () => {
    expect(visit("/painel/clientes").headers.get("content-security-policy")).toBeNull();
    expect(visit("/painel/api/media").headers.get("content-security-policy")).toBeNull();
  });
});
