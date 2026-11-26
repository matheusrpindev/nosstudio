import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { agendaEvents, clientInteractions, clients, contentItems, contracts, financeEntries, leads, projects, proposals, tasks } from "@/db/schema";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";
import { deleteClient } from "./admin";
import { describeRemaining, exportClientSubjectData, getClientFootprint } from "./subject-data";

const leadIds: number[] = [];
const clientIds: number[] = [];
const cleanup: (() => Promise<unknown>)[] = [];

/** Quem olha a contagem e exporta (os compromissos da agenda saem pela privacidade, para esta pessoa). */
let viewer: TestAccount;
beforeAll(async () => {
  viewer = await makeAccount("admin");
});

afterAll(async () => {
  await removeAccounts();
  for (const run of cleanup) await run();
  if (leadIds.length) await db.delete(leads).where(inArray(leads.id, leadIds));
  if (clientIds.length) await db.delete(clients).where(inArray(clients.id, clientIds));
});

let seq = 0;
/** WhatsApp e e-mail únicos por cliente de teste (os leads "da mesma pessoa" são achados por eles). */
function contact() {
  seq++;
  return { whatsapp: `1198${String(Date.now()).slice(-5)}${String(seq).padStart(2, "0")}`, email: `titular-${Date.now()}-${seq}@exemplo.org` };
}

async function clientWithLeads(howMany: number) {
  const keys = contact();
  const [client] = await db.insert(clients).values({ name: "[Teste] Titular", ...keys }).returning();
  clientIds.push(client.id);
  await db.insert(clientInteractions).values({ clientId: client.id, kind: "nota", content: "atendimento" });
  for (let i = 0; i < howMany; i++) {
    const [lead] = await db.insert(leads).values({ name: "[Teste] Titular", ...keys, message: "oi", clientId: client.id }).returning();
    leadIds.push(lead.id);
  }
  return client;
}

describe("exclusão de cliente (eliminação de dados)", () => {
  it("sem a opção, os leads de origem continuam (sem vínculo) — e a tela sabe quantos são", async () => {
    const client = await clientWithLeads(2);
    expect((await getClientFootprint(client.id, viewer))?.leads).toBe(2);
    expect(await deleteClient(client.id)).toEqual({ id: client.id, leadsDeleted: 0 });
    expect(await db.select().from(clients).where(eq(clients.id, client.id))).toHaveLength(0);
    expect(await db.select().from(clientInteractions).where(eq(clientInteractions.clientId, client.id))).toHaveLength(0);
    const remaining = await db.select().from(leads).where(inArray(leads.id, leadIds.slice(-2)));
    expect(remaining).toHaveLength(2);
    expect(remaining.every((lead) => lead.clientId === null)).toBe(true);
  });

  it("com a opção, os leads ligados ao cliente são apagados junto (e só eles)", async () => {
    const other = await clientWithLeads(1);
    const client = await clientWithLeads(2);
    const mine = leadIds.slice(-2);
    expect(await deleteClient(client.id, { withLeads: true })).toEqual({ id: client.id, leadsDeleted: 2 });
    expect(await db.select().from(leads).where(inArray(leads.id, mine))).toHaveLength(0);
    expect((await getClientFootprint(other.id, viewer))?.leads).toBe(1);
  });

  it("pedido com o mesmo WhatsApp ou e-mail, mesmo sem vínculo, conta e é apagado junto; de outra pessoa, não", async () => {
    const client = await clientWithLeads(1);
    const [samePhone] = await db.insert(leads).values({ name: "[Teste] Mesmo telefone", whatsapp: client.whatsapp, message: "segundo pedido" }).returning();
    const [sameEmail] = await db.insert(leads).values({ name: "[Teste] Mesmo e-mail", whatsapp: "11900000001", email: client.email.toUpperCase(), message: "terceiro" }).returning();
    const [stranger] = await db.insert(leads).values({ name: "[Teste] Outra pessoa", whatsapp: "11900000002", email: "outra@exemplo.org", message: "nada a ver" }).returning();
    leadIds.push(samePhone.id, sameEmail.id, stranger.id);

    expect((await getClientFootprint(client.id, viewer))?.leads).toBe(3);
    expect(await deleteClient(client.id, { withLeads: true })).toEqual({ id: client.id, leadsDeleted: 3 });
    const left = await db.select({ id: leads.id }).from(leads).where(inArray(leads.id, [samePhone.id, sameEmail.id, stranger.id]));
    expect(left.map((row) => row.id)).toEqual([stranger.id]);
  });

  it("cliente sem WhatsApp nem e-mail não 'casa' com leads sem esses dados", async () => {
    const [client] = await db.insert(clients).values({ name: "[Teste] Sem contato" }).returning();
    clientIds.push(client.id);
    const [lead] = await db.insert(leads).values({ name: "[Teste] Lead qualquer", whatsapp: "", message: "x" }).returning();
    leadIds.push(lead.id);
    expect((await getClientFootprint(client.id, viewer))?.leads).toBe(0);
    expect(await deleteClient(client.id, { withLeads: true })).toEqual({ id: client.id, leadsDeleted: 0 });
    expect(await db.select().from(leads).where(eq(leads.id, lead.id))).toHaveLength(1);
  });

  it("cliente inexistente: nada é apagado", async () => {
    expect(await deleteClient(999_999, { withLeads: true })).toBeNull();
    expect(await getClientFootprint(999_999, viewer)).toBeNull();
    expect(await exportClientSubjectData(999_999, new Date(), viewer)).toBeNull();
  });
});

