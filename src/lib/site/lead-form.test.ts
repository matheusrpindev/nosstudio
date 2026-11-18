import { describe, expect, it } from "vitest";
import { knownPackageName, leadFormSchema } from "./lead-form";

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
