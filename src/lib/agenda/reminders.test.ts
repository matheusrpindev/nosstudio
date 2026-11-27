import { describe, expect, it } from "vitest";
import { nowLocal } from "@/lib/dates";
import { occurrenceStart, reminderIsDue, wallMinutes, REMINDER_GRACE_MIN } from "./reminders";

describe("quando um lembrete vence (hora do estúdio)", () => {
  const start = "2026-12-08T10:00";

  it("vence na antecedência marcada e vale até pouco depois do início", () => {
    expect(reminderIsDue(start, 60, "2026-12-08T08:59")).toBe(false);
    expect(reminderIsDue(start, 60, "2026-12-08T09:00")).toBe(true);
    expect(reminderIsDue(start, 60, "2026-12-08T09:47")).toBe(true); // o despachante atrasou: ainda vale
    expect(reminderIsDue(start, 60, `2026-12-08T10:${String(REMINDER_GRACE_MIN).padStart(2, "0")}`)).toBe(true);
    expect(reminderIsDue(start, 60, `2026-12-08T10:${String(REMINDER_GRACE_MIN + 1).padStart(2, "0")}`)).toBe(false); // já começou faz tempo
    expect(reminderIsDue(start, 0, "2026-12-08T10:00")).toBe(true);
    expect(reminderIsDue(start, 0, "2026-12-08T09:59")).toBe(false);
  });

  it("antecedência em dias atravessa a meia-noite e o mês", () => {
    expect(reminderIsDue("2027-01-01T09:00", 1440, "2026-12-31T08:59")).toBe(false);
    expect(reminderIsDue("2027-01-01T09:00", 1440, "2026-12-31T09:00")).toBe(true);
    expect(reminderIsDue("2027-03-01T00:30", 60, "2027-02-28T23:30")).toBe(true);
    expect(wallMinutes("2026-12-08T10:00") - wallMinutes("2026-12-07T10:00")).toBe(1440);
  });

  it("não “lembra” de um prazo que já tinha passado quando o compromisso foi criado", () => {
    // criado às 09:30 com lembrete de 1 hora (que venceria às 09:00): não sai
    expect(reminderIsDue(start, 60, "2026-12-08T09:31", "2026-12-08T09:30")).toBe(false);
    // criado às 08:00: sai normalmente às 09:00
    expect(reminderIsDue(start, 60, "2026-12-08T09:00", "2026-12-08T08:00")).toBe(true);
    expect(reminderIsDue(start, 15, "2026-12-08T09:45", "2026-12-08T09:30")).toBe(true);
  });

  it("dia inteiro conta a partir do horário de referência; a hora do estúdio vem do fuso, não do UTC", () => {
    expect(occurrenceStart("2026-12-08", null, "09:00")).toBe("2026-12-08T09:00");
    expect(occurrenceStart("2026-12-08", "14:30", "09:00")).toBe("2026-12-08T14:30");
    // 13:00 UTC = 10:00 em São Paulo (os testes rodam com APP_TIMEZONE=America/Sao_Paulo)
    expect(nowLocal(new Date("2026-12-08T13:00:00Z"))).toBe("2026-12-08T10:00");
    // 02:30 UTC ainda é a noite anterior no estúdio
    expect(nowLocal(new Date("2026-12-09T02:30:00Z"))).toBe("2026-12-08T23:30");
  });
});
