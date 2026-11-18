import { describe, expect, it } from "vitest";
import { buildCalendarEntries, copyTitle, publishDateForStatus, validateContentDates } from "./logic";

describe("validateContentDates", () => {
  it("aceita datas na ordem gravar → editar → publicar (inclusive no mesmo dia)", () => {
    expect(validateContentDates({ recordDate: "2026-11-10", editDeadline: "2026-11-12", publishDate: "2026-11-12" })).toEqual({});
  });
  it("aceita datas parciais ou vazias", () => {
    expect(validateContentDates({ recordDate: null, editDeadline: null, publishDate: null })).toEqual({});
    expect(validateContentDates({ recordDate: "2026-11-10", editDeadline: null, publishDate: "2026-11-09" }).publishDate).toMatch(/antes da gravação/);
  });
  it("acusa prazo de edição antes da gravação e publicação antes do prazo", () => {
    const errors = validateContentDates({ recordDate: "2026-11-10", editDeadline: "2026-11-09", publishDate: "2026-11-08" });
    expect(errors.editDeadline).toBeDefined();
    expect(errors.publishDate).toMatch(/prazo de edição/);
  });
});

describe("buildCalendarEntries", () => {
  const item = { id: 1, title: "Tema", status: "edicao" as const, publishDate: "2026-11-20", recordDate: "2026-11-15", editDeadline: "2026-11-18" };
  it("gera publicação, gravação e edição", () => {
    const entries = buildCalendarEntries([item], "2026-11-01", "2026-11-30");
    expect(entries.map((e) => [e.kind, e.date])).toEqual([
      ["publicacao", "2026-11-20"],
      ["gravacao", "2026-11-15"],
      ["edicao", "2026-11-18"],
    ]);
  });
  it("itens publicados só mostram a publicação", () => {
    const entries = buildCalendarEntries([{ ...item, status: "publicado" }], "2026-11-01", "2026-11-30");
    expect(entries.map((e) => e.kind)).toEqual(["publicacao"]);
  });
  it("ignora datas fora da janela e itens sem data", () => {
    expect(buildCalendarEntries([item], "2026-12-01", "2026-12-31")).toEqual([]);
    expect(buildCalendarEntries([{ ...item, publishDate: null, recordDate: null, editDeadline: null }], "2026-11-01", "2026-11-30")).toEqual([]);
  });
});

describe("copyTitle", () => {
  it("acrescenta (cópia) uma vez só", () => {
    expect(copyTitle("Tema")).toBe("Tema (cópia)");
    expect(copyTitle("Tema (cópia)")).toBe("Tema (cópia)");
  });
  it("respeita o limite de tamanho", () => {
    expect(copyTitle("a".repeat(160)).length).toBeLessThanOrEqual(160);
  });
});

describe("publishDateForStatus", () => {
  it("preenche hoje ao publicar sem data", () => {
    expect(publishDateForStatus("publicado", null, "2026-11-18")).toBe("2026-11-18");
  });
  it("mantém a data existente e não mexe em outros status", () => {
    expect(publishDateForStatus("publicado", "2026-11-10", "2026-11-18")).toBe("2026-11-10");
    expect(publishDateForStatus("edicao", null, "2026-11-18")).toBeNull();
  });
});
