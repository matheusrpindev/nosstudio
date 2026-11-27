/**
 * O arquivo .ics gerado é lido de volta por um leitor mínimo de iCalendar (`./ics-reader.ts`: desdobra linhas,
 * separa propriedades e parâmetros, monta os componentes) e conferido contra os campos obrigatórios do RFC 5545.
 */
import { describe, expect, it } from "vitest";
import { occurrencesBetween, type Recurrence } from "./recurrence";
import { buildCalendar, escapeText, foldLine, rrule, type IcsEvent } from "./ics";
import { events, parseIcs, prop, props, unescape } from "./ics-reader";

const NOW = new Date("2026-11-26T15:04:05Z");
const event = (over: Partial<IcsEvent> = {}): IcsEvent => ({
  uid: "agenda-1@nos.test",
  title: "Reunião de pauta",
  date: "2026-12-01",
  endDate: "2026-12-01",
  startTime: "10:00",
  endTime: "11:30",
  recurrence: null,
  exceptions: [],
  status: "CONFIRMED",
  private: false,
  ...over,
});
const build = (list: IcsEvent[]) => buildCalendar(list, { name: "Agenda da NÓS", now: NOW });

describe("estrutura do arquivo", () => {
  it("VCALENDAR com os campos obrigatórios, fuso do estúdio e linhas em CRLF de até 75 octetos", () => {
    const text = build([event()]);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/); // nenhuma quebra solta
    for (const line of text.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);

    const calendar = parseIcs(text);
    expect(calendar.type).toBe("VCALENDAR");
    expect(prop(calendar, "VERSION")?.value).toBe("2.0");
    expect(prop(calendar, "PRODID")?.value).toBeTruthy();
    const timezone = calendar.children.find((child) => child.type === "VTIMEZONE");
    expect(prop(timezone!, "TZID")?.value).toBe("America/Sao_Paulo");
    const standard = timezone!.children.find((child) => child.type === "STANDARD")!;
    expect(prop(standard, "TZOFFSETFROM")?.value).toBe("-0300");
    expect(prop(standard, "TZOFFSETTO")?.value).toBe("-0300");
    expect(prop(standard, "DTSTART")?.value).toMatch(/^\d{8}T\d{6}$/);
  });

  it("todo VEVENT tem UID, DTSTAMP (UTC) e DTSTART; DTEND depois do início", () => {
    const calendar = parseIcs(build([event(), event({ uid: "agenda-2@nos.test", startTime: null, endTime: null, endDate: "2026-12-03" }), event({ uid: "agenda-3@nos.test", endTime: null })]));
    const list = events(calendar);
    expect(list).toHaveLength(3);
    for (const item of list) {
      expect(prop(item, "UID")?.value).toMatch(/^agenda-\d+@nos\.test$/);
      expect(prop(item, "DTSTAMP")?.value).toBe("20261126T150405Z");
      expect(prop(item, "DTSTART")).toBeDefined();
      expect(prop(item, "SUMMARY")?.value).toBeTruthy();
      expect(prop(item, "DTEND")!.value > prop(item, "DTSTART")!.value).toBe(true);
    }
    expect(new Set(list.map((item) => prop(item, "UID")?.value)).size).toBe(3);
  });

  it("com hora: horário local com TZID; dia inteiro: VALUE=DATE com fim exclusivo; sem fim: 1 hora", () => {
    const [timed, allDay, open] = events(parseIcs(build([event(), event({ uid: "b", startTime: null, endTime: null, endDate: "2026-12-03" }), event({ uid: "c", endTime: null })])));
    expect(prop(timed, "DTSTART")).toMatchObject({ params: { TZID: "America/Sao_Paulo" }, value: "20261201T100000" });
    expect(prop(timed, "DTEND")).toMatchObject({ params: { TZID: "America/Sao_Paulo" }, value: "20261201T113000" });
    expect(prop(allDay, "DTSTART")).toMatchObject({ params: { VALUE: "DATE" }, value: "20261201" });
    expect(prop(allDay, "DTEND")).toMatchObject({ params: { VALUE: "DATE" }, value: "20261204" });
    expect(prop(open, "DTEND")?.value).toBe("20261201T110000");
  });

  it("vira a noite: o fim cai no dia seguinte", () => {
    const [night] = events(parseIcs(build([event({ date: "2026-12-11", endDate: "2026-12-12", startTime: "22:00", endTime: "02:00" })])));
    expect(prop(night, "DTSTART")?.value).toBe("20261211T220000");
    expect(prop(night, "DTEND")?.value).toBe("20261212T020000");
  });
});

