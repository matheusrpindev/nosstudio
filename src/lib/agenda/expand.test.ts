import { describe, expect, it } from "vitest";
import { busySlots } from "./busy";
import { findConflicts } from "./conflicts";
import { expandEvent, expandEvents, isOccurrence, nextOccurrence } from "./expand";
import type { Recurrence } from "./recurrence";
import { occurrencesBetween } from "./recurrence";
import { sameRule, shiftDates, splitSeries } from "./series";
import { itemsByDay, viewRange, type AgendaItem } from "./view";

const weekly: Recurrence = { freq: "semanal", interval: 1, weekdays: [1] }; // toda segunda
const event = (over: Partial<{ date: string; endDate: string | null; recurrence: unknown; recurrenceExceptions: string[] }> = {}) => ({
  date: "2026-11-02",
  endDate: null,
  recurrence: null as unknown,
  recurrenceExceptions: [] as string[],
  ...over,
});

describe("expansão de compromissos em ocorrências", () => {
  it("avulso: aparece só quando o dia cai na janela", () => {
    expect(expandEvent(event(), "2026-11-01", "2026-11-30").map((o) => o.date)).toEqual(["2026-11-02"]);
    expect(expandEvent(event(), "2026-11-03", "2026-11-30")).toEqual([]);
  });

  it("série semanal: uma ocorrência por segunda da janela, marcada como recorrente", () => {
    const occurrences = expandEvent(event({ recurrence: weekly }), "2026-11-01", "2026-11-30");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(occurrences.every((o) => o.recurring)).toBe(true);
  });

  it("exceções: o dia excluído (ou editado sozinho) não é gerado", () => {
    const occurrences = expandEvent(event({ recurrence: weekly, recurrenceExceptions: ["2026-11-09", "2026-11-23"] }), "2026-11-01", "2026-11-30");
    expect(occurrences.map((o) => o.date)).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
  });

  it("regra gravada como JSON estranho não quebra: vale como avulso", () => {
    expect(expandEvent(event({ recurrence: { freq: "quinzenal" } }), "2026-11-01", "2026-11-30").map((o) => o.date)).toEqual(["2026-11-02"]);
    expect(expandEvent(event({ recurrence: "x" }), "2026-11-01", "2026-11-30")).toHaveLength(1);
  });

  it("vários dias: entra na janela se algum dia tocar, com início e fim da ocorrência", () => {
    const trip = event({ date: "2026-11-28", endDate: "2026-12-02" });
    expect(expandEvent(trip, "2026-12-01", "2026-12-31")).toEqual([{ event: trip, date: "2026-11-28", endDate: "2026-12-02", recurring: false }]);
    expect(expandEvent(trip, "2026-12-03", "2026-12-31")).toEqual([]);
    // série de dois dias (sábado e domingo), todo mês no dia 7
    const monthly = event({ date: "2026-11-07", endDate: "2026-11-08", recurrence: { freq: "mensal", interval: 1 } });
    expect(expandEvent(monthly, "2026-12-08", "2026-12-31").map((o) => [o.date, o.endDate])).toEqual([["2026-12-07", "2026-12-08"]]);
  });

  it("isOccurrence / nextOccurrence respeitam a regra e as exceções", () => {
    const series = event({ recurrence: weekly, recurrenceExceptions: ["2026-11-09"] });
    expect(isOccurrence(series, "2026-11-16")).toBe(true);
    expect(isOccurrence(series, "2026-11-09")).toBe(false); // exceção
    expect(isOccurrence(series, "2026-11-10")).toBe(false); // terça
    expect(nextOccurrence(series, "2026-11-03")).toBe("2026-11-16");
    expect(nextOccurrence(event(), "2030-01-01")).toBe("2026-11-02");
  });

  it("expandEvents junta várias linhas", () => {
    expect(expandEvents([event(), event({ date: "2026-11-05" })], "2026-11-01", "2026-11-30")).toHaveLength(2);
  });
});

describe("“este e os seguintes”: corte da série", () => {
  it("a cabeça termina na véspera e a cauda continua a regra", () => {
    const split = splitSeries("2026-11-02", weekly, [], "2026-11-16");
    expect(split.head?.rule.until).toBe("2026-11-15");
    expect(occurrencesBetween("2026-11-02", split.head!.rule, "2026-11-01", "2026-12-31")).toEqual(["2026-11-02", "2026-11-09"]);
    expect(occurrencesBetween("2026-11-16", split.tail.rule, "2026-11-01", "2026-12-07")).toEqual(["2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"]);
  });

  it("limite “N vezes” é repartido entre cabeça e cauda (as exceções consomem o limite)", () => {
    const rule: Recurrence = { ...weekly, count: 6 };
    const split = splitSeries("2026-11-02", rule, ["2026-11-09"], "2026-11-23");
    // antes do corte a regra gerou 3 datas (02, 09 — exceção —, 16): sobram 3 para a cauda
    expect(split.tail.rule.count).toBe(3);
    expect(split.head?.rule.count).toBeUndefined();
    expect(split.head?.exceptions).toEqual(["2026-11-09"]);
    expect(split.tail.exceptions).toEqual([]);
    const head = occurrencesBetween("2026-11-02", split.head!.rule, "2026-01-01", "2027-12-31", split.head!.exceptions);
    const tail = occurrencesBetween("2026-11-23", split.tail.rule, "2026-01-01", "2027-12-31", split.tail.exceptions);
    expect([...head, ...tail]).toEqual(occurrencesBetween("2026-11-02", rule, "2026-01-01", "2027-12-31", ["2026-11-09"]));
  });

  it("exceções a partir do corte vão para a cauda", () => {
    const split = splitSeries("2026-11-02", weekly, ["2026-11-09", "2026-11-30"], "2026-11-16");
    expect(split.head?.exceptions).toEqual(["2026-11-09"]);
    expect(split.tail.exceptions).toEqual(["2026-11-30"]);
  });

  it("corte na primeira ocorrência (ou quando nada acontece antes): não sobra cabeça", () => {
    expect(splitSeries("2026-11-02", weekly, [], "2026-11-02").head).toBeNull();
    expect(splitSeries("2026-11-02", weekly, ["2026-11-02"], "2026-11-09").head).toBeNull();
  });

  it("shiftDates e sameRule", () => {
    expect(shiftDates(["2026-11-09", "2026-11-16"], "2026-11-02", "2026-11-04")).toEqual(["2026-11-11", "2026-11-18"]);
    expect(shiftDates(["2026-11-09"], "2026-11-02", "2026-11-02")).toEqual(["2026-11-09"]);
    expect(sameRule(weekly, { interval: 1, freq: "semanal", weekdays: [1] })).toBe(true);
    expect(sameRule(weekly, { ...weekly, count: 3 })).toBe(false);
    expect(sameRule(null, null)).toBe(true);
    expect(sameRule(weekly, null)).toBe(false);
  });
});

