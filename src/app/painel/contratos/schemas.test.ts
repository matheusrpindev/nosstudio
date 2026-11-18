import { describe, expect, it } from "vitest";
import { contractSchema, templateSchema } from "./schemas";

const base = { title: "Contrato mensal", kind: "mensal", status: "rascunho", clientId: "3", signedAt: "", validFrom: "", validUntil: "", fileMediaId: "", externalUrl: "", body: "", notes: "" };

describe("contractSchema", () => {
  it("aceita um contrato completo e normaliza vazios", () => {
    const parsed = contractSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ clientId: 3, projectId: null, fileMediaId: null, externalUrl: "", versionLabel: "" });
  });

  it("exige cliente, menos no acordo entre sócios", () => {
    expect(contractSchema.safeParse({ ...base, clientId: "" }).success).toBe(false);
    expect(contractSchema.safeParse({ ...base, clientId: "", kind: "socios" }).success).toBe(true);
  });

  it("recusa vigência que termina antes de começar", () => {
    const parsed = contractSchema.safeParse({ ...base, validFrom: "2026-12-10", validUntil: "2026-12-01" });
    expect(parsed.success).toBe(false);
    expect(contractSchema.safeParse({ ...base, validFrom: "2026-12-01", validUntil: "2026-12-01" }).success).toBe(true);
  });

  it("só aceita links http(s) e completa o protocolo", () => {
    expect(contractSchema.safeParse({ ...base, externalUrl: "javascript:alert(1)" }).success).toBe(false);
    const parsed = contractSchema.safeParse({ ...base, externalUrl: "drive.google.com/x" });
    expect(parsed.success && parsed.data.externalUrl).toBe("https://drive.google.com/x");
  });

  it("recusa tipo e status desconhecidos", () => {
    expect(contractSchema.safeParse({ ...base, kind: "x" }).success).toBe(false);
    expect(contractSchema.safeParse({ ...base, status: "x" }).success).toBe(false);
  });
});

describe("templateSchema", () => {
  it("exige nome e texto", () => {
    expect(templateSchema.safeParse({ title: "", kind: "mensal", body: "x" }).success).toBe(false);
    expect(templateSchema.safeParse({ title: "M", kind: "mensal", body: "" }).success).toBe(false);
    expect(templateSchema.safeParse({ title: "M", kind: "mensal", body: "texto" }).success).toBe(true);
  });
});
