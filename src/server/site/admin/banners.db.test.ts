import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { banners, settings } from "@/db/schema";
import { ensureInitialBanners, INITIAL_BANNERS, INITIAL_BANNERS_MARK } from "../initial-banners";
import { copyName, createBanner, deleteBanner, duplicateBanner, listBanners, moveBanner, reorderBanners, setBannerEnabled, updateBanner, type Banner, type BannerInput } from "./banners";

/** O banco de teste é compartilhado entre os arquivos: guarda o que houver em `banners` e devolve no fim. */
let backup: Banner[] = [];
let backupMark: (typeof settings.$inferSelect)[] = [];

beforeAll(async () => {
  backup = await db.select().from(banners);
  backupMark = await db.select().from(settings).where(eq(settings.key, INITIAL_BANNERS_MARK));
  await db.delete(banners);
  await db.delete(settings).where(eq(settings.key, INITIAL_BANNERS_MARK));
});
afterAll(async () => {
  await db.delete(banners);
  await db.delete(settings).where(eq(settings.key, INITIAL_BANNERS_MARK));
  if (backup.length) await db.insert(banners).values(backup);
  if (backupMark.length) await db.insert(settings).values(backupMark);
});

const input = (over: Partial<BannerInput> = {}): BannerInput => ({
  name: "[Teste] Banner",
  layout: "tipografico",
  title: "[Teste] Título",
  subtitle: "",
  buttonLabel: "",
  buttonUrl: "",
  secondaryLabel: "",
  secondaryUrl: "",
  desktopMediaId: null,
  mobileMediaId: null,
  videoMediaId: null,
  alt: "",
  bgColor: "roxo",
  tone: "claro",
  durationSeconds: 7,
  startsAt: null,
  endsAt: null,
  enabled: false,
  ...over,
});
const names = async () => (await listBanners()).map((row) => row.name);

describe("banners iniciais (uma vez por banco)", () => {
  it("banco sem banners: cria os quatro do briefing, ligados, só de texto, na ordem", async () => {
    expect(await ensureInitialBanners()).toBe(4);
    const rows = await listBanners();
    expect(rows.map((row) => [row.title, row.subtitle, row.buttonLabel])).toEqual([
      ["Sua história, nosso olhar.", "Marketing, comunicação e audiovisual em um só lugar", "Conheça a NÓS"],
      ["Não apenas vídeos. Histórias.", "Produções que traduzem a essência da sua marca", "Conheça nossas produções"],
      ["O comum não é nosso estilo.", "Design, identidade e criatividade com personalidade", "Explore nosso portfólio"],
      ["Momentos passam. Histórias ficam.", "Fotografia e audiovisual para momentos especiais", "Consulte nossa agenda"],
    ]);
    expect(rows.every((row) => row.enabled && row.layout === "tipografico" && row.desktopMediaId === null && row.startsAt === null)).toBe(true);
    expect(new Set(rows.map((row) => row.bgColor)).size).toBe(4); // quatro composições diferentes
    expect(rows.map((row) => row.buttonUrl)).toEqual(["/sobre", "/servicos/audiovisual", "/portfolio", "/eventos-e-casamentos#eventos-formulario"]);
    expect(INITIAL_BANNERS).toHaveLength(4);
  });

  it("segunda execução não cria nada — nem depois de os sócios apagarem ou editarem", async () => {
    expect(await ensureInitialBanners()).toBe(0);
    const [first] = await listBanners();
    await db.update(banners).set({ title: "[Teste] Editado pelos sócios" }).where(eq(banners.id, first.id));
    await db.delete(banners).where(inArray(banners.id, (await listBanners()).slice(1).map((row) => row.id)));
    expect(await ensureInitialBanners()).toBe(0);
    expect((await listBanners()).map((row) => row.title)).toEqual(["[Teste] Editado pelos sócios"]);
    await db.delete(banners);
    expect(await ensureInitialBanners()).toBe(0);
    expect(await listBanners()).toEqual([]);
  });

  it("banco que já tinha banners criados no painel: não insere nada e grava a marca", async () => {
    await db.delete(settings).where(eq(settings.key, INITIAL_BANNERS_MARK));
    await createBanner(input({ name: "[Teste] Já existia" }));
    expect(await ensureInitialBanners()).toBe(0);
    expect(await names()).toEqual(["[Teste] Já existia"]);
    expect(await db.select().from(settings).where(eq(settings.key, INITIAL_BANNERS_MARK))).toHaveLength(1);
    await db.delete(banners);
  });
});

