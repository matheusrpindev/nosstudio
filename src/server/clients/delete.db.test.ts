import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { clientInteractions, clients, leads } from "@/db/schema";
import { countClientLeads, deleteClient } from "./admin";

const leadIds: number[] = [];
const clientIds: number[] = [];

afterAll(async () => {
  if (leadIds.length) await db.delete(leads).where(inArray(leads.id, leadIds));
  if (clientIds.length) await db.delete(clients).where(inArray(clients.id, clientIds));
});

async function clientWithLeads(howMany: number) {
  const [client] = await db.insert(clients).values({ name: "[Teste] Titular" }).returning();
  clientIds.push(client.id);
  await db.insert(clientInteractions).values({ clientId: client.id, kind: "nota", content: "atendimento" });
  for (let i = 0; i < howMany; i++) {
    const [lead] = await db.insert(leads).values({ name: "[Teste] Titular", whatsapp: "11988887777", email: "titular@exemplo.org", message: "oi", clientId: client.id }).returning();
    leadIds.push(lead.id);
  }
  return client;
}

describe("exclusão de cliente (eliminação de dados)", () => {
  it("sem a opção, os leads de origem continuam (sem vínculo) — e a tela sabe quantos são", async () => {
    const client = await clientWithLeads(2);
    expect(await countClientLeads(client.id)).toBe(2);
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
    expect(await countClientLeads(other.id)).toBe(1);
  });

  it("cliente inexistente: nada é apagado", async () => {
    expect(await deleteClient(999_999, { withLeads: true })).toBeNull();
  });
});
