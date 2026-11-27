import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { portfolioProjects, type PortfolioProject } from "@/db/schema";
import { toPublicProject } from "@/lib/site/portfolio";
import { toPublicImage } from "@/lib/media";
import { createMedia, getMediaById, getMediaByIds, updateMediaAlt } from "@/server/media";
import {
  deletePortfolioProject,
  findPublishBlockers,
  getPortfolioProject,
  listPortfolio,
  listRelatedOptions,
  movePortfolio,
  reorderPortfolio,
  savePortfolioProject,
  setPortfolioFeatured,
  setPortfolioPublished,
  type PortfolioInput,
} from "./portfolio";

/**
 * Portfólio no painel, com banco: ordem (projeto novo no topo, setas e arrastar), publicação (só com capa e texto
 * alternativo), relacionados e limpeza das imagens. O banco de teste é compartilhado entre os arquivos: o que já
 * existir na tabela é guardado e devolvido no fim.
 */
let backup: PortfolioProject[] = [];
const stamp = Date.now();
let counter = 0;

const input = (over: Partial<PortfolioInput> = {}): PortfolioInput => ({
  title: `[Teste] Projeto ${stamp}-${counter++}`,
  slug: "",
  category: "fotografia",
  clientName: "",
  showClient: false,
  summary: "",
  description: "",
  servicesDone: [],
  coverMediaId: null,
  gallery: [],
  videoUrl: null,
  projectDate: null,
  featured: false,
  published: false,
  ...over,
});

async function image(alt = "") {
  const buffer = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 59, g: 31 + (counter++ % 200), b: 142 } } })
    .jpeg()
    .toBuffer();
  const row = await createMedia({ buffer, originalName: "foto.jpg", visibility: "public" });
  if (alt) await updateMediaAlt(row.id, alt);
  return row;
}

const create = async (over: Partial<PortfolioInput> = {}) => {
  const result = await savePortfolioProject(null, input(over));
  if (!result.ok) throw new Error(result.error);
  return result.row;
};
const order = async () => (await listPortfolio()).map((row) => row.id);

beforeAll(async () => {
  backup = await db.select().from(portfolioProjects);
  await db.delete(portfolioProjects);
});

afterAll(async () => {
  await db.delete(portfolioProjects);
  if (backup.length) await db.insert(portfolioProjects).values(backup);
});

describe("ordem do portfólio", () => {
  it("projeto novo entra no topo; setas trocam com o vizinho; arrastar aplica a ordem inteira", async () => {
    const a = await create();
    const b = await create();
    const c = await create();
    expect(await order()).toEqual([c.id, b.id, a.id]);

    expect(await movePortfolio(a.id, "up")).toBe(true);
    expect(await order()).toEqual([c.id, a.id, b.id]);
    expect(await movePortfolio(c.id, "up")).toBe(false); // já é o primeiro
    expect(await movePortfolio(b.id, "down")).toBe(false); // já é o último

    expect(await reorderPortfolio([b.id, c.id, a.id])).toBe(true);
    expect(await order()).toEqual([b.id, c.id, a.id]);
    expect(await reorderPortfolio([b.id, c.id, a.id])).toBe(false); // nada mudou

    // id estranho ou repetido é ignorado; projeto que faltou na lista fica no fim, na ordem em que estava
    expect(await reorderPortfolio([a.id, 999_999, a.id])).toBe(true);
    expect(await order()).toEqual([a.id, b.id, c.id]);

    // depois de reordenar, um projeto novo continua entrando no topo
    const d = await create();
    expect(await order()).toEqual([d.id, a.id, b.id, c.id]);
    for (const row of [a, b, c, d]) await deletePortfolioProject(row.id);
  });
});

describe("publicação", () => {
  it("só publica com capa e com texto alternativo em todas as imagens", async () => {
    const [cover, photo, behind, before, after] = await Promise.all([image(), image(), image("Equipe montando a luz"), image("Fachada antiga"), image()]);
    const project = await create({ gallery: [photo.id], backstage: [behind.id], beforeAfter: [{ beforeMediaId: before.id, afterMediaId: after.id, caption: "Fachada" }] });

    // sem capa
    const noCover = await setPortfolioPublished(project.id, true);
    expect(noCover).toMatchObject({ ok: false, error: "blocked" });
    expect(!noCover.ok && noCover.error === "blocked" ? Object.keys(noCover.blockers).sort() : []).toEqual(["beforeAfter", "cover", "gallery"]);
    expect((await getPortfolioProject(project.id))?.published).toBe(false);

    // com capa, mas ainda sem texto alternativo na capa, na foto da galeria e no "depois"
    const saved = await savePortfolioProject(project.id, input({ title: project.title, slug: project.slug, coverMediaId: cover.id, gallery: [photo.id], backstage: [behind.id], beforeAfter: project.beforeAfter }));
    expect(saved.ok).toBe(true);
    expect(Object.keys(await findPublishBlockers((await getPortfolioProject(project.id))!)).sort()).toEqual(["beforeAfter", "cover", "gallery"]);

    await updateMediaAlt(cover.id, "Capa do projeto");
    await updateMediaAlt(photo.id, "Foto do produto");
    expect(Object.keys(await findPublishBlockers((await getPortfolioProject(project.id))!))).toEqual(["beforeAfter"]);
    await updateMediaAlt(after.id, "Fachada nova");

    const published = await setPortfolioPublished(project.id, true);
    expect(published.ok && published.row.published).toBe(true);
    // voltar para rascunho nunca é bloqueado
    const draft = await setPortfolioPublished(project.id, false);
    expect(draft.ok && draft.row.published).toBe(false);
    expect(await setPortfolioPublished(999_999, true)).toEqual({ ok: false, error: "not_found" });

    const featured = await setPortfolioFeatured(project.id, true);
    expect(featured?.featured).toBe(true);

    await deletePortfolioProject(project.id);
  });
});

