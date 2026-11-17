import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** IP do visitante, considerando os proxies confiáveis à frente do app. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // O último proxy confiável acrescenta o IP real ao final da lista.
    const index = Math.max(0, parts.length - Math.max(1, env.trustedProxies));
    if (parts[index]) return parts[index];
  }
  return h.get("x-real-ip") || "0.0.0.0";
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
