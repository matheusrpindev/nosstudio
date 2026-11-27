/**
 * Coleta de visitas no banco de teste: sessão e deduplicação, troca diária do sal, limite de chaves e retenção.
 * Os testes usam datas de 2031 (ninguém mais grava lá) e limpam o que criaram.
 */
import { and, eq, gte, like, lte } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { leads, visitSalts, visitSessions, visitStats } from "@/db/schema";
import type { VisitDimension } from "@/lib/domain";
import { NOT_FOUND_PAGE_KEY, OTHER_KEY, parseTrackEvent, SESSION_IDLE_MS, VISIT_SESSION_RETENTION_DAYS, type VisitOrigin } from "@/lib/metrics/classify";
import { parseMetricsPeriod } from "@/lib/metrics/period";
import { leadFormSchema } from "@/lib/site/lead-form";
import { createLead } from "@/server/leads/create-lead";
import { recordFormSubmission, recordPageview, recordTrackEvent } from "./collect";
import { resolvePageKey } from "./paths";
import { getMetricsReport, getVisitSnapshot } from "./queries";
import { pruneVisitData } from "./retention";
import { dailySalt, visitorHash, visitRateKey } from "./salt";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const DIRECT: VisitOrigin = { source: "direto", referrerHost: "", campaign: "" };
const INSTAGRAM: VisitOrigin = { source: "social", referrerHost: "instagram.com", campaign: "" };

/** Meio-dia no horário do estúdio (UTC−3). */
const at = (day: string, time = "12:00:00") => new Date(`${day}T${time}-03:00`);
const minutes = (date: Date, n: number) => new Date(date.getTime() + n * 60_000);

async function wipe() {
  await db.delete(visitSessions).where(like(visitSessions.day, "2031-%"));
  await db.delete(visitStats).where(like(visitStats.day, "2031-%"));
  await db.delete(visitSalts).where(like(visitSalts.day, "2031-%"));
}
beforeEach(wipe);
afterAll(wipe);

async function stat(day: string, dimension: VisitDimension, key = "") {
  const [row] = await db
    .select()
    .from(visitStats)
    .where(and(eq(visitStats.day, day), eq(visitStats.dimension, dimension), eq(visitStats.key, key)));
  return row ? { visits: row.visits, visitors: row.visitors, hits: row.hits } : null;
}
const view = (now: Date, page = "/", ip = "203.0.113.10", userAgent = CHROME, origin = DIRECT) => recordPageview({ now, ip, userAgent, page, origin, device: userAgent === IPHONE ? "celular" : "computador" });