describe("texto", () => {
  it("escapa vírgula, ponto e vírgula, barra e quebra de linha — e o leitor devolve o original", () => {
    const title = "Gravação; cliente, sócio \\ equipe";
    const description = "Linha 1\nLinha 2, com vírgula; e ponto e vírgula";
    const [item] = events(parseIcs(build([event({ title, description, location: "Rua A, 10; fundos" })])));
    expect(unescape(prop(item, "SUMMARY")!.value)).toBe(title);
    expect(unescape(prop(item, "DESCRIPTION")!.value)).toBe(description);
    expect(unescape(prop(item, "LOCATION")!.value)).toBe("Rua A, 10; fundos");
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
  });

  it("dobra linhas longas sem partir caracteres acentuados", () => {
    const long = `SUMMARY:${"Reunião de produção ção ção ".repeat(12)}`;
    const folded = foldLine(long);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
    expect(foldLine("SUMMARY:curta")).toBe("SUMMARY:curta");
  });
});

describe("repetição: RRULE e EXDATE", () => {
  it("cada frequência vira a regra equivalente", () => {
    expect(rrule("2026-12-02", { freq: "diaria", interval: 1 }, false)).toBe("FREQ=DAILY");
    expect(rrule("2026-12-02", { freq: "diaria", interval: 3, count: 5 }, false)).toBe("FREQ=DAILY;INTERVAL=3;COUNT=5");
    // semanal sem dias marcados = o dia da semana do início (02/12/2026 é quarta)
    expect(rrule("2026-12-02", { freq: "semanal", interval: 1 }, false)).toBe("FREQ=WEEKLY;BYDAY=WE;WKST=SU");
    expect(rrule("2026-12-02", { freq: "semanal", interval: 2, weekdays: [5, 1, 3] }, false)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;WKST=SU");
    expect(rrule("2026-01-31", { freq: "mensal", interval: 1 }, false)).toBe("FREQ=MONTHLY;BYMONTHDAY=31");
    expect(rrule("2026-03-15", { freq: "anual", interval: 1 }, true)).toBe("FREQ=YEARLY");
  });

  it("“até” vira UNTIL: fim do dia local em UTC (com hora) ou data pura (dia inteiro)", () => {
    expect(rrule("2026-12-02", { freq: "semanal", interval: 1, until: "2026-12-30" }, false)).toBe("FREQ=WEEKLY;BYDAY=WE;WKST=SU;UNTIL=20261231T025959Z");
    expect(rrule("2026-12-02", { freq: "diaria", interval: 1, until: "2026-12-30" }, true)).toBe("FREQ=DAILY;UNTIL=20261230");
  });

  it("“até” e “N vezes” juntos: o RFC não aceita os dois — sai o UNTIL do que vier antes", () => {
    // 3 vezes a partir de 02/12 termina em 16/12, antes de 30/12
    expect(rrule("2026-12-02", { freq: "semanal", interval: 1, until: "2026-12-30", count: 3 }, true)).toBe("FREQ=WEEKLY;BYDAY=WE;WKST=SU;UNTIL=20261216");
    const text = rrule("2026-12-02", { freq: "semanal", interval: 1, until: "2026-12-09", count: 30 }, true);
    expect(text).toContain("UNTIL=20261209");
    expect(text).not.toContain("COUNT");
  });

  it("as exceções saem como EXDATE no mesmo formato do início", () => {
    const rule: Recurrence = { freq: "semanal", interval: 1, count: 6 };
    const [timed, allDay] = events(
      parseIcs(build([event({ date: "2026-12-02", endDate: "2026-12-02", recurrence: rule, exceptions: ["2026-12-16", "2026-12-09", "2026-12-09"] }), event({ uid: "d", date: "2026-12-02", endDate: "2026-12-02", startTime: null, endTime: null, recurrence: rule, exceptions: ["2026-12-23"] })])),
    );
    expect(prop(timed, "RRULE")?.value).toBe("FREQ=WEEKLY;BYDAY=WE;WKST=SU;COUNT=6");
    expect(props(timed, "EXDATE").map((item) => [item.params.TZID, item.value])).toEqual([
      ["America/Sao_Paulo", "20261209T100000"],
      ["America/Sao_Paulo", "20261216T100000"],
    ]);
    expect(props(allDay, "EXDATE").map((item) => [item.params.VALUE, item.value])).toEqual([["DATE", "20261223"]]);
    // a regra exportada descreve as mesmas datas que a agenda mostra (6 vezes, menos as 2 exceções)
    expect(occurrencesBetween("2026-12-02", rule, "2026-12-01", "2027-03-01", ["2026-12-09", "2026-12-16"])).toEqual(["2026-12-02", "2026-12-23", "2026-12-30", "2027-01-06"]);
  });

  it("sem repetição não há RRULE nem EXDATE", () => {
    const [single] = events(parseIcs(build([event({ exceptions: ["2026-12-01"] })])));
    expect(prop(single, "RRULE")).toBeUndefined();
    expect(prop(single, "EXDATE")).toBeUndefined();
  });
});

describe("status, privacidade e lembretes", () => {
  it("status e classe", () => {
    const [confirmed, tentative, cancelled, secret] = events(parseIcs(build([event(), event({ uid: "t", status: "TENTATIVE" }), event({ uid: "x", status: "CANCELLED" }), event({ uid: "p", private: true })])));
    expect(prop(confirmed, "STATUS")?.value).toBe("CONFIRMED");
    expect(prop(confirmed, "CLASS")?.value).toBe("PUBLIC");
    expect(prop(tentative, "STATUS")?.value).toBe("TENTATIVE");
    expect(prop(cancelled, "STATUS")?.value).toBe("CANCELLED");
    expect(prop(cancelled, "TRANSP")?.value).toBe("TRANSPARENT");
    expect(prop(secret, "CLASS")?.value).toBe("PRIVATE");
  });

  it("um “Ocupado” leva só o horário: sem descrição, local, categoria, link nem lembrete", () => {
    const [busy] = events(parseIcs(build([{ uid: "agenda-9@nos.test", title: "Ocupado", date: "2026-12-10", endDate: "2026-12-10", startTime: "16:00", endTime: "17:00", recurrence: null, exceptions: [], status: "CONFIRMED", private: true }])));
    expect(busy.props.map((item) => item.name).sort()).toEqual(["CLASS", "DTEND", "DTSTAMP", "DTSTART", "STATUS", "SUMMARY", "TRANSP", "UID"]);
    expect(busy.children).toEqual([]);
  });

  it("lembretes viram VALARM com a antecedência", () => {
    const [item] = events(parseIcs(build([event({ alarms: [15, 1440] })])));
    const alarms = item.children.filter((child) => child.type === "VALARM");
    expect(alarms.map((alarm) => [prop(alarm, "ACTION")?.value, prop(alarm, "TRIGGER")?.value])).toEqual([
      ["DISPLAY", "-PT15M"],
      ["DISPLAY", "-PT1440M"],
    ]);
  });
});
