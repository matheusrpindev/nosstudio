import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

// Uploads destes testes vão para a pasta temporária DESTA execução (UPLOAD_DIR de vitest.config.mts — nunca
// data/uploads); quem a apaga no fim é src/test/global-setup.ts.
const uploadDir = process.env.UPLOAD_DIR as string;

import { existsSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { media, siteContent } from "@/db/schema";
import { createFinanceEntry, deleteFinanceEntry, updateFinanceEntry, type EntryInput } from "@/server/finance/admin";
import { deletePortfolioProject, savePortfolioProject, type PortfolioInput } from "@/server/site/admin/portfolio";
import { deleteService, saveService, type ServiceInput } from "@/server/site/admin/services";
import { deleteTestimonial, saveTestimonial, type TestimonialInput } from "@/server/site/admin/testimonials";
import { saveSiteContent } from "@/server/site/content";
import { defaultSiteContent } from "@/lib/site/content";
import { collectMediaIds, createMedia, droppedMediaIds, getMediaById, releaseMedia } from "./index";

afterAll(async () => {
  await db.delete(siteContent).where(eq(siteContent.key, "seo"));
});

let counter = 0;
async function image() {
  const buffer = await sharp({ create: { width: 1400, height: 900, channels: 3, background: { r: 59, g: 31 + (counter++ % 200), b: 142 } } })
    .jpeg()
    .toBuffer();
  return createMedia({ buffer, originalName: "foto do cliente.jpg", visibility: "public" });
}
const receipt = () => createMedia({ buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"), originalName: "comprovante.pdf", visibility: "private" });

const files = (row: { storageKey: string; variants: { key: string }[] | null }) => [row.storageKey, ...(row.variants ?? []).map((variant) => variant.key)];
const onDisk = (row: Parameters<typeof files>[0]) => files(row).filter((key) => existsSync(path.join(uploadDir, key)));
const exists = async (id: number) => Boolean(await getMediaById(id));

const testimonial = (over: Partial<TestimonialInput>): TestimonialInput => ({
  kind: "print",
  authorName: "[Teste] Cliente",
  authorRole: "",
  content: "Texto",
  mediaId: null,
  mediaAlt: "",
  videoUrl: null,
  authorized: true,
  published: true,
  ...over,
});
const project = (over: Partial<PortfolioInput>): PortfolioInput => ({
  title: `[Teste] Projeto ${Date.now()}-${counter++}`,
  slug: "",
  category: "casamentos",
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
  published: true,
  ...over,
});
const service = (over: Partial<ServiceInput>): ServiceInput => ({
  title: `[Teste] Serviço ${Date.now()}-${counter++}`,
  slug: "",
  summary: "",
  description: "",
  items: [],
  ctaLabel: "",
  interest: "outro",
  coverMediaId: null,
  gallery: [],
  videoUrl: null,
  pagePath: null,
  benefits: [],
  faq: [],
  relatedProjectIds: [],
  visible: true,
  ...over,
});
const entry = (over: Partial<EntryInput>): EntryInput => ({
  type: "despesa",
  category: "outras_despesas",
  description: "[Teste] lançamento",
  amountCents: 1000,
  dueDate: "2026-11-18",
  paidAt: null,
  installmentLabel: "",
  method: null,
  supplier: "",
  clientId: null,
  projectId: null,
  proposalId: null,
  receiptMediaId: null,
  receiptUrl: "",
  notes: "",
  ...over,
});

describe("helpers puros", () => {
  it("collectMediaIds acha ids em qualquer profundidade, só em chaves *mediaId", () => {
    const value = { hero: { mediaId: 3, title: "x" }, coupleMediaId: 4, founders: [{ mediaId: 5 }, { mediaId: null }], total: 9, shareImageMediaId: "7" };
    expect(collectMediaIds(value).sort()).toEqual([3, 4, 5]);
    expect(collectMediaIds(null)).toEqual([]);
  });
  it("droppedMediaIds = o que o formulário deixou de usar", () => {
    expect(droppedMediaIds([1, 2, 3, null], [2, 4])).toEqual([1, 3]);
    expect(droppedMediaIds([1, 1], [1])).toEqual([]);
    expect(droppedMediaIds([null], [null])).toEqual([]);
  });
});

describe("arquivos são apagados junto com o conteúdo que os usava", () => {
  it("excluir um depoimento apaga a foto (linha, arquivo principal e versões)", async () => {
    const photo = await image();
    expect(onDisk(photo).length).toBe(files(photo).length);
    expect(files(photo).length).toBeGreaterThan(1);
    const row = await saveTestimonial(null, testimonial({ mediaId: photo.id }));
    expect(await deleteTestimonial(row!.id)).toBe(true);
    expect(await exists(photo.id)).toBe(false);
    expect(onDisk(photo)).toEqual([]);
  });

  it("trocar ou remover a foto de um depoimento apaga a antiga e mantém a nova", async () => {
    const [first, second] = [await image(), await image()];
    const row = await saveTestimonial(null, testimonial({ mediaId: first.id }));
    await saveTestimonial(row!.id, testimonial({ mediaId: second.id }));
    expect(await exists(first.id)).toBe(false);
    expect(onDisk(first)).toEqual([]);
    expect(await exists(second.id)).toBe(true);
    // salvar de novo sem mudar a foto não apaga nada
    await saveTestimonial(row!.id, testimonial({ mediaId: second.id, content: "Outro texto" }));
    expect(await exists(second.id)).toBe(true);
    await saveTestimonial(row!.id, testimonial({ mediaId: null }));
    expect(await exists(second.id)).toBe(false);
    await deleteTestimonial(row!.id);
  });

  it("portfólio: tirar da galeria e excluir o projeto apagam as fotos; imagem usada em outro lugar fica", async () => {
    const [cover, a, b, shared] = [await image(), await image(), await image(), await image()];
    const svc = await saveService(null, service({ coverMediaId: shared.id }));
    const saved = await savePortfolioProject(null, project({ coverMediaId: cover.id, gallery: [a.id, b.id, shared.id] }));
    if (!saved.ok || !svc.ok) throw new Error("falhou");

    await savePortfolioProject(saved.row.id, project({ title: saved.row.title, slug: saved.row.slug, coverMediaId: cover.id, gallery: [b.id, shared.id] }));
    expect(await exists(a.id)).toBe(false);
    expect(onDisk(a)).toEqual([]);
    expect(await exists(b.id)).toBe(true);

    await deletePortfolioProject(saved.row.id);
    expect(await exists(cover.id)).toBe(false);
    expect(await exists(b.id)).toBe(false);
    expect(onDisk(cover)).toEqual([]);
    // a imagem compartilhada continua: o serviço ainda a usa
    expect(await exists(shared.id)).toBe(true);
    expect(onDisk(shared).length).toBe(files(shared).length);

    await deleteService(svc.row.id);
    expect(await exists(shared.id)).toBe(false);
    expect(onDisk(shared)).toEqual([]);
  });

  it("serviço: trocar a capa apaga a antiga", async () => {
    const [first, second] = [await image(), await image()];
    const saved = await saveService(null, service({ coverMediaId: first.id, gallery: [first.id] }));
    if (!saved.ok) throw new Error("falhou");
    // a capa antiga continua na galeria: não pode ser apagada
    await saveService(saved.row.id, service({ title: saved.row.title, slug: saved.row.slug, coverMediaId: second.id, gallery: [first.id] }));
    expect(await exists(first.id)).toBe(true);
    await saveService(saved.row.id, service({ title: saved.row.title, slug: saved.row.slug, coverMediaId: second.id, gallery: [] }));
    expect(await exists(first.id)).toBe(false);
    await deleteService(saved.row.id);
    expect(await exists(second.id)).toBe(false);
  });

  it("conteúdo do site: trocar a imagem de uma seção apaga a anterior", async () => {
    const [first, second] = [await image(), await image()];
    await saveSiteContent("seo", { ...defaultSiteContent.seo, shareImageMediaId: first.id });
    await saveSiteContent("seo", { ...defaultSiteContent.seo, shareImageMediaId: second.id });
    expect(await exists(first.id)).toBe(false);
    expect(onDisk(first)).toEqual([]);
    expect(await exists(second.id)).toBe(true);
    await saveSiteContent("seo", { ...defaultSiteContent.seo, shareImageMediaId: null });
    expect(await exists(second.id)).toBe(false);
  });

  it("financeiro: trocar o comprovante e excluir o lançamento apagam o arquivo privado", async () => {
    const [first, second] = [await receipt(), await receipt()];
    const created = await createFinanceEntry(entry({ receiptMediaId: first.id }), null as unknown as number);
    await updateFinanceEntry(created.id, entry({ receiptMediaId: second.id }));
    expect(await exists(first.id)).toBe(false);
    expect(onDisk(first)).toEqual([]);
    expect(await exists(second.id)).toBe(true);
    await deleteFinanceEntry(created.id);
    expect(await exists(second.id)).toBe(false);
    expect(onDisk(second)).toEqual([]);
  });

  it("releaseMedia ignora nulos/repetidos e nunca apaga arquivo em uso", async () => {
    const photo = await image();
    const row = await saveTestimonial(null, testimonial({ mediaId: photo.id }));
    expect(await releaseMedia([photo.id, photo.id, null, undefined, 0, 999_999])).toEqual([]);
    expect(await exists(photo.id)).toBe(true);
    await deleteTestimonial(row!.id);
    expect(await db.select().from(media).where(eq(media.id, photo.id))).toHaveLength(0);
  });
});