describe("o que fica e o que sai (contagem do diálogo e exportação do titular)", () => {
  async function fullClient() {
    const client = await clientWithLeads(1);
    const [proposal] = await db
      .insert(proposals)
      .values({ number: `T-${Date.now()}-${seq}`, title: "[Teste] Casamento", clientId: client.id, clientDisplayName: "Titular & Par", internalNotes: "MARGEM-SECRETA", discountCents: 77777, overheadCents: 12345 })
      .returning();
    const [project] = await db.insert(projects).values({ title: "[Teste] Projeto do titular", clientId: client.id }).returning();
    const [contract] = await db.insert(contracts).values({ title: "[Teste] Contrato do titular", clientId: client.id, body: "Contratante: Titular" }).returning();
    const [income] = await db.insert(financeEntries).values({ type: "receita", category: "servico", description: "[Teste] Entrada", amountCents: 150000, dueDate: "2026-11-20", clientId: client.id }).returning();
    const [expense] = await db
      .insert(financeEntries)
      .values({ type: "despesa", category: "freelancer", description: "[Teste] CUSTO-INTERNO freelancer", amountCents: 40000, dueDate: "2026-11-21", clientId: client.id, supplier: "FORNECEDOR-SECRETO" })
      .returning();
    const [event] = await db.insert(agendaEvents).values({ title: "[Teste] Reunião com titular", date: "2026-11-25", clientId: client.id }).returning();
    const [task] = await db.insert(tasks).values({ title: "[Teste] Ligar para titular", clientId: client.id }).returning();
    await db.insert(contentItems).values({ title: "[Teste] Reels do titular", clientId: client.id });
    cleanup.push(async () => {
      await db.delete(financeEntries).where(inArray(financeEntries.id, [income.id, expense.id]));
      await db.delete(contracts).where(eq(contracts.id, contract.id));
      await db.delete(tasks).where(eq(tasks.id, task.id));
      await db.delete(agendaEvents).where(eq(agendaEvents.id, event.id));
      await db.delete(proposals).where(eq(proposals.id, proposal.id));
      await db.delete(projects).where(eq(projects.id, project.id));
    });
    return { client, proposal, project, contract, income, expense, event, task };
  }

  it("a contagem bate com o que existe, e a frase só cita o que há", async () => {
    const { client } = await fullClient();
    const footprint = await getClientFootprint(client.id, viewer);
    expect(footprint).toEqual({ interactions: 1, contentItems: 1, leads: 1, proposals: 1, projects: 1, contracts: 1, financeEntries: 2, events: 1, tasks: 1 });
    expect(describeRemaining(footprint!)).toBe("1 orçamento, 1 projeto, 1 contrato, 2 lançamentos financeiros, 1 compromisso na agenda e 1 tarefa");
    const none = { interactions: 3, contentItems: 0, leads: 2, proposals: 0, projects: 0, contracts: 0, financeEntries: 0, events: 0, tasks: 0 };
    expect(describeRemaining(none)).toBe("");
    expect(describeRemaining({ ...none, proposals: 2 })).toBe("2 orçamentos");
    expect(describeRemaining({ ...none, proposals: 2, tasks: 3 })).toBe("2 orçamentos e 3 tarefas");
  });

  it("a exportação traz os dados do titular de todos os módulos — sem custos internos", async () => {
    const { client } = await fullClient();
    const result = await exportClientSubjectData(client.id, new Date("2026-11-18T12:00:00Z"), viewer);
    expect(result).not.toBeNull();
    const data = JSON.parse(result!.json);
    expect(data.geradoEm).toBe("2026-11-18T12:00:00.000Z");
    expect(data.cadastro).toMatchObject({ id: client.id, nome: "[Teste] Titular", whatsapp: client.whatsapp, email: client.email });
    expect(data.contagem).toMatchObject({ cadastro: 1, historicoDeAtendimento: 1, pedidosPeloSite: 1, orcamentos: 1, projetos: 1, contratos: 1, pagamentos: 1, agenda: 1, tarefas: 1, conteudos: 1 });
    expect(data.pedidosPeloSite[0]).toMatchObject({ vinculadoAoCadastro: true, mensagem: "oi" });
    expect(data.orcamentos[0]).toMatchObject({ titulo: "[Teste] Casamento", nomeNaCapa: "Titular & Par" });
    expect(data.contratos[0]).toMatchObject({ texto: "Contratante: Titular", arquivoAssinado: "não" });
    expect(data.pagamentos[0]).toMatchObject({ descricao: "[Teste] Entrada", valorCentavos: 150000 });
    // nada do cálculo interno nem das despesas da NÓS
    for (const secret of ["MARGEM-SECRETA", "77777", "12345", "CUSTO-INTERNO", "FORNECEDOR-SECRETO", "40000"]) expect(result!.json).not.toContain(secret);
    expect(result!.json).toContain("1 lançamento(s) de despesa");
  });

  it("depois de excluir o cliente: histórico e conteúdo somem; o resto continua, sem vínculo", async () => {
    const { client, proposal, project, contract, income, event, task } = await fullClient();
    await deleteClient(client.id, { withLeads: true });
    expect(await db.select().from(contentItems).where(eq(contentItems.clientId, client.id))).toHaveLength(0);
    expect(await db.select().from(clientInteractions).where(eq(clientInteractions.clientId, client.id))).toHaveLength(0);
    const [p] = await db.select({ clientId: proposals.clientId }).from(proposals).where(eq(proposals.id, proposal.id));
    const [pr] = await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, project.id));
    const [c] = await db.select({ clientId: contracts.clientId }).from(contracts).where(eq(contracts.id, contract.id));
    const [f] = await db.select({ clientId: financeEntries.clientId }).from(financeEntries).where(eq(financeEntries.id, income.id));
    const [e] = await db.select({ clientId: agendaEvents.clientId }).from(agendaEvents).where(eq(agendaEvents.id, event.id));
    const [t] = await db.select({ clientId: tasks.clientId }).from(tasks).where(eq(tasks.id, task.id));
    for (const row of [p, pr, c, f, e, t]) expect(row).toEqual({ clientId: null });
  });
});
