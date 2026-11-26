import { describe, expect, it } from "vitest";
import { findConflicts, freeWindows, layoutDay, minuteRange, moveTimes, type BusySlot } from "./conflicts";
import {
  describeRecurrence,
  endSeriesBefore,
  lastOccurrence,
  normalizeRecurrence,
  occurrencesBetween,
  spanDays,
} from "./recurrence";

describe("recorrência", () => {
  it("sem regra: só a data inicial, se estiver na janela", () => {
    expect(occurrencesBetween("2026-11-18", null, "2026-11-01", "2026-11-30")).toEqual(["2026-11-18"]);
    expect(occurrencesBetween("2026-11-18", null, "2026-12-01", "2026-12-31")).toEqual([]);
    expect(occurrencesBetween("2026-11-18", null, "2026-11-01", "2026-11-30", ["2026-11-18"])).toEqual([]);
  });

  it("diária com intervalo e data final", () => {
    const rule = { freq: "diaria", interval: 2, until: "2026-11-24" } as const;
    expect(occurrencesBetween("2026-11-18", rule, "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-18",
      "2026-11-20",
      "2026-11-22",
      "2026-11-24",
    ]);
  });

  it("semanal em dias marcados, respeitando a data inicial e a janela", () => {
    // 2026-11-18 é quarta (3). Segunda (1) e quarta (3).
    const rule = { freq: "semanal", interval: 1, weekdays: [1, 3] } as const;
    expect(occurrencesBetween("2026-11-18", rule, "2026-11-16", "2026-12-02")).toEqual([
      "2026-11-18",
      "2026-11-23",
      "2026-11-25",
      "2026-11-30",
      "2026-12-02",
    ]);
  });

  it("semanal sem dias marcados usa o dia da data inicial; a cada 2 semanas pula uma", () => {
    const rule = { freq: "semanal", interval: 2 } as const;
    expect(occurrencesBetween("2026-11-18", rule, "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-18",
      "2026-12-02",
      "2026-12-16",
      "2026-12-30",
    ]);
  });

  it("mensal no dia 31 pula meses curtos; anual em 29/02 só em ano bissexto", () => {
    expect(occurrencesBetween("2026-01-31", { freq: "mensal", interval: 1 }, "2026-01-01", "2026-06-30")).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
    expect(occurrencesBetween("2024-02-29", { freq: "anual", interval: 1 }, "2024-01-01", "2032-12-31")).toEqual([
      "2024-02-29",
      "2028-02-29",
      "2032-02-29",
    ]);
  });

  it("count limita a série; exceções saem da lista mas contam para o limite", () => {
    const rule = { freq: "diaria", interval: 1, count: 4 } as const;
    expect(occurrencesBetween("2026-11-18", rule, "2026-11-01", "2026-12-31", ["2026-11-19"])).toEqual([
      "2026-11-18",
      "2026-11-20",
      "2026-11-21",
    ]);
    expect(lastOccurrence("2026-11-18", rule)).toBe("2026-11-21");
    expect(lastOccurrence("2026-11-18", { freq: "diaria", interval: 1 })).toBeNull();
  });

  it("janela distante de uma série sem fim não trava e devolve só o que cabe", () => {
    const dates = occurrencesBetween("2020-01-06", { freq: "semanal", interval: 1 }, "2026-11-01", "2026-11-30");
    expect(dates).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  });

  it("encerrar a série a partir de um dia troca o fim pela véspera", () => {
    const rule = endSeriesBefore({ freq: "semanal", interval: 1, count: 10 }, "2026-12-02");
    expect(rule).toEqual({ freq: "semanal", interval: 1, until: "2026-12-01" });
  });

  it("normaliza entradas inválidas", () => {
    expect(normalizeRecurrence(null)).toBeNull();
    expect(normalizeRecurrence({ freq: "quinzenal" })).toBeNull();
    expect(normalizeRecurrence({ freq: "semanal", interval: "0", weekdays: ["3", 1, 9, 3], until: "2026-02-30" })).toEqual({
      freq: "semanal",
      interval: 1,
      weekdays: [1, 3],
    });
    expect(normalizeRecurrence({ freq: "diaria", interval: 500, count: 99999 })).toEqual({
      freq: "diaria",
      interval: 99,
      count: 730,
    });
  });

  it("descreve em português", () => {
    expect(describeRecurrence("2026-11-18", null)).toBe("Não se repete");
    expect(describeRecurrence("2026-11-18", { freq: "semanal", interval: 1, weekdays: [1, 3], until: "2026-12-20" })).toBe(
      "Toda semana, segunda e quarta, até 20/12/2026",
    );
    expect(describeRecurrence("2026-11-18", { freq: "mensal", interval: 2, count: 6 })).toBe(
      "A cada 2 meses, no dia 18, 6 vezes",
    );
    expect(describeRecurrence("2026-11-18", { freq: "diaria", interval: 1 })).toBe("Todo dia");
  });

  it("dias ocupados por um compromisso de vários dias", () => {
    expect(spanDays("2026-11-18", null)).toBe(1);
    expect(spanDays("2026-11-18", "2026-11-20")).toBe(3);
    expect(spanDays("2026-11-18", "2026-11-10")).toBe(1);
  });
});