describe("visita = sessão do visitante (30 minutos de inatividade)", () => {
  const day = "2031-03-10";

  it("várias páginas seguidas contam UMA visita, um visitante e N páginas", async () => {
    const start = at(day);
    expect(await view(start, "/")).toEqual({ newVisit: true, newVisitor: true });
    expect(await view(minutes(start, 1), "/servicos")).toEqual({ newVisit: false, newVisitor: false });
    expect(await view(minutes(start, 3), "/contato")).toEqual({ newVisit: false, newVisitor: false });
    // recarregar a mesma página também não abre visita nova
    await view(minutes(start, 4), "/contato");

    expect(await stat(day, "total")).toEqual({ visits: 1, visitors: 1, hits: 4 });
    expect(await stat(day, "pagina", "/")).toEqual({ visits: 1, visitors: 0, hits: 1 });
    expect(await stat(day, "pagina", "/contato")).toEqual({ visits: 0, visitors: 0, hits: 2 });
    expect(await stat(day, "origem", "direto")).toEqual({ visits: 1, visitors: 0, hits: 0 });
    expect(await stat(day, "dispositivo", "computador")).toEqual({ visits: 1, visitors: 0, hits: 0 });
    const sessions = await db.select().from(visitSessions).where(eq(visitSessions.day, day));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ pageviews: 4, entryPath: "/", source: "direto", device: "computador" });
  });

  it("a janela é deslizante: 29 min depois da ÚLTIMA página ainda é a mesma visita; 31 min parado abre outra", async () => {
    const start = at(day);
    await view(start);
    await view(minutes(start, 29));
    await view(minutes(start, 58)); // 29 min depois da anterior
    expect(await stat(day, "total")).toEqual({ visits: 1, visitors: 1, hits: 3 });

    const back = new Date(minutes(start, 58).getTime() + SESSION_IDLE_MS + 60_000);
    expect(await view(back, "/planos", "203.0.113.10", CHROME, INSTAGRAM)).toEqual({ newVisit: true, newVisitor: false });
    // segunda visita do MESMO visitante: visitas 2, visitantes 1
    expect(await stat(day, "total")).toEqual({ visits: 2, visitors: 1, hits: 4 });
    expect(await stat(day, "origem", "social")).toEqual({ visits: 1, visitors: 0, hits: 0 });
    expect(await stat(day, "referencia", "instagram.com")).toEqual({ visits: 1, visitors: 0, hits: 0 });
    expect(await stat(day, "pagina", "/planos")).toEqual({ visits: 1, visitors: 0, hits: 1 });
  });

  it("outra rede ou outro navegador é outro visitante", async () => {
    const start = at(day);
    await view(start, "/", "203.0.113.10", CHROME);
    await view(start, "/", "203.0.113.11", CHROME);
    await view(start, "/", "203.0.113.10", IPHONE);
    expect(await stat(day, "total")).toEqual({ visits: 3, visitors: 3, hits: 3 });
    expect(await stat(day, "dispositivo", "celular")).toEqual({ visits: 1, visitors: 0, hits: 0 });
  });

  it("campanha (UTM) entra no recorte de campanhas", async () => {
    await view(at(day), "/", "203.0.113.10", CHROME, { source: "campanha", referrerHost: "instagram.com", campaign: "lançamento" });
    expect(await stat(day, "origem", "campanha")).toEqual({ visits: 1, visitors: 0, hits: 0 });
    expect(await stat(day, "campanha", "lançamento")).toEqual({ visits: 1, visitors: 0, hits: 0 });
  });

  it("nada que identifique a pessoa é gravado: nem IP, nem navegador", async () => {
    await view(at(day), "/", "203.0.113.77", CHROME);
    const dump = JSON.stringify([await db.select().from(visitSessions).where(eq(visitSessions.day, day)), await db.select().from(visitStats).where(eq(visitStats.day, day))]);
    expect(dump).not.toContain("203.0.113.77");
    expect(dump).not.toContain("Chrome");
    expect(dump).not.toContain("Windows");
  });

  it("clique medido conta e mantém a visita viva", async () => {
    const start = at(day);
    const event = parseTrackEvent("whatsapp:flutuante")!;
    await view(start);
    await recordTrackEvent({ now: minutes(start, 25), ip: "203.0.113.10", userAgent: CHROME, event });
    await recordTrackEvent({ now: minutes(start, 26), ip: "203.0.113.10", userAgent: CHROME, event: parseTrackEvent("banner:7")! });
    // 50 min depois da primeira página, mas 24 min depois do último clique: mesma visita
    expect(await view(minutes(start, 50), "/contato")).toEqual({ newVisit: false, newVisitor: false });
    expect(await stat(day, "clique", "whatsapp:flutuante")).toEqual({ visits: 0, visitors: 0, hits: 1 });
    expect(await stat(day, "clique", "banner:7")).toEqual({ visits: 0, visitors: 0, hits: 1 });
    expect(await stat(day, "total")).toEqual({ visits: 1, visitors: 1, hits: 2 });
  });
});

