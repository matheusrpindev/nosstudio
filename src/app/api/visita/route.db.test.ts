/**
 * POST /api/visita (banco de teste): o que a rota recusa, o que ela ignora em silêncio e o que conta.
 * O relógio é fixado em 2032 para os totais não se misturarem com os de outros testes.
 */
import { and, eq, like } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { rateLimits, visitSalts, visitSessions, visitStats } from "@/db/schema";
import { POST } from "./route";

const DAY = "2032-01-15";
const ORIGIN = "https://nosstudio.test";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function wipe() {
  await db.delete(visitSessions).where(like(visitSessions.day, "2032-%"));
  await db.delete(visitStats).where(like(visitStats.day, "2032-%"));
  await db.delete(visitSalts).where(like(visitSalts.day, "2032-%"));
  await db.delete(rateLimits).where(like(rateLimits.key, "visita:%"));
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DAY}T15:00:00Z`));
});
beforeEach(wipe);
afterAll(async () => {
  await wipe();
  vi.useRealTimers();
});

type Options = { headers?: Record<string, string | null>; raw?: string };
function send(body: unknown, { headers = {}, raw }: Options = {}) {
  const all: Record<string, string | null> = {
    origin: ORIGIN,
    host: "nosstudio.test",
    "user-agent": CHROME,
    "x-forwarded-for": "203.0.113.5",
    "content-type": "text/plain;charset=UTF-8",
    ...headers,
  };
  const clean = Object.fromEntries(Object.entries(all).filter((entry): entry is [string, string] => entry[1] !== null));
  return POST(new NextRequest(`${ORIGIN}/api/visita`, { method: "POST", headers: clean, body: raw ?? JSON.stringify(body) }));
}
async function total() {
  const [row] = await db
    .select()
    .from(visitStats)
    .where(and(eq(visitStats.day, DAY), eq(visitStats.dimension, "total")));
  return row ? { visits: row.visits, visitors: row.visitors, hits: row.hits } : null;
}
const statRows = () => db.select().from(visitStats).where(eq(visitStats.day, DAY));

describe("POST /api/visita", () => {
  it("página vista de um navegador comum: 204, sem cookie, e a visita é contada", async () => {
    const response = await send({ t: "p", p: "/", r: "l.instagram.com", w: 390 });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await total()).toEqual({ visits: 1, visitors: 1, hits: 1 });
    const rows = await statRows();
    expect(rows.find((row) => row.dimension === "origem")?.key).toBe("social");
    expect(rows.find((row) => row.dimension === "referencia")?.key).toBe("instagram.com");

    // segunda página do mesmo visitante: mesma visita
    expect((await send({ t: "p", p: "/servicos" })).status).toBe(204);
    expect(await total()).toEqual({ visits: 1, visitors: 1, hits: 2 });
    // outro IP: outro visitante
    await send({ t: "p", p: "/" }, { headers: { "x-forwarded-for": "203.0.113.6" } });
    expect(await total()).toEqual({ visits: 2, visitors: 2, hits: 3 });
  });

  it("referência do próprio site é acesso direto; UTM vira campanha", async () => {
    await send({ t: "p", p: "/", r: "nosstudio.test" });
    await send({ t: "p", p: "/", us: "instagram", um: "bio", uc: "Verão 2032" }, { headers: { "x-forwarded-for": "203.0.113.7" } });
    const rows = await statRows();
    expect(rows.filter((row) => row.dimension === "origem").map((row) => row.key).sort()).toEqual(["campanha", "direto"]);
    expect(rows.find((row) => row.dimension === "campanha")?.key).toBe("verão 2032");
    expect(rows.some((row) => row.dimension === "referencia")).toBe(false);
  });

  it("clique medido conta; evento fora do contrato é recusado", async () => {
    expect((await send({ t: "e", p: "/contato", e: "whatsapp:contato" })).status).toBe(204);
    expect((await send({ t: "e", p: "/", e: "banner:4" })).status).toBe(204);
    expect((await send({ t: "e", p: "/", e: "outro:coisa" })).status).toBe(400);
    expect((await send({ t: "e", p: "/", e: "banner:<img>" })).status).toBe(400);
    const clicks = (await statRows()).filter((row) => row.dimension === "clique");
    expect(clicks.map((row) => [row.key, row.hits]).sort()).toEqual([
      ["banner:4", 1],
      ["whatsapp:contato", 1],
    ]);
  });

  it("de outra origem (ou sem origem) é recusado e nada é gravado", async () => {
    expect((await send({ t: "p", p: "/" }, { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await send({ t: "p", p: "/" }, { headers: { origin: null } })).status).toBe(403);
    expect((await send({ t: "p", p: "/" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(await total()).toBeNull();
    // o navegador de verdade manda same-origin
    expect((await send({ t: "p", p: "/" }, { headers: { "sec-fetch-site": "same-origin" } })).status).toBe(204);
    expect(await total()).toEqual({ visits: 1, visitors: 1, hits: 1 });
  });

  it("malformado ou grande demais é recusado", async () => {
    expect((await send(null, { raw: "não é json" })).status).toBe(400);
    expect((await send({ t: "p" })).status).toBe(400);
    expect((await send({ t: "p", p: "/", ip: "1.2.3.4" })).status).toBe(400);
    expect((await send({ t: "p", p: "/", w: "largo" })).status).toBe(400);
    expect((await send(null, { raw: JSON.stringify({ t: "p", p: "/", r: "x".repeat(5000) }) })).status).toBe(413);
    expect(await total()).toBeNull();
  });

  it("robô, pré-carregamento, quem está logado no painel e rotas do painel: 204 sem contar", async () => {
    const quiet: Options[] = [
      { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } },
      { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36" } },
      { headers: { "user-agent": "curl/8.5.0" } },
      { headers: { "user-agent": null } },
      { headers: { "sec-purpose": "prefetch" } },
      { headers: { cookie: "nos_session=qualquer-valor" } },
      { headers: { cookie: "outro=1; __Host-nos_session=abc" } },
    ];
    for (const options of quiet) expect((await send({ t: "p", p: "/" }, options)).status, JSON.stringify(options)).toBe(204);
    for (const path of ["/painel", "/painel/site/metricas", "/login", "/convite", "/media/a.webp", "/conta/senha"]) {
      expect((await send({ t: "p", p: path })).status, path).toBe(204);
    }
    expect(await total()).toBeNull();
    expect(await db.select().from(visitSessions).where(eq(visitSessions.day, DAY))).toEqual([]);
  });

  it("endereço que não existe conta a visita, mas o texto digitado não é guardado", async () => {
    await send({ t: "p", p: "/pagina-secreta-de-alguem-123" });
    const pages = (await statRows()).filter((row) => row.dimension === "pagina");
    expect(pages.map((row) => row.key)).toEqual(["(página não encontrada)"]);
  });

  it("limite por IP: depois de 300 sinais em 5 minutos, 429 e nada mais conta", async () => {
    const headers = { "x-forwarded-for": "198.51.100.200" };
    for (let i = 0; i < 300; i++) await send({ t: "e", p: "/", e: "whatsapp:rodape" }, { headers });
    const blocked = await send({ t: "e", p: "/", e: "whatsapp:rodape" }, { headers });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    const [click] = (await statRows()).filter((row) => row.dimension === "clique");
    expect(click.hits).toBe(300);
    // outro IP continua contando; e a chave do limitador não contém o IP
    expect((await send({ t: "p", p: "/" })).status).toBe(204);
    const keys = await db.select().from(rateLimits).where(like(rateLimits.key, "visita:%"));
    expect(keys.length).toBe(2);
    expect(JSON.stringify(keys)).not.toContain("198.51.100.200");
  }, 60_000);
});
