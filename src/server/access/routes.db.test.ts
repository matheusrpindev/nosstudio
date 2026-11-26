/**
 * Rotas que entregam arquivos e dados — /media (arquivos privados), PDF de proposta, exportações e a API de
 * upload — chamadas de verdade (os Route Handlers) com sessões de cada perfil no banco de teste.
 * Regra: quem não tem acesso ao painel, ou não tem a permissão do módulo, nunca recebe o conteúdo.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Uploads destes testes vão para uma pasta temporária (nunca para data/uploads). Precisa valer ANTES dos imports.
const uploadDir = vi.hoisted(() => {
  const fs = process.getBuiltinModule("node:fs");
  const os = process.getBuiltinModule("node:os");
  const path = process.getBuiltinModule("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nos-access-test-"));
  process.env.UPLOAD_DIR = dir;
  return dir;
});

const browser = vi.hoisted(() => ({ token: null as string | null }));
const site = vi.hoisted(() => ({ published: [] as number[] }));
const pdf = vi.hoisted(() => ({
  load: vi.fn(async (_id: number) => ({ number: "2026-001", version: 1, clientName: "Cliente de Teste" })),
  render: vi.fn(async (_proposal: unknown) => Buffer.from("%PDF-1.7 conteudo-da-proposta")),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (browser.token && name.endsWith("nos_session") ? { name, value: browser.token } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: () => {}, updateTag: () => {}, refresh: () => {}, cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/server/site/queries", () => ({ getPublishedMediaIds: async () => site.published }));
vi.mock("@/server/proposals/source", () => ({ loadPublicProposal: pdf.load }));
vi.mock("@/server/proposals/pdf/render", () => ({ renderProposalPdf: pdf.render }));

import { rmSync } from "node:fs";
import sharp from "sharp";
import { GET as mediaGET } from "@/app/media/[...key]/route";
import { DELETE as mediaDELETE, PATCH as mediaPATCH } from "@/app/painel/api/media/[id]/route";
import { POST as mediaPOST } from "@/app/painel/api/media/route";
import { GET as clientDataGET } from "@/app/painel/clientes/[id]/dados/route";
import { GET as clientsCsvGET } from "@/app/painel/clientes/exportar/route";
import { GET as dataExportGET } from "@/app/painel/config/dados/exportar/route";
import { GET as financeCsvGET } from "@/app/painel/financeiro/exportar/route";
import { GET as proposalPdfGET } from "@/app/painel/orcamentos/[id]/pdf/route";
import { db } from "@/db";
import { brandAssets, clients, contracts, financeEntries, media } from "@/db/schema";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { createMedia } from "@/server/media";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";

const ORIGIN = "http://localhost:3000";
const accounts = {} as Record<UserRole, TestAccount>;
const mediaIds: number[] = [];
let clientId = 0;
let financeId = 0;
let contractId = 0;
let brandId = 0;
let receipt: Awaited<ReturnType<typeof createMedia>>;
let contractFile: Awaited<ReturnType<typeof createMedia>>;
let brandFile: Awaited<ReturnType<typeof createMedia>>;
let orphanByGestor: Awaited<ReturnType<typeof createMedia>>;
let draftImage: Awaited<ReturnType<typeof createMedia>>;
let liveImage: Awaited<ReturnType<typeof createMedia>>;

const pdfBuffer = (label: string) => Buffer.from(`%PDF-1.7\n1 0 obj\n<<>>\nendobj\n% ${label}\n%%EOF`);
const jpeg = (shade: number) => sharp({ create: { width: 640, height: 400, channels: 3, background: { r: 59, g: shade, b: 142 } } }).jpeg().toBuffer();

beforeAll(async () => {
  for (const role of USER_ROLES) accounts[role] = await makeAccount(role);
  const [client] = await db.insert(clients).values({ name: "[Teste] Cliente das rotas", notes: "NOTA-INTERNA-SECRETA" }).returning({ id: clients.id });
  clientId = client.id;

  receipt = await createMedia({ buffer: pdfBuffer("comprovante"), originalName: "comprovante.pdf", visibility: "private", userId: accounts.admin.id });
  contractFile = await createMedia({ buffer: pdfBuffer("contrato"), originalName: "contrato assinado.pdf", visibility: "private", userId: accounts.admin.id });
  brandFile = await createMedia({ buffer: pdfBuffer("manual"), originalName: "manual da marca.pdf", visibility: "private", userId: accounts.admin.id });
  orphanByGestor = await createMedia({ buffer: pdfBuffer("avulso"), originalName: "avulso.pdf", visibility: "private", userId: accounts.gestor.id });
  draftImage = await createMedia({ buffer: await jpeg(40), originalName: "rascunho.jpg", visibility: "public", userId: accounts.admin.id });
  liveImage = await createMedia({ buffer: await jpeg(90), originalName: "no-ar.jpg", visibility: "public", userId: accounts.admin.id });
  mediaIds.push(receipt.id, contractFile.id, brandFile.id, orphanByGestor.id, draftImage.id, liveImage.id);

  const [entry] = await db
    .insert(financeEntries)
    .values({ type: "despesa", category: "freelancer", description: "[Teste] pagamento", amountCents: 50_000, dueDate: "2026-12-01", receiptMediaId: receipt.id, clientId })
    .returning({ id: financeEntries.id });
  financeId = entry.id;
  const [contract] = await db.insert(contracts).values({ title: "[Teste] contrato", fileMediaId: contractFile.id, clientId }).returning({ id: contracts.id });
  contractId = contract.id;
  const [brand] = await db.insert(brandAssets).values({ title: "[Teste] manual", mediaId: brandFile.id }).returning({ id: brandAssets.id });
  brandId = brand.id;
});

beforeEach(() => {
  browser.token = null;
  site.published = [liveImage.id];
  pdf.load.mockClear();
  pdf.render.mockClear();
});

afterAll(async () => {
  await db.delete(financeEntries).where(eq(financeEntries.id, financeId));
  await db.delete(contracts).where(eq(contracts.id, contractId));
  await db.delete(brandAssets).where(eq(brandAssets.id, brandId));
  await db.delete(clients).where(eq(clients.id, clientId));
  await db.delete(media).where(inArray(media.id, mediaIds));
  await removeAccounts();
  rmSync(uploadDir, { recursive: true, force: true });
});

/** Status da resposta para cada perfil (e para quem não tem sessão). */
async function statusByRole(run: () => Promise<Response>): Promise<Record<UserRole | "anonimo", number>> {
  const result = {} as Record<UserRole | "anonimo", number>;
  browser.token = null;
  result.anonimo = (await run()).status;
  for (const role of USER_ROLES) {
    browser.token = accounts[role].token;
    result[role] = (await run()).status;
  }
  browser.token = null;
  return result;
}

