/**
 * Avanço automático do cliente no funil, de ponta a ponta no banco de teste: as Server Actions de orçamentos e de
 * projetos (com a sessão, o toast e a navegação simulados) e as mutações que elas chamam.
 */
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: 0, name: "[Teste] Funil", email: "", role: "admin" as const },
  flashToast: vi.fn(async (_message: string, _tone?: string) => {}),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ requireUser: async () => mocks.user, requirePermission: async () => mocks.user }));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/ui/flash", () => ({ flashToast: mocks.flashToast }));

import { db } from "@/db";
import { auditLog, clientInteractions, clients, projects, proposalItems, proposals, users } from "@/db/schema";
import { initialActionState } from "@/lib/action-state";
import type { ClientStatus } from "@/lib/domain";
import { createProject, type ProjectInput } from "@/server/projects/admin";
import { setProposalStatus } from "@/server/proposals/admin";
import { createProjectAction } from "../projetos/actions";
import { convertToProjectAction, setProposalStatusAction } from "./actions";

const clientIds: number[] = [];
const proposalIds: number[] = [];
const projectIds: number[] = [];
let seq = 0;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ name: mocks.user.name, email: `teste-funil-${Date.now()}@nos.test`, passwordHash: "x" })
    .returning();
  mocks.user.id = user.id;
  mocks.user.email = user.email;
});

beforeEach(() => {
  mocks.flashToast.mockClear();
  mocks.redirect.mockClear();
});

afterAll(async () => {
  if (projectIds.length) await db.delete(projects).where(inArray(projects.id, projectIds));
  if (proposalIds.length) await db.delete(proposals).where(inArray(proposals.id, proposalIds));
  if (clientIds.length) await db.delete(clients).where(inArray(clients.id, clientIds));
  await db.delete(auditLog).where(eq(auditLog.userId, mocks.user.id));
  await db.delete(users).where(eq(users.id, mocks.user.id));
});

async function makeClient(status: ClientStatus) {
  const [client] = await db.insert(clients).values({ name: "[Teste] Cliente do funil", status }).returning();
  clientIds.push(client.id);
  return client;
}

async function makeProposal(clientId: number | null, status: "rascunho" | "enviada" | "aceita" = "rascunho", version = 1) {
  const number = `T-FUNIL-${Date.now()}-${++seq}`;
  const [proposal] = await db.insert(proposals).values({ number, version, title: "Cobertura de teste", clientId, status, createdBy: mocks.user.id }).returning();
  proposalIds.push(proposal.id);
  await db.insert(proposalItems).values({ proposalId: proposal.id, title: "Diária", quantity: 1, unitPriceCents: 150_000, sortOrder: 1 });
  return proposal;
}

const statusOf = async (clientId: number) => (await db.select({ status: clients.status }).from(clients).where(eq(clients.id, clientId)))[0].status;
const historyOf = (clientId: number) =>
  db.select({ kind: clientInteractions.kind, content: clientInteractions.content, userId: clientInteractions.userId }).from(clientInteractions).where(eq(clientInteractions.clientId, clientId)).orderBy(asc(clientInteractions.id));
const statusLines = async (clientId: number) => (await historyOf(clientId)).filter((row) => row.kind === "status").map((row) => row.content);