describe("sal do dia", () => {
  it("o sal é aleatório, único por dia e estável dentro do dia", async () => {
    const first = await dailySalt("2031-04-01");
    const again = await dailySalt("2031-04-01");
    expect(first.created).toBe(true);
    expect(again).toEqual({ salt: first.salt, created: false });
    expect(first.salt.length).toBeGreaterThanOrEqual(40);
  });

  it("na virada do dia o sal antigo é APAGADO e o código do mesmo visitante muda", async () => {
    const ip = "203.0.113.20";
    await view(at("2031-04-01", "23:50:00"), "/", ip);
    const [before] = await db.select().from(visitSessions).where(eq(visitSessions.day, "2031-04-01"));
    const [oldSalt] = await db.select().from(visitSalts).where(eq(visitSalts.day, "2031-04-01"));
    expect(before.visitorHash).toBe(visitorHash(oldSalt.salt, ip, CHROME));

    // 15 minutos depois, já no dia seguinte: outro sal → outro código → conta como visitante (e visita) do novo dia
    expect(await view(at("2031-04-02", "00:05:00"), "/", ip)).toEqual({ newVisit: true, newVisitor: true });
    const [after] = await db.select().from(visitSessions).where(eq(visitSessions.day, "2031-04-02"));
    expect(after.visitorHash).not.toBe(before.visitorHash);
    expect(after.visitorHash).toMatch(/^[a-f0-9]{32}$/);

    const salts = await db.select().from(visitSalts).where(like(visitSalts.day, "2031-%"));
    expect(salts.map((row) => row.day)).toEqual(["2031-04-02"]);
    expect(salts[0].salt).not.toBe(oldSalt.salt);
    expect(await stat("2031-04-01", "total")).toEqual({ visits: 1, visitors: 1, hits: 1 });
    expect(await stat("2031-04-02", "total")).toEqual({ visits: 1, visitors: 1, hits: 1 });
  });

  it("o código depende do sal, do IP e do navegador; a chave do limitador não é o código do visitante", () => {
    const a = visitorHash("sal-a", "203.0.113.1", CHROME);
    expect(visitorHash("sal-a", "203.0.113.1", CHROME)).toBe(a);
    expect(visitorHash("sal-b", "203.0.113.1", CHROME)).not.toBe(a);
    expect(visitorHash("sal-a", "203.0.113.2", CHROME)).not.toBe(a);
    expect(visitorHash("sal-a", "203.0.113.1", IPHONE)).not.toBe(a);
    expect(visitRateKey("sal-a", "203.0.113.1")).toMatch(/^visita:[a-f0-9]{32}$/);
    expect(visitRateKey("sal-a", "203.0.113.1")).not.toContain(a);
    expect(visitRateKey("sal-a", "203.0.113.1")).not.toContain("203.0.113.1");
  });
});

describe("páginas e limite de chaves", () => {
  it("endereço do painel não conta; endereço que não existe vira 'página não encontrada'", async () => {
    expect(await resolvePageKey("/painel/leads")).toBeNull();
    expect(await resolvePageKey("/login")).toBeNull();
    expect(await resolvePageKey("/media/x.webp")).toBeNull();
    expect(await resolvePageKey("/sobre?x=1#y")).toBe("/sobre");
    expect(await resolvePageKey("/servicos/slug-que-nao-existe-zzz")).toBe(NOT_FOUND_PAGE_KEY);
    expect(await resolvePageKey("/qualquer/coisa")).toBe(NOT_FOUND_PAGE_KEY);
  });

  it("passou do limite diário de chaves diferentes, o excedente soma em '(outros)'", async () => {
    const day = "2031-05-05";
    const start = at(day);
    // 100 campanhas diferentes cabem; a 101ª e a 102ª caem em "(outros)"
    for (let i = 0; i < 102; i++) {
      await view(minutes(start, i), "/", `198.51.100.${i}`, CHROME, { source: "campanha", referrerHost: "", campaign: `campanha ${i}` });
    }
    const rows = await db.select().from(visitStats).where(and(eq(visitStats.day, day), eq(visitStats.dimension, "campanha")));
    expect(rows).toHaveLength(101);
    expect(await stat(day, "campanha", OTHER_KEY)).toEqual({ visits: 2, visitors: 0, hits: 0 });
    expect(await stat(day, "campanha", "campanha 101")).toBeNull();
    expect(await stat(day, "total")).toEqual({ visits: 102, visitors: 102, hits: 102 });
  }, 30_000);
});