describe("conflitos", () => {
  const slot = (key: string, startTime: string | null, endTime: string | null, people: number[], extra: Partial<BusySlot> = {}): BusySlot => ({
    key,
    title: key,
    date: "2026-11-18",
    startTime,
    endTime,
    people,
    ...extra,
  });

  it("sobreposição com pessoa em comum é conflito; encostar não é", () => {
    const others = [slot("a", "09:00", "10:00", [1]), slot("b", "10:00", "11:00", [1]), slot("c", "09:30", "10:30", [2])];
    const conflicts = findConflicts(slot("novo", "09:30", "10:00", [1, 3]), others);
    expect(conflicts.map((c) => c.key)).toEqual(["a"]);
    expect(conflicts[0].people).toEqual([1]);
  });

  it("sem fim vale uma hora; outro dia e o próprio compromisso não contam", () => {
    const others = [slot("a", "09:00", null, [1]), slot("x", "09:00", "10:00", [1], { date: "2026-11-19" }), slot("novo", "08:00", "12:00", [1])];
    expect(findConflicts(slot("novo", "09:59", "10:30", [1]), others).map((c) => c.key)).toEqual(["a"]);
    expect(findConflicts(slot("novo", "10:00", "10:30", [1]), others)).toEqual([]);
  });

  it("dia inteiro só ocupa quando é bloqueio (férias, indisponibilidade)", () => {
    const feriado = slot("feriado", null, null, [1]);
    const ferias = slot("ferias", null, null, [1], { blocksDay: true });
    expect(findConflicts(slot("novo", "14:00", "15:00", [1]), [feriado])).toEqual([]);
    expect(findConflicts(slot("novo", "14:00", "15:00", [1]), [ferias]).map((c) => c.key)).toEqual(["ferias"]);
    expect(findConflicts(slot("novo", null, null, [1]), [slot("a", "09:00", "10:00", [1])])).toEqual([]);
  });

  it("janelas livres no expediente", () => {
    const slots = [
      { startTime: "09:00", endTime: "10:30" },
      { startTime: "10:00", endTime: "11:00" },
      { startTime: "14:00", endTime: null },
    ];
    expect(freeWindows(slots, "08:00", "18:00")).toEqual([
      { start: "08:00", end: "09:00" },
      { start: "11:00", end: "14:00" },
      { start: "15:00", end: "18:00" },
    ]);
    expect(freeWindows([{ startTime: null, endTime: null, blocksDay: true }])).toEqual([]);
  });
});

describe("grade do dia", () => {
  it("compromissos sobrepostos dividem a largura; isolados ocupam tudo", () => {
    const placed = layoutDay([
      { key: "a", startTime: "09:00", endTime: "10:00" },
      { key: "b", startTime: "09:30", endTime: "10:30" },
      { key: "c", startTime: "10:00", endTime: "11:00" },
      { key: "d", startTime: "13:00", endTime: "14:00" },
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.key, p]));
    expect(by.a).toMatchObject({ top: 540, height: 60, column: 0, columns: 2 });
    expect(by.b).toMatchObject({ column: 1, columns: 2 });
    expect(by.c).toMatchObject({ column: 0, columns: 2 });
    expect(by.d).toMatchObject({ top: 780, column: 0, columns: 1 });
  });

  it("intervalos e arrastar", () => {
    expect(minuteRange(null, null)).toEqual([0, 1440]);
    expect(minuteRange("23:30", null)).toEqual([1410, 1440]);
    expect(moveTimes("09:00", "10:30", 14 * 60 + 7)).toEqual({ startTime: "14:00", endTime: "15:30" });
    expect(moveTimes("09:00", null, 8 * 60 + 53)).toEqual({ startTime: "09:00", endTime: null });
    expect(moveTimes("09:00", "12:00", 23 * 60)).toEqual({ startTime: "21:00", endTime: "23:59" });
  });
});
