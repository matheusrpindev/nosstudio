/**
 * POST /api/visita — recebe o "sinal" de página vista / clique medido que o site público envia
 * (`src/components/site/visit-tracker.tsx`). Rota PÚBLICA: é a única entrada da medição de visitas.
 *
 * Proteções, na ordem:
 * 1. mesma origem (cabeçalho Origin = o próprio site; `Sec-Fetch-Site`, quando o navegador manda);
 * 2. corpo pequeno (até 1 KB) e validado com zod — fora disso, 400/413;
 * 3. o que NÃO conta responde 204 sem gravar nada: robô declarado, pré-carregamento, quem tem sessão do painel
 *    (a pré-visualização dos sócios não entra na conta) e caminhos do painel/acesso/arquivos;
 * 4. limite por IP (o limitador de tentativas do sistema, com uma chave derivada do sal do dia) — 429.
 *
 * O IP serve só para calcular, na memória, o código do visitante do dia e a chave do limitador: não é gravado
 * (método em `src/server/metrics/collect.ts`). A rota não grava cookie e nunca derruba a página: qualquer falha
 * interna vira 204.
 */
import type { NextRequest } from "next/server";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { rateLimitIp, resolveClientIp, UNKNOWN_IP } from "@/lib/client-ip";
import { todayISO } from "@/lib/dates";
import { env } from "@/lib/env";
import { BEACON_MAX_BYTES, parseBeacon } from "@/lib/metrics/beacon";
import { classifyDevice, classifyOrigin, isBotUserAgent, isPrefetchRequest, parseTrackEvent } from "@/lib/metrics/classify";
import { isSameOrigin } from "@/lib/request";
import { recordPageview, recordTrackEvent } from "@/server/metrics/collect";
import { resolvePageKey } from "@/server/metrics/paths";
import { dailySalt, visitRateKey } from "@/server/metrics/salt";

const SESSION_COOKIES = ["__Host-nos_session", "nos_session"];
/** Por IP: folga para uma rede compartilhada (escritório, faculdade), mas não para um laço de requisições. */
const RATE_RULE = { limit: 300, windowMs: 5 * 60 * 1000 } as const;
/**
 * Sem proxy na frente (ou cabeçalho inválido) todo mundo cai no mesmo balde "IP desconhecido": o teto é mais alto
 * para a contagem não parar num dia movimentado — continua existindo um limite para o banco.
 */
const UNKNOWN_IP_RATE_RULE = { limit: 3000, windowMs: 5 * 60 * 1000 } as const;

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } as const;
const reply = (status: number, extra: Record<string, string> = {}) => new Response(null, { status, headers: { ...HEADERS, ...extra } });

/** Lê o corpo até `max` bytes. `null` = passou do limite. */
async function readBody(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: NextRequest) {
  // 1. só o próprio site fala com esta rota
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!isSameOrigin(request) || (fetchSite !== null && fetchSite !== "same-origin")) return reply(403);

  // 2. corpo pequeno e bem formado
  const body = await readBody(request, BEACON_MAX_BYTES).catch(() => "");
  if (body === null) return reply(413);
  const beacon = parseBeacon(body);
  if (!beacon) return reply(400);
  const event = beacon.t === "e" ? parseTrackEvent(beacon.e) : null;
  if (beacon.t === "e" && !event) return reply(400);

  // 3. o que não conta
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);
  if (isBotUserAgent(userAgent) || isPrefetchRequest(request.headers)) return reply(204);
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return reply(204);

  try {
    const page = await resolvePageKey(beacon.p);
    if (page === null) return reply(204);

    // 4. limite por IP (a chave não guarda o IP e deixa de valer quando o sal do dia é apagado)
    const now = new Date();
    const ip = rateLimitIp(resolveClientIp(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"), env.trustedProxies));
    const { salt } = await dailySalt(todayISO(now));
    const allowed = await consumeRateLimit(visitRateKey(salt, ip), ip === UNKNOWN_IP ? UNKNOWN_IP_RATE_RULE : RATE_RULE);
    if (!allowed.ok) return reply(429, { "Retry-After": String(allowed.retryAfterSeconds) });

    if (event) {
      await recordTrackEvent({ now, ip, userAgent, event });
    } else {
      const origin = classifyOrigin({
        referrerHost: beacon.r,
        siteHost: request.headers.get("x-forwarded-host") || request.headers.get("host"),
        utmSource: beacon.us,
        utmMedium: beacon.um,
        utmCampaign: beacon.uc,
      });
      await recordPageview({ now, ip, userAgent, page, origin, device: classifyDevice(userAgent, beacon.w) });
    }
  } catch (error) {
    // a medição nunca atrapalha a navegação: registra no log do servidor e segue
    console.error("[métricas] falha ao registrar o sinal de visita:", (error as Error)?.message ?? "erro desconhecido");
  }
  return reply(204);
}
