import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

// Uploads destes testes vão para a pasta temporária DESTA execução (UPLOAD_DIR de vitest.config.mts — nunca
// data/uploads); quem a apaga no fim é src/test/global-setup.ts.
const uploadDir = process.env.UPLOAD_DIR as string;

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { banners, media, portfolioProjects, siteContent } from "@/db/schema";
import { createFinanceEntry, deleteFinanceEntry, updateFinanceEntry, type EntryInput } from "@/server/finance/admin";
import { deletePortfolioProject, savePortfolioProject, type PortfolioInput } from "@/server/site/admin/portfolio";
import { deleteService, saveService, type ServiceInput } from "@/server/site/admin/services";
import { deleteTestimonial, saveTestimonial, type TestimonialInput } from "@/server/site/admin/testimonials";
import { saveSiteContent } from "@/server/site/content";
import { saveFooterExperience } from "@/server/site/footer-experience";
import { FOOTER_EXPERIENCE_KEY } from "@/lib/site/footer-experience";
import { defaultSiteContent } from "@/lib/site/content";
import { collectMediaIds, createMedia, droppedMediaIds, findMediaUsage, getMediaById, MediaError, releaseMedia } from "./index";
import { mp4Bytes, webmBytes } from "./video-fixtures";

afterAll(async () => {
  await db.delete(siteContent).where(eq(siteContent.key, "seo"));
  await db.delete(siteContent).where(eq(siteContent.key, FOOTER_EXPERIENCE_KEY));
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

describe("vídeo curto público (banners)", () => {
  it("guarda o arquivo como chegou, com nome aleatório e o tipo conferido pelos bytes", async () => {
    const bytes = mp4Bytes();
    // o nome e a extensão informados não importam: quem decide é o conteúdo
    const row = await createMedia({ buffer: bytes, originalName: "../../meu vídeo.MOV", visibility: "public", kind: "video" });
    expect(row).toMatchObject({ visibility: "public", mime: "video/mp4", size: bytes.length, originalName: "meu vídeo.MOV", width: null, height: null });
    expect(row.storageKey).toMatch(/^pub\/\d{4}\/\d{2}\/[a-f0-9]{24}\.mp4$/);
    expect(row.variants ?? []).toEqual([]);
    expect(onDisk(row)).toEqual([row.storageKey]);
    expect(readFileSync(path.join(uploadDir, row.storageKey)).equals(bytes)).toBe(true);

    const webm = await createMedia({ buffer: webmBytes(), originalName: "fundo.webm", visibility: "public", kind: "video" });
    expect(webm.mime).toBe("video/webm");
    expect(webm.storageKey.endsWith(".webm")).toBe(true);
    await releaseMedia([row.id, webm.id]);
    expect(onDisk(row)).toEqual([]);
  });

  it("recusa arquivo falso e não deixa nada no disco nem no banco", async () => {
    const before = (await db.select({ id: media.id }).from(media)).length;
    for (const fake of [Buffer.from("<script>alert(1)</script>"), Buffer.from("%PDF-1.7\n%%EOF"), mp4Bytes({ brand: "qt  " }), mp4Bytes().subarray(0, 24)]) {
      await expect(createMedia({ buffer: fake, originalName: "video.mp4", visibility: "public", kind: "video" })).rejects.toThrow(MediaError);
    }
    expect((await db.select({ id: media.id }).from(media)).length).toBe(before);
  });

  it("sem pedir `kind: video`, arquivo público continua sendo só imagem (um vídeo é recusado)", async () => {
    await expect(createMedia({ buffer: mp4Bytes(), originalName: "video.mp4", visibility: "public" })).rejects.toThrow(MediaError);
    // e pedir vídeo com uma imagem também não passa
    const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#3B1F8E" } }).jpeg().toBuffer();
    await expect(createMedia({ buffer: jpeg, originalName: "foto.jpg", visibility: "public", kind: "video" })).rejects.toThrow(MediaError);
  });
});

describe("findMediaUsage enxerga todas as colunas de mídia", () => {
  it("banner: imagem de computador, de celular e vídeo contam como uso; apagar o banner libera", async () => {
    const [desktop, mobile, video, loose] = [await image(), await image(), await createMedia({ buffer: mp4Bytes(), originalName: "fundo.mp4", visibility: "public", kind: "video" }), await image()];
    const [banner] = await db
      .insert(banners)
      .values({ name: "[Teste] Banner com mídia", layout: "midia", desktopMediaId: desktop.id, mobileMediaId: mobile.id, videoMediaId: video.id })
      .returning();
    for (const row of [desktop, mobile, video]) expect(await findMediaUsage(row.id)).toEqual(['banner "[Teste] Banner com mídia"']);
    expect(await findMediaUsage(loose.id)).toEqual([]);

    // em uso: `releaseMedia` não apaga nada
    expect(await releaseMedia([desktop.id, mobile.id, video.id])).toEqual([]);
    expect(await exists(video.id)).toBe(true);

    // dois banners com a mesma arte (duplicado): apagar um não tira a imagem do outro
    const [copy] = await db.insert(banners).values({ name: "[Teste] Banner com mídia (cópia)", layout: "midia", desktopMediaId: desktop.id }).returning();
    await db.delete(banners).where(eq(banners.id, banner.id));
    expect((await releaseMedia([desktop.id, mobile.id, video.id])).sort()).toEqual([mobile.id, video.id].sort());
    expect(await exists(desktop.id)).toBe(true);
    await db.delete(banners).where(eq(banners.id, copy.id));
    expect(await releaseMedia([desktop.id, loose.id])).toEqual([desktop.id, loose.id]);
    expect(onDisk(desktop)).toEqual([]);
  });

  it("portfólio: bastidores e pares antes/depois contam como uso (não só capa e galeria)", async () => {
    const [backstage, before, after, unused] = [await image(), await image(), await image(), await image()];
    const [created] = await db
      .insert(portfolioProjects)
      .values({
        title: "[Teste] Projeto com bastidores",
        slug: `teste-bastidores-${Date.now()}`,
        category: "casamentos",
        backstage: [backstage.id],
        beforeAfter: [{ beforeMediaId: before.id, afterMediaId: after.id, caption: "" }],
      })
      .returning({ id: portfolioProjects.id });
    for (const row of [backstage, before, after]) expect(await findMediaUsage(row.id), String(row.id)).toEqual(['projeto "[Teste] Projeto com bastidores"']);
    expect(await findMediaUsage(unused.id)).toEqual([]);

    // imagem usada só em bastidores ou em antes/depois NÃO é apagada por um `releaseMedia` de outro registro
    expect(await releaseMedia([backstage.id, before.id, after.id, unused.id])).toEqual([unused.id]);
    for (const row of [backstage, before, after]) expect(await exists(row.id)).toBe(true);

    await db.delete(portfolioProjects).where(eq(portfolioProjects.id, created.id));
    expect((await releaseMedia([backstage.id, before.id, after.id])).sort()).toEqual([backstage.id, before.id, after.id].sort());
  });

  it("rodapé interativo: fotos da câmera e trechos do celular contam como uso; tirar do rodapé libera", async () => {
    const [photo, clip] = [await image(), await createMedia({ buffer: webmBytes(), originalName: "trecho.webm", visibility: "public", kind: "video" })];
    await saveFooterExperience({ enabled: false, photos: [{ mediaId: photo.id }], clips: [{ mediaId: clip.id, caption: "[Teste] trecho" }] });
    // mesmo com o rodapé desligado, o arquivo está guardado lá: não pode ser tratado como "sem uso"
    for (const row of [photo, clip]) expect(await findMediaUsage(row.id)).toEqual(["rodapé interativo do site"]);
    expect(await releaseMedia([photo.id, clip.id])).toEqual([]);

    await saveFooterExperience({ enabled: true, photos: [], clips: [] });
    expect((await releaseMedia([photo.id, clip.id])).sort()).toEqual([photo.id, clip.id].sort());
    expect(onDisk(photo)).toEqual([]);
  });
});
