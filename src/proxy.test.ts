import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ENVIRONMENT_PATHS, ENVIRONMENTS } from "@/lib/permissions";
import { config, proxy } from "./proxy";

const visit = (path: string, cookie?: string) => proxy(new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} }));

describe("proxy: barreira otimista dos ambientes privados", () => {
  it("cobre a raiz de todos os ambientes definidos em src/lib/permissions", () => {
    expect([...config.matcher].sort()).toEqual(ENVIRONMENTS.map((environment) => `${ENVIRONMENT_PATHS[environment]}/:path*`).sort());
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
