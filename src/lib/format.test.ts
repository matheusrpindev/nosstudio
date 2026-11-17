import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays, endOfMonth, formatDate, formatDateLong, isISODate, monthGrid, startOfWeek } from "./dates";
import { formatBRL, formatPhone, parseBRL, safeHref, safeUrl, slugify, toWhatsAppNumber, videoEmbedUrl, whatsAppLink } from "./format";

describe("dinheiro", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(1090000)).toBe("R$ 10.900,00");
    expect(formatBRL(327000)).toBe("R$ 3.270,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
  it("interpreta valores digitados", () => {
    expect(parseBRL("10.900,00")).toBe(1090000);
    expect(parseBRL("R$ 10.900")).toBe(1090000);
    expect(parseBRL("10900")).toBe(1090000);
    expect(parseBRL("1500,5")).toBe(150050);
    expect(parseBRL("1500.50")).toBe(150050);
    expect(parseBRL("1.234.567,89")).toBe(123456789);
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("contato", () => {
  it("formata telefones", () => {
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
    expect(formatPhone("+55 11 3456-7890")).toBe("(11) 3456-7890");
  });
  it("monta links de WhatsApp", () => {
    expect(toWhatsAppNumber("(11) 91234-5678")).toBe("5511912345678");
    expect(whatsAppLink("11912345678", "Olá!")).toBe("https://wa.me/5511912345678?text=Ol%C3%A1!");
    expect(whatsAppLink("")).toBe("");
  });
});

describe("links", () => {
  it("só aceita http(s) e caminhos internos", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(safeHref("/contato")).toBe("/contato");
    expect(safeHref("//evil.com")).toBe("https://evil.com/");
    expect(safeHref("data:text/html,x")).toBe("");
  });
  it("gera embeds de vídeo", () => {
    expect(videoEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(videoEmbedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345?dnt=1");
    expect(videoEmbedUrl("https://exemplo.com/video.mp4")).toBeNull();
  });
  it("cria slugs", () => {
    expect(slugify("Vídeo & Produção Audiovisual")).toBe("video-e-producao-audiovisual");
  });
});

describe("datas", () => {
  it("valida e formata", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-11-17")).toBe(true);
    expect(formatDate("2026-11-17")).toBe("17/11/2026");
    expect(formatDateLong("2026-11-17")).toBe("17 de novembro de 2026");
  });
  it("faz contas de calendário", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(diffDays("2026-11-17", "2026-11-20")).toBe(3);
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(startOfWeek("2026-11-17")).toBe("2026-11-15");
    const grid = monthGrid("2026-11-01");
    expect(grid[0][0]).toBe("2026-11-01");
    expect(grid.at(-1)?.at(-1)).toBe("2026-12-05");
  });
});
