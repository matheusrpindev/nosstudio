import { describe, expect, it } from "vitest";
import { announcementStatuses } from "./announcement-status";

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
