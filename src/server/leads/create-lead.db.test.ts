import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { leadFormSchema } from "@/lib/site/lead-form";
import { createLead, FAST_SUBMIT_NOTE, leadNotificationEmail } from "./create-lead";

const created: number[] = [];
afterAll(async () => {
  if (created.length) await db.delete(leads).where(inArray(leads.id, created));
});

const valid = () => leadFormSchema.parse({ name: "[Teste] Maria", whatsapp: "(11) 98888-7777", serviceInterest: "fotografia", consent: "on", message: "Quero um orçamento." });

describe("gravação do lead do site", () => {
  it("envio normal: grava com consentimento e sem observação", async () => {
    const lead = await createLead(valid(), "2026-01");
    created.push(lead.id);
    expect(lead.status).toBe("novo");
    expect(lead.consentVersion).toBe("2026-01");
    expect(lead.consentAt).toBeInstanceOf(Date);
    expect(lead.details.extras).toBeUndefined();
  });

  it("envio válido e rápido demais é GRAVADO (não se perde pedido) e leva uma observação para os sócios", async () => {
    const lead = await createLead(valid(), "2026-01", { tooFast: true });
    created.push(lead.id);
    expect(lead.id).toBeGreaterThan(0);
    expect(lead.name).toBe("[Teste] Maria");
    expect(lead.details.extras).toEqual({ [FAST_SUBMIT_NOTE.label]: FAST_SUBMIT_NOTE.value });
    // a observação também vai no e-mail de aviso
    expect(leadNotificationEmail(lead, "https://exemplo.test/painel/leads/1").text).toContain(FAST_SUBMIT_NOTE.value);
  });

  it("formulário vazio não passa na validação (a action mostra os erros em vez de fingir sucesso)", () => {
    const parsed = leadFormSchema.safeParse({});
    expect(parsed.success).toBe(false);
    const fields = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "whatsapp", "consent"]));
  });
});
