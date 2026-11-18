import { describe, expect, it } from "vitest";
import { normalizeIp, rateLimitIp, resolveClientIp, UNKNOWN_IP } from "./client-ip";

describe("normalizeIp", () => {
  it("aceita IPv4 e IPv6 e remove porta, colchetes e zona", () => {
    expect(normalizeIp(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(normalizeIp("203.0.113.7:51234")).toBe("203.0.113.7");
    expect(normalizeIp("[2001:DB8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80::1");
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("recusa o que não é IP", () => {
    for (const value of ["", "abc", "1.2.3", "999.1.1.1", "1.2.3.4, 5.6.7.8", "<script>", "unknown", "a".repeat(200), null, undefined]) {
      expect(normalizeIp(value)).toBeNull();
    }
  });
});

describe("resolveClientIp", () => {
  it("com um proxy, vale o último endereço (o que o proxy acrescentou), não o que o cliente mandou", () => {
    expect(resolveClientIp("203.0.113.7", null, 1)).toBe("203.0.113.7");
    expect(resolveClientIp("1.2.3.4, 203.0.113.7", null, 1)).toBe("203.0.113.7");
    expect(resolveClientIp("9.9.9.9, 8.8.8.8, 203.0.113.7", null, 1)).toBe("203.0.113.7");
  });

  it("com dois proxies (ex.: Cloudflare + Nginx), vale o penúltimo", () => {
    expect(resolveClientIp("1.2.3.4, 203.0.113.7, 172.68.1.1", null, 2)).toBe("203.0.113.7");
    expect(resolveClientIp("203.0.113.7", null, 2)).toBe("203.0.113.7");
  });

  it("valor forjado que não é IP cai no balde único (não cria um contador novo a cada requisição)", () => {
    expect(resolveClientIp("qualquer-coisa-1", null, 1)).toBe(UNKNOWN_IP);
    expect(resolveClientIp("qualquer-coisa-2", null, 1)).toBe(UNKNOWN_IP);
    expect(resolveClientIp("1.2.3.4, x' OR 1=1", null, 1)).toBe(UNKNOWN_IP);
  });

  it("sem X-Forwarded-For usa X-Real-IP; sem nada, o balde único", () => {
    expect(resolveClientIp(null, "203.0.113.9", 1)).toBe("203.0.113.9");
    expect(resolveClientIp("", "lixo", 1)).toBe(UNKNOWN_IP);
    expect(resolveClientIp(null, null, 1)).toBe(UNKNOWN_IP);
  });

  it("TRUSTED_PROXIES inválido é tratado como 1", () => {
    expect(resolveClientIp("1.2.3.4, 203.0.113.7", null, Number.NaN)).toBe("203.0.113.7");
    expect(resolveClientIp("1.2.3.4, 203.0.113.7", null, 0)).toBe("203.0.113.7");
    expect(resolveClientIp("1.2.3.4, 203.0.113.7", null, -3)).toBe("203.0.113.7");
  });
});

describe("rateLimitIp", () => {
  it("IPv4 fica inteiro", () => {
    expect(rateLimitIp("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitIp(UNKNOWN_IP)).toBe(UNKNOWN_IP);
  });

  it("IPv6 é agrupado por /64: endereços da mesma rede dividem o contador", () => {
    const a = rateLimitIp("2001:db8:12:3400:aaaa:bbbb:cccc:dddd");
    expect(a).toBe("2001:db8:12:3400::/64");
    expect(rateLimitIp("2001:db8:12:3400::1")).toBe(a);
    expect(rateLimitIp("2001:0db8:0012:3400:1:2:3:4")).toBe(a);
    expect(rateLimitIp("2001:db8:12:3401::1")).not.toBe(a);
    expect(rateLimitIp("::1")).toBe("0:0:0:0::/64");
    expect(rateLimitIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitIp("fe80::")).toBe("fe80:0:0:0::/64");
  });
});
