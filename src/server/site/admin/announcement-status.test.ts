import { describe, expect, it } from "vitest";
import { ANNOUNCEMENT_LEAD_MINUTES, announcementStatuses, servableAnnouncements } from "./announcement-status";

const NOW = "2026-11-18T10:00";
const item = (id: number, over: Partial<{ enabled: boolean; startsAt: string | null; endsAt: string | null }> = {}) => ({
  id,
  enabled: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

describe("announcementStatuses", () => {
  it("só o primeiro aviso ligado e dentro do período está no ar", () => {
    const result = announcementStatuses([item(1), item(2)], NOW);
    expect(result.get(1)).toBe("no_ar");
    expect(result.get(2)).toBe("na_fila");
  });

  it("pula desligados, agendados e encerrados", () => {
    const result = announcementStatuses(
      [
        item(1, { enabled: false }),
        item(2, { startsAt: "2026-12-01T00:00" }),
        item(3, { endsAt: "2026-11-18T09:59" }),
        item(4, { startsAt: "2026-11-01T00:00", endsAt: "2026-12-01T00:00" }),
      ],
      NOW,
    );
    expect([1, 2, 3, 4].map((id) => result.get(id))).toEqual(["desligado", "agendado", "encerrado", "no_ar"]);
  });

  it("o fim é exclusivo e o início é inclusivo", () => {
    expect(announcementStatuses([item(1, { endsAt: NOW })], NOW).get(1)).toBe("encerrado");
    expect(announcementStatuses([item(1, { startsAt: NOW })], NOW).get(1)).toBe("no_ar");
  });
});

describe("servableAnnouncements (o que pode ir para o HTML público)", () => {
  // 18/11/2026 10:00 em São Paulo (UTC-3)
  const now = new Date("2026-11-18T13:00:00Z");
  const row = (id: number, startsAt: string | null, endsAt: string | null = null) => ({ id, startsAt, endsAt, message: `aviso ${id}` });

  it("aviso agendado para o futuro NÃO sai do servidor (nem texto, nem data)", () => {
    const result = servableAnnouncements([row(1, "2027-06-01T09:00"), row(2, "2026-11-18T11:01"), row(3, "2026-11-19T10:00")], now);
    expect(result).toEqual([]);
  });

  it("aviso sem período ou já iniciado sai normalmente, sem marca de pendente", () => {
    const result = servableAnnouncements([row(1, null), row(2, "2026-11-18T10:00"), row(3, "2026-11-01T00:00", "2026-12-01T00:00")], now);
    expect(result.map((item) => [item.id, item.pending])).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ]);
  });

  it("aviso que começa dentro da antecedência sai marcado como pendente (o HTML o traz escondido)", () => {
    expect(ANNOUNCEMENT_LEAD_MINUTES).toBe(60);
    const result = servableAnnouncements([row(1, "2026-11-18T10:01"), row(2, "2026-11-18T11:00")], now);
    expect(result.map((item) => [item.id, item.pending])).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it("aviso encerrado fica de fora", () => {
    expect(servableAnnouncements([row(1, null, "2026-11-18T10:00"), row(2, "2026-11-01T00:00", "2026-11-18T09:59")], now)).toEqual([]);
    expect(servableAnnouncements([row(3, null, "2026-11-18T10:01")], now)).toHaveLength(1);
  });

  it("mantém a ordem recebida", () => {
    const result = servableAnnouncements([row(5, null), row(2, "2027-01-01T00:00"), row(9, "2026-11-18T10:30"), row(1, null)], now);
    expect(result.map((item) => item.id)).toEqual([5, 9, 1]);
  });
});