describe("retenção", () => {
  it("sessões brutas somem depois do prazo; os totais diários ficam", async () => {
    const old = at("2031-06-01");
    const recent = at("2031-07-05");
    await view(old, "/", "203.0.113.30");
    await view(recent, "/", "203.0.113.30");
    const now = new Date(old.getTime() + (VISIT_SESSION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(now.getTime()).toBeLessThan(recent.getTime() + VISIT_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await pruneVisitData(now);

    const sessions = await db.select().from(visitSessions).where(like(visitSessions.day, "2031-%"));
    expect(sessions.map((row) => row.day)).toEqual(["2031-07-05"]);
    expect(await stat("2031-06-01", "total")).toEqual({ visits: 1, visitors: 1, hits: 1 });
    // sais de dias anteriores também não ficam
    const salts = await db.select().from(visitSalts).where(and(gte(visitSalts.day, "2031-01-01"), lte(visitSalts.day, "2031-07-01")));
    expect(salts).toEqual([]);
  });

  it("a virada do dia já dispara a limpeza das sessões vencidas", async () => {
    await view(at("2031-08-01"), "/", "203.0.113.40");
    // primeiro acesso de um dia 40 dias depois: cria o sal do dia e limpa as sessões antigas
    await view(at("2031-09-10"), "/", "203.0.113.41");
    const sessions = await db.select().from(visitSessions).where(like(visitSessions.day, "2031-%"));
    expect(sessions.map((row) => row.day)).toEqual(["2031-09-10"]);
  });
});

describe("formulários e relatório", () => {
  it("envio de formulário conta pela página (sem dado do lead) e nunca lança", async () => {
    const now = at("2031-10-10");
    await recordFormSubmission("/contato#formulario", now);
    await recordFormSubmission("/contato", now);
    await recordFormSubmission(null, now);
    await recordFormSubmission("/painel/leads", now);
    expect(await stat("2031-10-10", "formulario", "/contato")).toEqual({ visits: 0, visitors: 0, hits: 2 });
    expect(await stat("2031-10-10", "formulario", "(página não informada)")).toEqual({ visits: 0, visitors: 0, hits: 2 });
  });

  it("criar um lead pelo site conta um formulário enviado hoje", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const before = (await stat(today, "formulario", "/eventos-e-casamentos"))?.hits ?? 0;
    const lead = await createLead(leadFormSchema.parse({ name: "[Teste] Métricas", whatsapp: "(11) 98888-7777", consent: "on", originPath: "/eventos-e-casamentos#eventos-formulario" }), "2026-11");
    try {
      expect((await stat(today, "formulario", "/eventos-e-casamentos"))?.hits).toBe(before + 1);
    } finally {
      await db.delete(leads).where(eq(leads.id, lead.id));
      await db
        .update(visitStats)
        .set({ hits: before })
        .where(and(eq(visitStats.day, today), eq(visitStats.dimension, "formulario"), eq(visitStats.key, "/eventos-e-casamentos")));
    }
  });

  it("relatório do período lê os totais gravados e compara com o período anterior", async () => {
    const start = at("2031-11-20");
    await view(start, "/", "203.0.113.50", CHROME, INSTAGRAM);
    await view(minutes(start, 1), "/servicos", "203.0.113.50", CHROME);
    await view(start, "/", "203.0.113.51", IPHONE);
    await view(at("2031-11-12"), "/", "203.0.113.52", CHROME);
    await recordTrackEvent({ now: minutes(start, 2), ip: "203.0.113.50", userAgent: CHROME, event: parseTrackEvent("whatsapp:rodape")! });
    await recordFormSubmission("/contato", minutes(start, 3));

    const period = parseMetricsPeriod({ periodo: "intervalo", de: "2031-11-17", ate: "2031-11-23" }, "2031-11-23");
    const report = await getMetricsReport(period);
    expect(report.totals).toMatchObject({ visits: 2, visitors: 2, pageviews: 3, forms: 1, whatsappClicks: 1, bannerClicks: 0 });
    expect(report.totals.conversion).toBeCloseTo(0.5);
    expect(report.previous).toEqual({ from: "2031-11-10", to: "2031-11-16" });
    expect(report.previousTotals.visits).toBe(1);
    expect(report.previousHasData).toBe(true);
    expect(report.days).toHaveLength(7);
    expect(report.days.find((point) => point.day === "2031-11-20")).toMatchObject({ visits: 2, visitors: 2, pageviews: 3, forms: 1, whatsappClicks: 1 });
    expect(report.sources.map((item) => item.key).sort()).toEqual(["direto", "social"]);
    expect(report.devices.map((item) => item.key).sort()).toEqual(["celular", "computador"]);
    expect(report.pages[0]).toMatchObject({ key: "/", views: 2, entries: 2 });
    expect(report.whatsappClicks[0]).toMatchObject({ label: "Rodapé", value: 1 });

    const snapshot = await getVisitSnapshot("2031-11-20");
    expect(snapshot).toMatchObject({ today: 2, visitorsToday: 2, last7: 2 });
    expect((await getVisitSnapshot("2031-11-21")).today).toBe(0);
    expect((await getVisitSnapshot("2031-11-21")).last7).toBe(2);
  });
});