const getMedia = (row: { storageKey: string }) => mediaGET(new Request(`${ORIGIN}/media/${row.storageKey}`), { params: Promise.resolve({ key: row.storageKey.split("/") }) });

describe("/media: arquivos privados só para quem tem o módulo dono do arquivo", () => {
  it("comprovante (financeiro): admin, sócio e técnico; gestor, funcionário, freelancer e cliente recebem 404", async () => {
    expect(await statusByRole(() => getMedia(receipt))).toEqual({
      anonimo: 404,
      admin: 200,
      socio: 200,
      tecnico: 200,
      gestor: 404,
      funcionario: 404,
      freelancer: 404,
      cliente: 404,
    });
  });

  it("contrato assinado (contratos) e material da marca: o gestor passa; funcionário e externos não", async () => {
    const expected = { anonimo: 404, admin: 200, socio: 200, tecnico: 200, gestor: 200, funcionario: 404, freelancer: 404, cliente: 404 };
    expect(await statusByRole(() => getMedia(contractFile))).toEqual(expected);
    expect(await statusByRole(() => getMedia(brandFile))).toEqual(expected);
  });

  it("arquivo privado ainda sem dono: quem enviou e quem vê Arquivos por inteiro; freelancer e cliente nunca", async () => {
    expect(await statusByRole(() => getMedia(orphanByGestor))).toEqual({
      anonimo: 404,
      admin: 200,
      socio: 200,
      tecnico: 200,
      gestor: 200,
      funcionario: 404,
      freelancer: 404,
      cliente: 404,
    });
  });

  it("ter ENVIADO o arquivo não fura o perfil: um freelancer não abre nem o próprio upload por esta rota", async () => {
    const own = await createMedia({ buffer: pdfBuffer("do freelancer"), originalName: "meu.pdf", visibility: "private", userId: accounts.freelancer.id });
    mediaIds.push(own.id);
    browser.token = accounts.freelancer.token;
    expect((await getMedia(own)).status).toBe(404);
    browser.token = accounts.cliente.token;
    expect((await getMedia(own)).status).toBe(404);
  });

  it("imagem pública FORA do ar (rascunho): só quem cuida do site; publicada: qualquer visitante", async () => {
    expect(await statusByRole(() => getMedia(draftImage))).toEqual({
      anonimo: 404,
      admin: 200,
      socio: 200,
      tecnico: 200,
      gestor: 404,
      funcionario: 404,
      freelancer: 404,
      cliente: 404,
    });
    expect(Object.values(await statusByRole(() => getMedia(liveImage))).every((status) => status === 200)).toBe(true);
  });

  it("negação individual vale aqui também: técnico sem 'baixar' no financeiro não abre o comprovante", async () => {
    const limited = await makeAccount("tecnico", { permissions: { grant: [], deny: ["financeiro:baixar"] } });
    browser.token = limited.token;
    expect((await getMedia(receipt)).status).toBe(404);
    expect((await getMedia(contractFile)).status).toBe(200);
  });

  it("troca de senha pendente e conta desativada: 404 em arquivo privado", async () => {
    const pending = await makeAccount("admin", { mustChangePassword: true });
    browser.token = pending.token;
    expect((await getMedia(receipt)).status).toBe(404);
    const off = await makeAccount("admin", { active: false });
    browser.token = off.token;
    expect((await getMedia(receipt)).status).toBe(404);
  });

  it("a resposta negada não carrega o arquivo nem o nome dele", async () => {
    browser.token = accounts.cliente.token;
    const response = await getMedia(receipt);
    const body = await response.text();
    expect(body).not.toContain("%PDF");
    expect(body).not.toContain("comprovante");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("PDF da proposta", () => {
  const getPdf = (query = "") => proposalPdfGET(new Request(`${ORIGIN}/painel/orcamentos/1/pdf${query}`), { params: Promise.resolve({ id: "1" }) });

  it("pré-visualização e download: só perfis com Propostas; os demais recebem 401/403 e o PDF nem é gerado", async () => {
    const expected = { anonimo: 401, admin: 200, socio: 200, tecnico: 200, gestor: 200, funcionario: 403, freelancer: 403, cliente: 403 };
    expect(await statusByRole(() => getPdf())).toEqual(expected);
    expect(await statusByRole(() => getPdf("?baixar=1"))).toEqual(expected);
  });

  it("perfil sem acesso: a proposta não é lida do banco e o PDF não é renderizado", async () => {
    for (const role of ["funcionario", "freelancer", "cliente"] as const) {
      browser.token = accounts[role].token;
      const response = await getPdf("?baixar=1");
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(await response.text()).not.toContain("%PDF");
    }
    browser.token = null;
    await getPdf();
    expect(pdf.load).not.toHaveBeenCalled();
    expect(pdf.render).not.toHaveBeenCalled();
    browser.token = accounts.gestor.token;
    const ok = await getPdf("?baixar=1");
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.render).toHaveBeenCalledTimes(1);
  });

  it("ver sem baixar: negar 'baixar' bloqueia só o download", async () => {
    const viewer = await makeAccount("gestor", { permissions: { grant: [], deny: ["propostas:baixar"] } });
    browser.token = viewer.token;
    expect((await getPdf()).status).toBe(200);
    expect((await getPdf("?baixar=1")).status).toBe(403);
  });
});

describe("exportações de dados", () => {
  const routes: [string, () => Promise<Response>][] = [
    ["JSON completo", () => dataExportGET(new Request(`${ORIGIN}/painel/config/dados/exportar`))],
    ["CSV de clientes (config)", () => dataExportGET(new Request(`${ORIGIN}/painel/config/dados/exportar?csv=clientes`))],
    ["CSV de clientes (lista)", () => clientsCsvGET(new Request(`${ORIGIN}/painel/clientes/exportar`))],
    ["CSV do financeiro", () => financeCsvGET(new Request(`${ORIGIN}/painel/financeiro/exportar`))],
    ["dados do titular (LGPD)", () => clientDataGET(new Request(`${ORIGIN}/painel/clientes/${clientId}/dados`), { params: Promise.resolve({ id: String(clientId) }) })],
  ];

  for (const [label, run] of routes) {
    it(`${label}: só admin e sócio; técnico, gestor, funcionário, freelancer e cliente recebem 403`, async () => {
      expect(await statusByRole(run)).toEqual({ anonimo: 401, admin: 200, socio: 200, tecnico: 403, gestor: 403, funcionario: 403, freelancer: 403, cliente: 403 });
    });
  }

  it("a resposta negada não traz nenhum dado", async () => {
    for (const role of ["tecnico", "gestor", "freelancer", "cliente"] as const) {
      browser.token = accounts[role].token;
      for (const [, run] of routes) {
        const body = await (await run()).text();
        expect(body).not.toContain("[Teste] Cliente das rotas");
        expect(body).not.toContain("NOTA-INTERNA-SECRETA");
        expect(JSON.parse(body)).toHaveProperty("error");
      }
    }
  });

  it("exportar exige também VER o módulo: gestor com 'dados:baixar' concedido exporta clientes, mas não o financeiro", async () => {
    const exporter = await makeAccount("gestor", { permissions: { grant: ["dados:baixar"], deny: [] } });
    browser.token = exporter.token;
    expect((await clientsCsvGET(new Request(`${ORIGIN}/painel/clientes/exportar`))).status).toBe(200);
    expect((await financeCsvGET(new Request(`${ORIGIN}/painel/financeiro/exportar`))).status).toBe(403);
  });

  it("troca de senha pendente: 403 mesmo para administrador", async () => {
    const pending = await makeAccount("admin", { mustChangePassword: true });
    browser.token = pending.token;
    for (const [, run] of routes) expect((await run()).status).toBe(403);
  });
});

describe("API de arquivos do painel (upload, texto alternativo, exclusão)", () => {
  const upload = (headers: Record<string, string> = { origin: ORIGIN, host: "localhost:3000" }) => {
    const form = new FormData();
    form.set("file", new File([pdfBuffer("upload")], "enviado.pdf", { type: "application/pdf" }));
    form.set("visibility", "private");
    return mediaPOST(new Request(`${ORIGIN}/painel/api/media`, { method: "POST", body: form, headers }));
  };

  it("enviar: perfis com Arquivos por inteiro; funcionário (só por projeto), freelancer e cliente recebem 403", async () => {
    const before = (await db.select({ id: media.id }).from(media)).length;
    const result = await statusByRole(async () => {
      const response = await upload();
      if (response.status === 201) mediaIds.push((await response.json()).media.id);
      return response;
    });
    expect(result).toEqual({ anonimo: 401, admin: 201, socio: 201, tecnico: 201, gestor: 201, funcionario: 403, freelancer: 403, cliente: 403 });
    expect((await db.select({ id: media.id }).from(media)).length).toBe(before + 4); // os negados não gravaram nada
  });

  it("outra origem (CSRF): 403 mesmo para administrador", async () => {
    browser.token = accounts.admin.token;
    expect((await upload({ origin: "https://site-malicioso.example", host: "localhost:3000" })).status).toBe(403);
    expect((await upload({ host: "localhost:3000" })).status).toBe(403);
  });

  it("alterar texto alternativo e apagar: mesmas barreiras", async () => {
    const context = { params: Promise.resolve({ id: String(orphanByGestor.id) }) };
    const headers = { origin: ORIGIN, host: "localhost:3000", "content-type": "application/json" };
    const patch = () => mediaPATCH(new Request(`${ORIGIN}/painel/api/media/${orphanByGestor.id}`, { method: "PATCH", headers, body: JSON.stringify({ alt: "texto" }) }), context);
    const expected = { anonimo: 401, admin: 200, socio: 200, tecnico: 200, gestor: 200, funcionario: 403, freelancer: 403, cliente: 403 };
    expect(await statusByRole(patch)).toEqual(expected);
    // apagar um arquivo EM USO é recusado (409) para quem pode; quem não pode nem chega lá (403)
    const inUse = { params: Promise.resolve({ id: String(receipt.id) }) };
    const remove = () => mediaDELETE(new Request(`${ORIGIN}/painel/api/media/${receipt.id}`, { method: "DELETE", headers }), inUse);
    expect(await statusByRole(remove)).toEqual({ anonimo: 401, admin: 409, socio: 409, tecnico: 409, gestor: 409, funcionario: 403, freelancer: 403, cliente: 403 });
    expect(await db.select({ id: media.id }).from(media).where(eq(media.id, receipt.id))).toHaveLength(1);
  });
});