describe("gestão dos banners", () => {
  it("cria no fim, edita, liga/desliga e exclui", async () => {
    const a = await createBanner(input({ name: "[Teste] A" }));
    const b = await createBanner(input({ name: "[Teste] B", enabled: true }));
    expect(await names()).toEqual(["[Teste] A", "[Teste] B"]);
    expect(b.sortOrder).toBeGreaterThan(a.sortOrder);

    const updated = await updateBanner(a.id, input({ name: "[Teste] A2", durationSeconds: 12, startsAt: "2026-12-24T08:00", endsAt: "2026-12-26T23:59" }));
    expect(updated?.previous.name).toBe("[Teste] A");
    expect(updated?.row).toMatchObject({ name: "[Teste] A2", durationSeconds: 12, startsAt: "2026-12-24T08:00", endsAt: "2026-12-26T23:59", sortOrder: a.sortOrder });
    expect(await updateBanner(999_999, input())).toBeNull();

    expect((await setBannerEnabled(a.id, true))?.enabled).toBe(true);
    expect((await setBannerEnabled(a.id, false))?.enabled).toBe(false);
    expect(await setBannerEnabled(999_999, true)).toBeNull();

    expect((await deleteBanner(b.id))?.name).toBe("[Teste] B");
    expect(await deleteBanner(b.id)).toBeNull();
    expect(await names()).toEqual(["[Teste] A2"]);
    await db.delete(banners);
  });

  it("duplicar: cópia desligada, logo abaixo do original, com o mesmo conteúdo e nome que não repete", async () => {
    const a = await createBanner(input({ name: "[Teste] A", enabled: true, title: "[Teste] Título A", subtitle: "Sub", buttonLabel: "Ir", buttonUrl: "/contato", bgColor: "lima", durationSeconds: 9, startsAt: "2026-12-01T00:00" }));
    await createBanner(input({ name: "[Teste] B" }));
    const copy = await duplicateBanner(a.id);
    expect(copy).toMatchObject({ name: "[Teste] A (cópia)", enabled: false, title: "[Teste] Título A", subtitle: "Sub", buttonLabel: "Ir", buttonUrl: "/contato", bgColor: "lima", durationSeconds: 9, startsAt: "2026-12-01T00:00" });
    expect(copy?.id).not.toBe(a.id);
    expect(await names()).toEqual(["[Teste] A", "[Teste] A (cópia)", "[Teste] B"]);
    // o original continua ligado e intacto
    expect((await listBanners())[0]).toMatchObject({ id: a.id, enabled: true });

    await duplicateBanner(a.id);
    await duplicateBanner(copy?.id ?? 0);
    expect(await names()).toEqual(["[Teste] A", "[Teste] A (cópia 2)", "[Teste] A (cópia)", "[Teste] A (cópia 3)", "[Teste] B"]);
    expect(await duplicateBanner(999_999)).toBeNull();
    await db.delete(banners);
  });

  it("copyName", () => {
    expect(copyName("Natal", [])).toBe("Natal (cópia)");
    expect(copyName("Natal (cópia)", ["Natal (cópia)"])).toBe("Natal (cópia 2)");
    expect(copyName("", [])).toBe("Banner (cópia)");
    expect(copyName("x".repeat(200), []).length).toBeLessThanOrEqual(120);
  });

  it("ordenar: setas (vizinho) e arrastar (lista inteira)", async () => {
    const [a, b, c] = [await createBanner(input({ name: "[Teste] A" })), await createBanner(input({ name: "[Teste] B" })), await createBanner(input({ name: "[Teste] C" }))];
    expect(await moveBanner(c.id, "up")).toBe(true);
    expect(await names()).toEqual(["[Teste] A", "[Teste] C", "[Teste] B"]);
    expect(await moveBanner(a.id, "up")).toBe(false); // já é o primeiro
    expect(await moveBanner(b.id, "down")).toBe(false); // já é o último

    expect(await reorderBanners([b.id, a.id, c.id])).toBe(true);
    expect(await names()).toEqual(["[Teste] B", "[Teste] A", "[Teste] C"]);
    expect((await listBanners()).map((row) => row.sortOrder)).toEqual([0, 1, 2]);
    expect(await reorderBanners([b.id, a.id, c.id])).toBe(false); // nada mudou

    // lista incompleta, com repetidos e ids desconhecidos: o que faltou continua depois, na ordem em que estava
    expect(await reorderBanners([c.id, 999_999, c.id])).toBe(true);
    expect(await names()).toEqual(["[Teste] C", "[Teste] B", "[Teste] A"]);
    await db.delete(banners);
  });
});
