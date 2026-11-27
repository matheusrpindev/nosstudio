import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createNonce, PRIVATE_CSP_PATH, privateCsp, PUBLIC_CSP_SOURCE, publicCsp } from "./csp";

// o mesmo compilador de caminhos que o Next usa para o `source` do next.config (sem tipos publicados)
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (path: string, keys: unknown[], options: { strict: boolean; sensitive: boolean; delimiter: string }) => RegExp;
};

const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1) ?? null;

describe("Content-Security-Policy", () => {
  it("site público: sem nonce, sem eval em produção, sem terceiros além dos players de vídeo", () => {
    const policy = publicCsp({ dev: false });
    expect(directive(policy, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(policy, "script-src-attr")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "frame-src")).toEqual(["'self'", "https://www.youtube-nocookie.com", "https://player.vimeo.com"]);
    expect(policy).not.toContain("unsafe-eval");
    expect(publicCsp({ dev: true })).toContain("'unsafe-eval'");
  });

  it("ambientes privados: só scripts com o nonce (strict-dynamic), sem 'unsafe-inline' em script", () => {
    const nonce = createNonce();
    const policy = privateCsp(nonce, { dev: false });
    expect(directive(policy, "script-src")).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]);
    // o Next extrai o nonce da PRIMEIRA diretiva que começa com "script-src" (script-src-attr não pode vir antes)
    const first = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src"));
    expect(first).toContain(`'nonce-${nonce}'`);
    expect(policy).not.toContain("unsafe-eval");
    expect(directive(policy, "img-src")).toContain("blob:");
  });

  it("nonce: 128 bits em base64, um diferente a cada chamada; valor estranho é recusado", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
    expect(() => privateCsp("x'; script-src *", { dev: false })).toThrow();
  });

  it("cada caminho recebe exatamente uma política (a do next.config ou a do proxy); /media, nenhuma das duas", () => {
    const publicSource = pathToRegexp(PUBLIC_CSP_SOURCE, [], { strict: true, sensitive: false, delimiter: "/" });
    const privatePaths = ["/painel", "/painel/site/rodape", "/painel/api/media", "/login", "/recuperar-senha", "/redefinir-senha", "/convite", "/conta/senha", "/equipe", "/cliente/x"];
    const publicPaths = ["/", "/sobre", "/servicos", "/servicos/fotografia", "/planos", "/contato", "/portfolio/x", "/privacidade", "/api/visita", "/sitemap.xml", "/og"];
    for (const path of privatePaths) {
      expect(PRIVATE_CSP_PATH.test(path), path).toBe(true);
      expect(publicSource.test(path), path).toBe(false);
    }
    for (const path of publicPaths) {
      expect(PRIVATE_CSP_PATH.test(path), path).toBe(false);
      expect(publicSource.test(path), path).toBe(true);
    }
    expect(publicSource.test("/media/pub/a.webp")).toBe(false);
    expect(PRIVATE_CSP_PATH.test("/media/pub/a.webp")).toBe(false);
  });
});
