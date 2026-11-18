import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { leadFormSchema } from "./lead-form";
import { knownPackageName, LEAD_HONEYPOT_FIELD, LEAD_MIN_FILL_MS, LEAD_STARTED_AT_FIELD, leadSpamSignals } from "./lead-form-fields";

const base = { name: "Maria da Silva", whatsapp: "(11) 98888-7777", serviceInterest: "fotografia", consent: "on" };

describe("formulário de lead", () => {
  it("aceita um envio normal, com e sem e-mail", () => {
    expect(leadFormSchema.safeParse(base).success).toBe(true);
    const parsed = leadFormSchema.safeParse({ ...base, email: " Maria@Exemplo.org " });
    expect(parsed.success && parsed.data.email).toBe("maria@exemplo.org");
  });

  it("recusa e-mail com parâmetros de mailto (bcc, cc, body, subject)", () => {
    for (const email of [
      "vitima@exemplo.org?bcc=atacante%40evil.example&body=oi",
      "vitima@exemplo.org?subject=Proposta",
      "vitima@exemplo.org&cc=x@evil.example",
      "vitima@exemplo.org,atacante@evil.example",
      "vitima@exemplo.org#x",
    ]) {
      const parsed = leadFormSchema.safeParse({ ...base, email });
      expect(parsed.success, email).toBe(false);
    }
  });
});

describe("knownPackageName (?pacote= da URL)", () => {
  const published = ["Começo", "Presença", "Destaque", "Ensaio fotográfico"];

  it("aceita só o nome exato de um pacote publicado", () => {
    expect(knownPackageName("Presença", published)).toBe("Presença");
    expect(knownPackageName("  Ensaio fotográfico ", published)).toBe("Ensaio fotográfico");
  });

  it("ignora texto arbitrário, HTML e fórmulas", () => {
    for (const value of [
      "Promoção: 50% hoje, chame 11 9XXXX-XXXX",
      "<img src=x onerror=alert(1)> PROMO falsa",
      '=HYPERLINK("http://evil")',
      "presença",
      "Presença 2",
      "",
      null,
      undefined,
    ]) {
      expect(knownPackageName(value, published)).toBe("");
    }
    expect(knownPackageName("Presença", [])).toBe("");
  });
});

describe("sinais anti-spam do envio", () => {
  const NOW = 1_800_000_000_000;
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };

  it("campo-isca preenchido é robô; vazio ou só espaços, não", () => {
    expect(leadSpamSignals(form({ [LEAD_HONEYPOT_FIELD]: "ACME Ltda" }), NOW).honeypot).toBe(true);
    expect(leadSpamSignals(form({ [LEAD_HONEYPOT_FIELD]: "  " }), NOW).honeypot).toBe(false);
    expect(leadSpamSignals(form({}), NOW).honeypot).toBe(false);
  });

  it("envio rápido demais é só um sinal (não descarta) — e sem JavaScript não há o que medir", () => {
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - 500) }), NOW)).toEqual({ honeypot: false, tooFast: true });
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - LEAD_MIN_FILL_MS) }), NOW).tooFast).toBe(false);
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - 60_000) }), NOW).tooFast).toBe(false);
    for (const value of ["", "abc", "0", "-5"]) expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: value }), NOW).tooFast).toBe(false);
    expect(leadSpamSignals(form({}), NOW).tooFast).toBe(false);
  });
});

describe("o navegador não recebe o zod por causa do formulário", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  it("lead-form-fields.ts não importa nada", () => {
    expect(read("src/lib/site/lead-form-fields.ts")).not.toMatch(/^import /m);
  });

  it("os componentes do site importam só o arquivo de campos, nunca o schema", () => {
    for (const file of ["src/components/site/lead-form.tsx", "src/components/site/contact-package-notice.tsx"]) {
      const source = read(file);
      expect(source, file).toContain('"@/lib/site/lead-form-fields"');
      expect(source, file).not.toMatch(/from "@\/lib\/site\/lead-form"/);
      expect(source, file).not.toMatch(/from "zod"/);
    }
  });
});
