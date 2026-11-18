import { describe, expect, it } from "vitest";
import { checklistProgress, deadlineLabel, deadlineStatus, linkHost, projectLinkEntries, resolveDeliveredAt, SERVICE_BY_MODALITY } from "./logic";

const TODAY = "2026-11-18";

describe("deadlineStatus", () => {
  it("sem prazo ou fora do fluxo aberto não destaca", () => {
    expect(deadlineStatus(null, "edicao", TODAY)).toEqual({ kind: "none" });
    expect(deadlineStatus("2026-11-01", "entregue", TODAY)).toEqual({ kind: "none" });
    expect(deadlineStatus("2026-11-01", "cancelado", TODAY)).toEqual({ kind: "none" });
  });
  it("classifica atrasado, hoje, esta semana e adiante", () => {
    expect(deadlineStatus("2026-11-15", "edicao", TODAY)).toEqual({ kind: "atrasado", days: 3 });
    expect(deadlineStatus("2026-11-18", "revisao", TODAY)).toEqual({ kind: "hoje" });
    expect(deadlineStatus("2026-11-19", "revisao", TODAY)).toEqual({ kind: "semana", days: 1 });
    expect(deadlineStatus("2026-11-25", "gravacao", TODAY)).toEqual({ kind: "semana", days: 7 });
    expect(deadlineStatus("2026-11-26", "gravacao", TODAY)).toEqual({ kind: "ok", days: 8 });
  });
  it("monta o texto do destaque", () => {
    expect(deadlineLabel({ kind: "atrasado", days: 1 })).toBe("Atrasado há 1 dia");
    expect(deadlineLabel({ kind: "atrasado", days: 4 })).toBe("Atrasado há 4 dias");
    expect(deadlineLabel({ kind: "hoje" })).toBe("Entrega hoje");
    expect(deadlineLabel({ kind: "semana", days: 1 })).toBe("Entrega amanhã");
    expect(deadlineLabel({ kind: "semana", days: 5 })).toBe("Entrega em 5 dias");
    expect(deadlineLabel({ kind: "ok", days: 20 })).toBeNull();
    expect(deadlineLabel({ kind: "none" })).toBeNull();
  });
});

describe("resolveDeliveredAt", () => {
  it("preenche hoje só ao entregar sem data", () => {
    expect(resolveDeliveredAt("entregue", null, TODAY)).toBe(TODAY);
    expect(resolveDeliveredAt("entregue", "2026-11-10", TODAY)).toBe("2026-11-10");
    expect(resolveDeliveredAt("edicao", null, TODAY)).toBeNull();
    expect(resolveDeliveredAt("edicao", "2026-11-10", TODAY)).toBe("2026-11-10");
  });
});

describe("projectLinkEntries", () => {
  it("valida os links e descarta os inseguros", () => {
    const entries = projectLinkEntries({
      driveUrl: "https://drive.google.com/drive/folders/abc",
      galleryUrl: "",
      referencesUrl: "javascript:alert(1)",
      finalFilesUrl: "wetransfer.com/x",
      links: [
        { label: "Making of", url: "https://youtu.be/xyz" },
        { label: "Ruim", url: "data:text/html,oi" },
        { label: "", url: "https://example.com" },
      ],
    });
    expect(entries.map((e) => [e.label, e.url])).toEqual([
      ["Pasta no Google Drive", "https://drive.google.com/drive/folders/abc"],
      ["Arquivos finais", "https://wetransfer.com/x"],
      ["Making of", "https://youtu.be/xyz"],
      ["Link", "https://example.com/"],
    ]);
  });
  it("extrai o site do link", () => {
    expect(linkHost("https://www.drive.google.com/a/b")).toBe("drive.google.com");
  });
});

describe("misc", () => {
  it("modalidade vira tipo de serviço", () => {
    expect(SERVICE_BY_MODALITY.casamento).toBe("casamentos");
    expect(SERVICE_BY_MODALITY.mensal).toBe("pacote_mensal");
  });
  it("conta o checklist", () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 });
    expect(checklistProgress(null)).toEqual({ done: 0, total: 0 });
  });
});
