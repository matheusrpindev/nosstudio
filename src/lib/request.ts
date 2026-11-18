import "server-only";
import { headers } from "next/headers";
import { resolveClientIp } from "@/lib/client-ip";
import { env } from "@/lib/env";

/**
 * IP do visitante, considerando os proxies confiáveis à frente do app. Sempre um IP válido (ou "0.0.0.0"
 * quando não dá para saber). Para chaves do limitador de tentativas, passe o resultado por `rateLimitIp()`.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return resolveClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"), env.trustedProxies);
}

export async function getUserAgent(): Promise<string> {
  return ((await headers()).get("user-agent") || "").slice(0, 300);
}

/**
 * Proteção CSRF para Route Handlers que alteram dados (as Server Actions já validam a origem sozinhas):
 * a origem da requisição precisa ser a do próprio site.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
