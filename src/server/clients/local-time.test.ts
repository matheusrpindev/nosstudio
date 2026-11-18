import { describe, expect, it } from "vitest";
import { localDateTimeToDate } from "./local-time";

describe("localDateTimeToDate", () => {
  it("converte o horário de Brasília (UTC-3) para o instante", () => {
    expect(localDateTimeToDate("2026-11-18T14:30", "America/Sao_Paulo")?.toISOString()).toBe("2026-11-18T17:30:00.000Z");
  });
  it("respeita outros fusos", () => {
    expect(localDateTimeToDate("2026-11-18T14:30", "UTC")?.toISOString()).toBe("2026-11-18T14:30:00.000Z");
    expect(localDateTimeToDate("2026-11-18T14:30", "America/Manaus")?.toISOString()).toBe("2026-11-18T18:30:00.000Z");
  });
  it("recusa texto inválido", () => {
    expect(localDateTimeToDate("2026-02-30T10:00", "UTC")).toBeNull();
    expect(localDateTimeToDate("2026-11-18", "UTC")).toBeNull();
    expect(localDateTimeToDate("2026-11-18T25:00", "UTC")).toBeNull();
  });
});
