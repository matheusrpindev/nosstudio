/** Campos automáticos dos contratos lidos do banco de teste: cliente + proposta (visão pública) + projeto. */
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { clients, projects, proposalCosts, proposalItems, proposalPayments, proposals } from "@/db/schema";
import { fillContractBody, loadContractFieldValues } from "./admin";

const clientIds: number[] = [];
const proposalIds: number[] = [];
const projectIds: number[] = [];

afterAll(async () => {
  if (projectIds.length) await db.delete(projects).where(inArray(projects.id, projectIds));
  if (proposalIds.length) await db.delete(proposals).where(inArray(proposals.id, proposalIds));
  if (clientIds.length) await db.delete(clients).where(inArray(clients.id, clientIds));
});

async function scenario() {
  const [client] = await db
    .insert(clients)
    .values({ name: "[Teste] Studio Aurora Ltda", contactName: "Marina", document: "12345678000190", email: "contato@aurora.test", whatsapp: "5531988887777", city: "Belo Horizonte" })
    .returning();
  clientIds.push(client.id);
  const [proposal] = await db
    .insert(proposals)
    .values({
      number: `T-CAMPOS-${Date.now()}`,
      title: "Pacote mensal de conteúdo",
      clientId: client.id,
      status: "aceita",
      eventDate: "2027-01-15",
      eventLocation: "Sede do cliente",
      discountCents: 33_300,
      discountApproved: false,
      entryMode: "percentual",
      entryPercent: 50,
      internalNotes: "NOTA-INTERNA-SECRETA",
      overheadCents: 45_600,
      taxPercent: 6,
      targetMarginPercent: 40,
    })
    .returning();
  proposalIds.push(proposal.id);
  await db.insert(proposalItems).values({ proposalId: proposal.id, title: "Gestão mensal", quantity: 2, unitPriceCents: 150_000, sortOrder: 1 });
  await db.insert(proposalCosts).values({ proposalId: proposal.id, category: "equipe", description: "Freelancer", amountCents: 98_700, sortOrder: 1 });
  await db.insert(proposalPayments).values([
    { proposalId: proposal.id, label: "Entrada (50%)", dueDate: "2026-12-05", amountCents: 150_000, sortOrder: 1 },
    { proposalId: proposal.id, label: "Saldo restante", dueLabel: "na entrega", amountCents: 150_000, sortOrder: 2 },
  ]);
  const [project] = await db.insert(projects).values({ title: "[Teste] Conteúdo Aurora", clientId: client.id, proposalId: proposal.id, location: "Estúdio", eventDate: "2027-02-01" }).returning();
  projectIds.push(project.id);
  return { client, proposal, project };
}

describe("campos automáticos do contrato (banco)", () => {
  it("preenche com cliente, proposta pública e projeto; o que não existe fica no texto", async () => {
    const { client, proposal, project } = await scenario();
    const body = [
      "CONTRATANTE: {{cliente}} ({{contato}}), CNPJ {{documento}}, {{email}}, {{whatsapp}}, {{cidade}}.",
      "OBJETO: {{servico}} — proposta {{proposta}} — projeto {{projeto}}.",
      "VALOR: {{valor_total}}, sendo {{entrada}} de entrada e {{saldo}} de saldo.",
      "{{parcelas}}",
      "DATA: {{data_evento}} em {{local_evento}}. Assinado em {{data_hoje}} ({{data_hoje_extenso}}). Foro: {{foro}}.",
    ].join("\n\n");

    const filled = await fillContractBody(body, { clientId: client.id, proposalId: proposal.id, projectId: project.id }, "2026-11-18");

    expect(filled).toBe(
      [
        "CONTRATANTE: [Teste] Studio Aurora Ltda (Marina), CNPJ 12.345.678/0001-90, contato@aurora.test, (31) 98888-7777, Belo Horizonte.",
        `OBJETO: Pacote mensal de conteúdo — proposta ${proposal.number} — projeto [Teste] Conteúdo Aurora.`,
        "VALOR: R$ 3.000,00, sendo R$ 1.500,00 de entrada e R$ 1.500,00 de saldo.",
        "- Entrada (50%): R$ 1.500,00 — 05/12/2026\n- Saldo restante: R$ 1.500,00 — na entrega",
        "DATA: 15/01/2027 em Sede do cliente. Assinado em 18/11/2026 (18 de novembro de 2026). Foro: {{foro}}.",
      ].join("\n\n"),
    );
  });

  it("SEGURANÇA: nada interno da proposta chega aos campos (custo, rateio, margem, nota, desconto não aprovado)", async () => {
    const { client, proposal, project } = await scenario();
    const values = await loadContractFieldValues({ clientId: client.id, proposalId: proposal.id, projectId: project.id }, "2026-11-18");
    const everything = Object.values(values).join(" | ");
    for (const secret of ["SECRETA", "987,00", "456,00", "333,00", "2.667,00", "40%", "6%"]) expect(everything).not.toContain(secret);
    expect(values.valor_total).toBe("R$ 3.000,00");
  });

  it("só o cliente escolhido: campos de proposta e projeto ficam por preencher; sem vínculo nenhum, só a data", async () => {
    const { client } = await scenario();
    expect(await fillContractBody("{{cliente}} · {{valor_total}} · {{data_evento}}", { clientId: client.id, proposalId: null, projectId: null }, "2026-11-18")).toBe(
      "[Teste] Studio Aurora Ltda · {{valor_total}} · {{data_evento}}",
    );
    expect(await fillContractBody("{{cliente}} em {{data_hoje}}", { clientId: null, proposalId: null, projectId: null }, "2026-11-18")).toBe("{{cliente}} em 18/11/2026");
    expect(await fillContractBody("{{cliente}}", { clientId: 999_999, proposalId: 999_999, projectId: 999_999 }, "2026-11-18")).toBe("{{cliente}}");
    expect(await fillContractBody("Texto sem campos.", { clientId: client.id, proposalId: null, projectId: null }, "2026-11-18")).toBe("Texto sem campos.");
  });
});
