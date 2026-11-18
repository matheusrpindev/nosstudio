import { describe, expect, it } from "vitest";
import {
  groupByDay,
  normalizeEventTimes,
  projectDeadlineEntries,
  sortAgenda,
  upcomingEnd,
  validateEventTimes,
  type AgendaEntry,
  type ProjectDeadlineRow,
} from "./logic";

describe("validateEventTimes", () => {
  it("dia inteiro não exige horários", () => {
    expect(
      validateEventTimes({ allDay: true, startTime: null, endTime: null }),
    ).toEqual({});
    expect(
      validateEventTimes({
        allDay: true,
        startTime: "10:00",
        endTime: "09:00",
      }),
    ).toEqual({});
  });
  it("exige início quando não é dia inteiro", () => {
    expect(
      validateEventTimes({ allDay: false, startTime: null, endTime: null })
        .startTime,
    ).toMatch(/início/);
    expect(
      validateEventTimes({ allDay: false, startTime: null, endTime: "10:00" })
        .startTime,
    ).toBeDefined();
  });
  it("fim precisa ser depois do início", () => {
    expect(
      validateEventTimes({
        allDay: false,
        startTime: "10:00",
        endTime: "10:00",
      }).endTime,
    ).toMatch(/depois/);
    expect(
      validateEventTimes({
        allDay: false,
        startTime: "10:00",
        endTime: "09:30",
      }).endTime,
    ).toBeDefined();
    expect(
      validateEventTimes({
        allDay: false,
        startTime: "10:00",
        endTime: "10:01",
      }),
    ).toEqual({});
    expect(
      validateEventTimes({ allDay: false, startTime: "10:00", endTime: null }),
    ).toEqual({});
  });
});

describe("normalizeEventTimes", () => {
  it("dia inteiro zera os horários", () => {
    expect(
      normalizeEventTimes({
        allDay: true,
        startTime: "10:00",
        endTime: "11:00",
      }),
    ).toEqual({ startTime: null, endTime: null });
  });
  it("mantém início e fim", () => {
    expect(
      normalizeEventTimes({
        allDay: false,
        startTime: "10:00",
        endTime: "11:00",
      }),
    ).toEqual({ startTime: "10:00", endTime: "11:00" });
    expect(
      normalizeEventTimes({ allDay: false, startTime: "10:00", endTime: null }),
    ).toEqual({ startTime: "10:00", endTime: null });
  });
});

const project = (
  over: Partial<ProjectDeadlineRow> = {},
): ProjectDeadlineRow => ({
  id: 1,
  title: "Casamento",
  stage: "edicao",
  eventDate: "2026-11-20",
  shootDeadline: "2026-11-22",
  deliveryDeadline: "2026-12-10",
  deliveredAt: null,
  location: "",
  clientName: "Ana",
  ownerName: "Laura",
  ...over,
});

describe("projectDeadlineEntries", () => {
  it("gera um item por data dentro do intervalo, ligado ao projeto", () => {
    const entries = projectDeadlineEntries(
      [project()],
      "2026-11-01",
      "2026-11-30",
    );
    expect(entries.map((e) => [e.key, e.kind, e.date])).toEqual([
      ["p-1-evento", "evento", "2026-11-20"],
      ["p-1-gravacao", "gravacao", "2026-11-22"],
    ]);
    expect(entries[0]).toMatchObject({
      source: "deadline",
      href: "/painel/projetos/1",
      deadlineLabel: "Data do evento",
    });
  });
  it("ignora cancelados, e entrega de projeto já entregue", () => {
    expect(
      projectDeadlineEntries(
        [project({ stage: "cancelado" })],
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual([]);
    const delivered = projectDeadlineEntries(
      [project({ stage: "entregue" })],
      "2026-12-01",
      "2026-12-31",
    );
    expect(delivered).toEqual([]);
    expect(
      projectDeadlineEntries(
        [project({ deliveredAt: "2026-12-01" })],
        "2026-12-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });
  it("respeita o filtro de tipo", () => {
    const entries = projectDeadlineEntries(
      [project()],
      "2026-11-01",
      "2026-12-31",
      "entrega",
    );
    expect(entries.map((e) => e.key)).toEqual(["p-1-entrega"]);
  });
  it("datas nos limites entram", () => {
    expect(
      projectDeadlineEntries(
        [
          project({
            eventDate: "2026-11-01",
            shootDeadline: null,
            deliveryDeadline: null,
          }),
        ],
        "2026-11-01",
        "2026-11-01",
      ),
    ).toHaveLength(1);
  });
});

describe("sortAgenda / groupByDay", () => {
  const base = {
    source: "event",
    id: 1,
    kind: "outro",
    endTime: null,
    location: "",
    clientName: null,
    ownerName: null,
    href: "/x",
  } as const;
  const entry = (over: Partial<AgendaEntry>): AgendaEntry => ({
    ...base,
    key: "k",
    title: "T",
    date: "2026-11-18",
    startTime: null,
    ...over,
  });
  it("ordena por data, sem horário primeiro, depois horário; prazos depois dos compromissos", () => {
    const sorted = sortAgenda([
      entry({ key: "c", startTime: "14:00" }),
      entry({ key: "d", date: "2026-11-19" }),
      entry({ key: "b", source: "deadline" }),
      entry({ key: "a" }),
      entry({ key: "e", startTime: "09:00" }),
    ]);
    expect(sorted.map((e) => e.key)).toEqual(["a", "b", "e", "c", "d"]);
  });
  it("agrupa por dia preservando a ordem", () => {
    const groups = groupByDay([
      entry({ key: "a" }),
      entry({ key: "b" }),
      entry({ key: "c", date: "2026-11-20" }),
    ]);
    expect(groups.map((g) => [g.date, g.entries.length])).toEqual([
      ["2026-11-18", 2],
      ["2026-11-20", 1],
    ]);
  });
});

describe("upcomingEnd", () => {
  it("hoje conta como o primeiro dos 14 dias", () => {
    expect(upcomingEnd("2026-11-18", 14)).toBe("2026-12-01");
  });
});