describe("faixas ocupadas (entrada de findConflicts)", () => {
  const source = { key: "a", title: "A", people: [1], blocksDay: false };

  it("um dia: uma faixa com o próprio horário", () => {
    expect(busySlots({ ...source, date: "2026-11-10", endDate: "2026-11-10", startTime: "09:00", endTime: "10:00" })).toEqual([
      { key: "a", title: "A", people: [1], date: "2026-11-10", startTime: "09:00", endTime: "10:00", blocksDay: false },
    ]);
  });

  it("vários dias com horário: do início ao fim do 1º dia, dias do meio inteiros, último até o fim marcado", () => {
    const slots = busySlots({ ...source, date: "2026-11-10", endDate: "2026-11-12", startTime: "20:00", endTime: "11:00" });
    expect(slots.map((slot) => [slot.date, slot.startTime, slot.endTime, slot.blocksDay ?? false])).toEqual([
      ["2026-11-10", "20:00", "23:59", false],
      ["2026-11-11", null, null, true],
      ["2026-11-12", "00:00", "11:00", false],
    ]);
    // reunião no dia do meio choca; na manhã do primeiro dia, não
    const meeting = (date: string) => ({ key: "m", title: "M", date, startTime: "09:00", endTime: "10:00", people: [1] });
    expect(findConflicts(meeting("2026-11-11"), slots)).toHaveLength(1);
    expect(findConflicts(meeting("2026-11-10"), slots)).toHaveLength(0);
    expect(findConflicts(meeting("2026-11-12"), slots)).toHaveLength(1);
  });

  it("férias (dia inteiro que bloqueia) ocupam todos os dias; dia inteiro comum não ocupa", () => {
    const vacation = busySlots({ ...source, date: "2026-12-20", endDate: "2026-12-22", startTime: null, endTime: null, blocksDay: true });
    expect(vacation).toHaveLength(3);
    const meeting = { key: "m", title: "M", date: "2026-12-21", startTime: "09:00", endTime: "10:00", people: [1] };
    expect(findConflicts(meeting, vacation)).toHaveLength(1);
    const reminder = busySlots({ ...source, date: "2026-12-20", endDate: "2026-12-22", startTime: null, endTime: null, blocksDay: false });
    expect(findConflicts(meeting, reminder)).toHaveLength(0);
  });
});

describe("apoio às visões", () => {
  const item = (over: Partial<AgendaItem>): AgendaItem => ({
    key: "e-1",
    source: "event",
    id: 1,
    title: "A",
    date: "2026-11-10",
    endDate: "2026-11-10",
    startTime: "09:00",
    endTime: null,
    color: "roxo",
    icon: null,
    href: "#",
    masked: false,
    status: "confirmado",
    priority: "normal",
    recurring: false,
    label: "",
    categoryId: null,
    calendarId: null,
    location: "",
    clientName: null,
    people: [],
    ownerName: null,
    ...over,
  });

  it("itemsByDay: vários dias aparecem em cada dia; dia inteiro vem antes dos com horário", () => {
    const days = ["2026-11-10", "2026-11-11"];
    const map = itemsByDay([item({ key: "t" }), item({ key: "d", startTime: null, endDate: "2026-11-11" })], days);
    expect(map.get("2026-11-10")?.map((entry) => entry.key)).toEqual(["d", "t"]);
    expect(map.get("2026-11-11")?.map((entry) => entry.key)).toEqual(["d"]);
  });

  it("viewRange: janelas de cada visão", () => {
    expect(viewRange("dia", "2026-11-26")).toMatchObject({ from: "2026-11-26", to: "2026-11-26", previous: "2026-11-25", next: "2026-11-27" });
    const week = viewRange("semana", "2026-11-26");
    expect([week.from, week.to, week.days.length]).toEqual(["2026-11-22", "2026-11-28", 7]);
    expect(viewRange("semana", "2026-12-01").title).toBe("Nov – dez de 2026");
    expect(viewRange("mes", "2026-11-26")).toMatchObject({ from: "2026-11-01", to: "2026-12-05", title: "Novembro de 2026", previous: "2026-10-01", next: "2026-12-01" });
    expect(viewRange("ano", "2026-11-26")).toMatchObject({ from: "2026-01-01", to: "2026-12-31", title: "2026", next: "2027-01-01" });
    expect(viewRange("lista", "2026-11-26")).toMatchObject({ from: "2026-11-26", to: "2027-01-24" });
  });
});