function form(values: Record<string, string | number>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

const projectForm = (values: Record<string, string | number>) =>
  form({ title: "[Teste] Projeto do funil", serviceType: "eventos", stage: "briefing", backupStatus: "pendente", links: "[]", ...values });

describe("proposta enviada / aceita → cliente anda no funil", () => {
  it("enviada: Novo contato → Em orçamento, com linha no histórico, auditoria e aviso na resposta da action", async () => {
    const client = await makeClient("novo_contato");
    const proposal = await makeProposal(client.id);

    const state = await setProposalStatusAction(initialActionState, form({ id: proposal.id, status: "enviada" }));

    expect(state.ok).toBe(true);
    expect(state.message).toBe("Marcada como enviada. O cliente foi movido para “Em orçamento” no funil.");
    expect(await statusOf(client.id)).toBe("em_orcamento");
    const history = await historyOf(client.id);
    expect(history.map((row) => row.kind)).toEqual(["nota", "status"]);
    expect(history[1].content).toBe(`Status alterado automaticamente para Em orçamento (proposta ${proposal.number} enviada). Antes: Novo contato.`);
    expect(history[1].userId).toBe(mocks.user.id);
    const audit = await db.select({ summary: auditLog.summary }).from(auditLog).where(eq(auditLog.entityId, String(client.id)));
    expect(audit.some((row) => row.summary?.includes("Novo contato → Em orçamento (automático"))).toBe(true);
  });

  it("aceita: Negociação → Fechado (cita a versão quando não é a primeira)", async () => {
    const client = await makeClient("negociacao");
    const proposal = await makeProposal(client.id, "enviada", 2);

    const state = await setProposalStatusAction(initialActionState, form({ id: proposal.id, status: "aceita" }));

    expect(state.message).toBe("Status: Aceita. O cliente foi movido para “Fechado” no funil.");
    expect(await statusOf(client.id)).toBe("fechado");
    expect(await statusLines(client.id)).toEqual([`Status alterado automaticamente para Fechado (proposta ${proposal.number} v2 aceita). Antes: Negociação.`]);
  });

  it("não retrocede: cliente já em produção continua onde está ao enviar e aceitar outra proposta", async () => {
    const client = await makeClient("em_producao");
    const proposal = await makeProposal(client.id);

    const sent = await setProposalStatusAction(initialActionState, form({ id: proposal.id, status: "enviada" }));
    const accepted = await setProposalStatusAction(initialActionState, form({ id: proposal.id, status: "aceita" }));

    expect(sent.message).toBe("Marcada como enviada. O envio ficou registrado no histórico do cliente.");
    expect(accepted.message).toBe("Status: Aceita.");
    expect(await statusOf(client.id)).toBe("em_producao");
    expect(await statusLines(client.id)).toEqual([]);
  });

  it("voltar para rascunho, recusar e expirar não mexem no cliente", async () => {
    const client = await makeClient("novo_contato");
    const proposal = await makeProposal(client.id);
    await setProposalStatusAction(initialActionState, form({ id: proposal.id, status: "enviada" }));
    expect(await statusOf(client.id)).toBe("em_orcamento");

    for (const status of ["rascunho", "enviada", "recusada", "expirada", "rascunho"] as const) {
      const state = await setProposalStatusAction(initialActionState, form({ id: proposal.id, status }));
      expect(state.ok).toBe(true);
      expect(state.message).not.toContain("funil");
      expect(await statusOf(client.id)).toBe("em_orcamento");
    }
    expect(await statusLines(client.id)).toHaveLength(1);
  });

  it.each(["perdido", "cancelado"] as const)("cliente %s (fora do funil ativo) não é tocado", async (status) => {
    const client = await makeClient(status);
    const proposal = await makeProposal(client.id);

    const sent = await setProposalStatus(proposal.id, "enviada", mocks.user.id);
    const accepted = await setProposalStatus(proposal.id, "aceita", mocks.user.id);

    expect(sent.ok && sent.clientMoved).toBeNull();
    expect(accepted.ok && accepted.clientMoved).toBeNull();
    expect(await statusOf(client.id)).toBe(status);
    expect(await statusLines(client.id)).toEqual([]);
  });

  it("repetir o mesmo status não grava nada de novo", async () => {
    const client = await makeClient("novo_contato");
    const proposal = await makeProposal(client.id);
    await setProposalStatus(proposal.id, "enviada", mocks.user.id);
    const again = await setProposalStatus(proposal.id, "enviada", mocks.user.id);
    expect(again.ok && again.clientMoved).toBeNull();
    expect(await historyOf(client.id)).toHaveLength(2);
  });
});

describe("projeto criado → cliente em produção", () => {
  it("converter a proposta aceita cria o projeto, move o cliente e avisa no toast", async () => {
    const client = await makeClient("fechado");
    const proposal = await makeProposal(client.id, "aceita");

    await expect(convertToProjectAction(initialActionState, form({ id: proposal.id }))).rejects.toThrow(/^REDIRECT:\/painel\/projetos\/\d+$/);

    const [project] = await db.select().from(projects).where(eq(projects.proposalId, proposal.id));
    projectIds.push(project.id);
    expect(project.clientId).toBe(client.id);
    expect(await statusOf(client.id)).toBe("em_producao");
    expect(await statusLines(client.id)).toEqual([`Status alterado automaticamente para Em produção (projeto criado a partir da proposta ${proposal.number}). Antes: Fechado.`]);
    expect(mocks.flashToast).toHaveBeenCalledWith("Projeto criado a partir da proposta. O cliente foi movido para “Em produção” no funil.");

    // converter de novo só abre o projeto que já existe: nada é criado nem movido
    mocks.flashToast.mockClear();
    await expect(convertToProjectAction(initialActionState, form({ id: proposal.id }))).rejects.toThrow(`REDIRECT:/painel/projetos/${project.id}`);
    expect(mocks.flashToast).not.toHaveBeenCalled();
    expect(await statusLines(client.id)).toHaveLength(1);
  });

  it("proposta que não foi aceita não vira projeto nem move o cliente", async () => {
    const client = await makeClient("em_orcamento");
    const proposal = await makeProposal(client.id, "enviada");
    const state = await convertToProjectAction(initialActionState, form({ id: proposal.id }));
    expect(state.ok).toBe(false);
    expect(await statusOf(client.id)).toBe("em_orcamento");
  });

  it("projeto criado à mão para o cliente: Em orçamento → Em produção", async () => {
    const client = await makeClient("em_orcamento");

    await expect(createProjectAction(initialActionState, projectForm({ clientId: client.id }))).rejects.toThrow(/^REDIRECT:\/painel\/projetos\/\d+$/);

    const [project] = await db.select().from(projects).where(eq(projects.clientId, client.id));
    projectIds.push(project.id);
    expect(await statusOf(client.id)).toBe("em_producao");
    expect(await statusLines(client.id)).toEqual(["Status alterado automaticamente para Em produção (projeto “[Teste] Projeto do funil” criado). Antes: Em orçamento."]);
    expect(mocks.flashToast).toHaveBeenCalledWith("Projeto criado. O cliente foi movido para “Em produção” no funil.");
  });

  it("projeto sem cliente, de cliente finalizado/perdido ou registrado já entregue: ninguém é movido", async () => {
    const base: ProjectInput = {
      title: "[Teste] Projeto sem avanço",
      clientId: null,
      proposalId: null,
      serviceType: "eventos",
      stage: "briefing",
      ownerId: null,
      location: "",
      eventDate: null,
      shootDeadline: null,
      deliveryDeadline: null,
      deliveredAt: null,
      driveUrl: "",
      galleryUrl: "",
      referencesUrl: "",
      finalFilesUrl: "",
      links: [],
      backupStatus: "pendente",
      backupNote: "",
      notes: "",
    };
    const semCliente = await createProject(base, "2026-11-18", mocks.user.id);
    projectIds.push(semCliente.project.id);
    expect(semCliente.clientMoved).toBeNull();

    for (const status of ["finalizado", "perdido"] as const) {
      const client = await makeClient(status);
      const result = await createProject({ ...base, clientId: client.id }, "2026-11-18", mocks.user.id);
      projectIds.push(result.project.id);
      expect(result.clientMoved).toBeNull();
      expect(await statusOf(client.id)).toBe(status);
    }

    const client = await makeClient("fechado");
    const entregue = await createProject({ ...base, clientId: client.id, stage: "entregue" }, "2026-11-18", mocks.user.id);
    projectIds.push(entregue.project.id);
    expect(entregue.clientMoved).toBeNull();
    expect(await statusOf(client.id)).toBe("fechado");
  });
});