describe("campos do briefing v2 e limpeza de imagens", () => {
  it("grava estudo de caso, vídeos, origem e relacionados (só projetos que existem, nunca ele mesmo)", async () => {
    const other = await create({ title: `[Teste] Outro ${stamp}` });
    const project = await create({
      objective: "Objetivo",
      challenge: "Desafio",
      solution: "Solução",
      results: "Resultados comprovados",
      extraVideoUrls: ["https://vimeo.com/1"],
      origin: "experiencia_anterior",
      originNote: "Trabalho de um fundador antes da NÓS.",
      relatedProjectIds: [other.id, 999_999, other.id],
    });
    expect(project).toMatchObject({ objective: "Objetivo", results: "Resultados comprovados", extraVideoUrls: ["https://vimeo.com/1"], origin: "experiencia_anterior", relatedProjectIds: [other.id] });

    // o próprio projeto não entra nos relacionados, e a observação some quando a origem volta a ser a NÓS
    const edited = await savePortfolioProject(project.id, input({ title: project.title, slug: project.slug, origin: "nos", originNote: "não deve ficar", relatedProjectIds: [project.id, other.id] }));
    expect(edited.ok && edited.row).toMatchObject({ origin: "nos", originNote: "", relatedProjectIds: [other.id] });
    // quem não informa os campos novos (ex.: outra tela) mantém o que estava gravado
    expect(edited.ok && edited.row.objective).toBe("Objetivo");
    expect((await listRelatedOptions(project.id)).map((option) => option.id)).toEqual([other.id]);

    // rascunho escolhido como relacionado não aparece no site: a lista pública só tem publicados
    const row = (await getPortfolioProject(project.id))!;
    expect(toPublicProject(row, new Map()).relatedProjectIds).toEqual([other.id]);

    await deletePortfolioProject(project.id);
    await deletePortfolioProject(other.id);
  });

  it("imagens de bastidores e de antes/depois são apagadas quando saem do projeto ou quando ele é excluído", async () => {
    const [cover, behindA, behindB, before, after] = await Promise.all([image("Capa"), image("Bastidor A"), image("Bastidor B"), image("Antes"), image("Depois")]);
    const project = await create({ coverMediaId: cover.id, backstage: [behindA.id, behindB.id], beforeAfter: [{ beforeMediaId: before.id, afterMediaId: after.id, caption: "" }] });
    const exists = async (id: number) => Boolean(await getMediaById(id));

    // tira um bastidor e o par de antes/depois
    await savePortfolioProject(project.id, input({ title: project.title, slug: project.slug, coverMediaId: cover.id, backstage: [behindB.id], beforeAfter: [] }));
    expect([await exists(behindA.id), await exists(before.id), await exists(after.id)]).toEqual([false, false, false]);
    expect([await exists(cover.id), await exists(behindB.id)]).toEqual([true, true]);

    // o formato público só carrega o que sobrou
    const images = new Map([...(await getMediaByIds([cover.id, behindB.id]))].flatMap(([id, media]) => {
      const image = toPublicImage(media);
      return image ? [[id, image] as const] : [];
    }));
    const publicProject = toPublicProject((await getPortfolioProject(project.id))!, images);
    expect(publicProject.backstage.map((item) => item.id)).toEqual([behindB.id]);
    expect(publicProject.beforeAfter).toEqual([]);

    await deletePortfolioProject(project.id);
    expect([await exists(cover.id), await exists(behindB.id)]).toEqual([false, false]);
    expect(await db.select().from(portfolioProjects).where(inArray(portfolioProjects.id, [project.id]))).toEqual([]);
    expect((await db.select().from(portfolioProjects).where(eq(portfolioProjects.id, project.id))).length).toBe(0);
  });
});
