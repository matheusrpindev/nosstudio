import { describe, expect, it } from "vitest";
import { commonFreeWindows, barSegment, suggestSlot } from "./availability";
import { applyPlacements, canDrag, canResize, gridSegment, moveInGrid, moveToDay, resizeEnd, samePlacement } from "./drag";
import { dayOffset, projectMilestones, spanInWindow } from "./timeline";
import { isAllDay, isOvernight, viewRange, type AgendaItem } from "./view";

const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  key: "e-1",
  source: "event",
  id: 1,
  title: "Reunião",
  date: "2026-12-08",
  endDate: "2026-12-08",
  startTime: "10:00",
  endTime: "11:00",
  color: "roxo",
  icon: null,
  href: "/painel/agenda/1",
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
  editable: true,
  seriesStart: null,
  projectId: null,
  ...over,
});

describe("o que pode ser arrastado", () => {
  it("compromisso próprio e ativo arrasta; mascarado, cancelado, de camada ou alheio, não", () => {
    expect(canDrag(item())).toBe(true);
    expect(canDrag(item({ status: "a_confirmar" }))).toBe(true);
    expect(canDrag(item({ masked: true, editable: false }))).toBe(false);
    expect(canDrag(item({ status: "cancelado" }))).toBe(false);
    expect(canDrag(item({ source: "deadline", editable: false }))).toBe(false);
    expect(canDrag(item({ source: "finance" }))).toBe(false);
    expect(canDrag(item({ editable: false }))).toBe(false);
  });

  it("só redimensiona compromisso com hora, de um dia só", () => {
    expect(canResize(item())).toBe(true);
    expect(canResize(item({ endTime: null }))).toBe(true);
    expect(canResize(item({ startTime: null, endTime: null }))).toBe(false);
    expect(canResize(item({ endDate: "2026-12-09" }))).toBe(false);
    expect(canResize(item({ status: "cancelado" }))).toBe(false);
  });
});

describe("arrastar na grade de horas", () => {
  it("muda dia e horário em passos de 15 min, mantendo a duração", () => {
    expect(moveInGrid(item(), "2026-12-10", 150)).toEqual({ date: "2026-12-10", endDate: "2026-12-10", startTime: "12:30", endTime: "13:30" });
    // 22 minutos encaixam em 15; 23 encaixam em 30
    expect(moveInGrid(item(), "2026-12-08", 22).startTime).toBe("10:15");
    expect(moveInGrid(item(), "2026-12-08", 23).startTime).toBe("10:30");
    expect(moveInGrid(item(), "2026-12-08", -37)).toMatchObject({ startTime: "09:30", endTime: "10:30" });
    // duração de 1h30 preservada
    expect(moveInGrid(item({ endTime: "11:30" }), "2026-12-09", 60)).toMatchObject({ startTime: "11:00", endTime: "12:30" });
  });

  it("não atravessa a meia-noite nem sai do dia", () => {
    expect(moveInGrid(item(), "2026-12-08", 20 * 60)).toMatchObject({ date: "2026-12-08", endDate: "2026-12-08", startTime: "23:00", endTime: "23:59" });
    expect(moveInGrid(item(), "2026-12-08", -20 * 60)).toMatchObject({ startTime: "00:00", endTime: "01:00" });
  });

  it("sem hora de fim continua sem; soltar no mesmo lugar não é mudança", () => {
    const open = item({ endTime: null });
    expect(moveInGrid(open, "2026-12-08", 60)).toEqual({ date: "2026-12-08", endDate: "2026-12-08", startTime: "11:00", endTime: null });
    expect(samePlacement(item(), moveInGrid(item(), "2026-12-08", 4))).toBe(true);
    expect(samePlacement(item(), moveInGrid(item(), "2026-12-09", 0))).toBe(false);
  });

  it("o que vira a noite continua virando (ou deixa de virar, se o novo horário couber no dia)", () => {
    const night = item({ date: "2026-12-11", endDate: "2026-12-12", startTime: "22:00", endTime: "02:00" });
    expect(isOvernight(night)).toBe(true);
    expect(isAllDay(night)).toBe(false);
    expect(moveInGrid(night, "2026-12-11", -60)).toEqual({ date: "2026-12-11", endDate: "2026-12-12", startTime: "21:00", endTime: "01:00" });
    expect(moveInGrid(night, "2026-12-09", -4 * 60)).toEqual({ date: "2026-12-09", endDate: "2026-12-09", startTime: "18:00", endTime: "22:00" });
    // 24 h ou mais, ou sem hora de fim, não é "vira a noite": fica na faixa de dia inteiro
    expect(isOvernight(item({ endDate: "2026-12-09", startTime: "10:00", endTime: "11:00" }))).toBe(false);
    expect(isAllDay(item({ endDate: "2026-12-09", startTime: "10:00", endTime: "11:00" }))).toBe(true);
    expect(isOvernight(item({ endDate: "2026-12-10", startTime: "22:00", endTime: "02:00" }))).toBe(false);
  });

  it("trechos na grade: um dia = um trecho; virando a noite = até 24:00 e depois de 00:00", () => {
    expect(gridSegment(item(), "2026-12-08")).toEqual({ startMinutes: 600, endMinutes: 660, continues: false, continued: false });
    expect(gridSegment(item(), "2026-12-09")).toBeNull();
    const night = item({ date: "2026-12-11", endDate: "2026-12-12", startTime: "22:00", endTime: "02:00" });
    expect(gridSegment(night, "2026-12-11")).toEqual({ startMinutes: 1320, endMinutes: 1440, continues: true, continued: false });
    expect(gridSegment(night, "2026-12-12")).toEqual({ startMinutes: 0, endMinutes: 120, continues: false, continued: true });
    expect(gridSegment(night, "2026-12-13")).toBeNull();
    expect(gridSegment(item({ startTime: null, endTime: null }), "2026-12-08")).toBeNull();
  });
});

describe("arrastar no mês e na faixa de dia inteiro", () => {
  it("muda só o dia: o horário e a duração em dias continuam", () => {
    expect(moveToDay(item(), "2026-12-17")).toEqual({ date: "2026-12-17", endDate: "2026-12-17", startTime: "10:00", endTime: "11:00" });
    const trip = item({ date: "2026-12-16", endDate: "2026-12-23", startTime: null, endTime: null });
    expect(moveToDay(trip, "2026-12-20")).toEqual({ date: "2026-12-20", endDate: "2026-12-27", startTime: null, endTime: null });
    // dia inteiro arrastado na grade de horas também só muda o dia
    expect(moveInGrid(trip, "2026-12-18", 300)).toEqual({ date: "2026-12-18", endDate: "2026-12-25", startTime: null, endTime: null });
  });
});

describe("redimensionar (borda de baixo)", () => {
  it("o fim anda em passos de 15 min; mínimo de 15 min; teto às 23:59", () => {
    expect(resizeEnd(item(), 45)).toMatchObject({ startTime: "10:00", endTime: "11:45" });
    expect(resizeEnd(item(), -30)).toMatchObject({ endTime: "10:30" });
    expect(resizeEnd(item(), -500)).toMatchObject({ endTime: "10:15" });
    expect(resizeEnd(item(), 24 * 60)).toMatchObject({ endTime: "23:59" });
    expect(resizeEnd(item(), 7)).toMatchObject({ endTime: "11:00" });
  });

  it("sem hora de fim, parte da duração padrão (1 h) e passa a ter fim", () => {
    expect(resizeEnd(item({ endTime: null }), 30)).toMatchObject({ startTime: "10:00", endTime: "11:30" });
  });
});

describe("atualização otimista", () => {
  it("aplica o movimento pendente só ao item da chave", () => {
    const items = [item(), item({ key: "e-2", id: 2 })];
    const moved = applyPlacements(items, new Map([["e-2", { date: "2026-12-09", endDate: "2026-12-09", startTime: "08:00", endTime: "09:00" }]]));
    expect(moved[0]).toBe(items[0]);
    expect(moved[1]).toMatchObject({ key: "e-2", date: "2026-12-09", startTime: "08:00", title: "Reunião" });
    expect(applyPlacements(items, new Map())).toEqual(items);
  });
});

describe("disponibilidade: janelas livres em comum", () => {
  const workday = { start: "08:00", end: "20:00" };
  const slot = (people: number[], startTime: string | null, endTime: string | null, blocksDay = false) => ({ people, startTime, endTime, blocksDay });

  it("cruza a ocupação de todas as pessoas selecionadas", () => {
    const slots = [slot([1], "10:00", "11:00"), slot([2], "15:00", "16:00"), slot([3], "08:00", "20:00")];
    expect(commonFreeWindows(slots, [1, 2], workday)).toEqual([
      { start: "08:00", end: "10:00" },
      { start: "11:00", end: "15:00" },
      { start: "16:00", end: "20:00" },
    ]);
    // só a pessoa 1: o compromisso da 2 não conta
    expect(commonFreeWindows(slots, [1], workday)).toEqual([
      { start: "08:00", end: "10:00" },
      { start: "11:00", end: "20:00" },
    ]);
  });

  it("bloqueio de dia inteiro (férias) zera o dia; dia inteiro que não bloqueia não tira nada; grupo vazio não tem janela", () => {
    expect(commonFreeWindows([slot([2], null, null, true)], [1, 2], workday)).toEqual([]);
    expect(commonFreeWindows([slot([2], null, null, false)], [1, 2], workday)).toEqual([{ start: "08:00", end: "20:00" }]);
    expect(commonFreeWindows([], [], workday)).toEqual([]);
  });

  it("sugestão de horário e barra do expediente", () => {
    expect(suggestSlot({ start: "11:00", end: "15:00" })).toEqual({ start: "11:00", end: "12:00" });
    expect(suggestSlot({ start: "11:00", end: "11:30" })).toEqual({ start: "11:00", end: "11:30" });
    expect(barSegment("08:00", "14:00", workday)).toEqual({ left: 0, width: 50 });
    expect(barSegment("06:00", "09:30", workday)).toEqual({ left: 0, width: 12.5 });
    expect(barSegment("21:00", "22:00", workday)).toBeNull();
    expect(barSegment(null, null, workday)).toEqual({ left: 0, width: 100 });
  });
});

describe("linha do tempo de projetos", () => {
  it("marcos: só os preenchidos, em ordem; entrega vencida sem entrega feita = atrasada", () => {
    const marks = projectMilestones({ startedOn: "2026-11-01", eventDate: "2026-12-12", shootDeadline: null, deliveryDeadline: "2026-11-20", deliveredAt: null }, "2026-11-26");
    expect(marks.map((mark) => [mark.kind, mark.date, mark.late])).toEqual([
      ["inicio", "2026-11-01", false],
      ["entrega", "2026-11-20", true],
      ["evento", "2026-12-12", false],
    ]);
    const delivered = projectMilestones({ startedOn: null, eventDate: null, shootDeadline: null, deliveryDeadline: "2026-11-20", deliveredAt: "2026-11-22" }, "2026-11-26");
    expect(delivered.map((mark) => [mark.kind, mark.late])).toEqual([
      ["entrega", false],
      ["entregue", false],
    ]);
  });

  it("posições na janela (cortando o que sai dela)", () => {
    expect(dayOffset("2026-12-01", "2026-12-10", "2026-12-06")).toBe(50);
    expect(spanInWindow("2026-12-01", "2026-12-10", "2026-12-03", "2026-12-04")).toEqual({ left: 20, width: 20 });
    expect(spanInWindow("2026-12-01", "2026-12-10", "2026-11-20", "2026-12-02")).toEqual({ left: 0, width: 20 });
    expect(spanInWindow("2026-12-01", "2026-12-10", "2026-12-20", "2026-12-22")).toBeNull();
  });

  it("janela das visões novas", () => {
    expect(viewRange("linha", "2026-12-08")).toMatchObject({ from: "2026-11-29", to: "2027-02-27", previous: "2026-11-10", next: "2027-01-05" });
    expect(viewRange("linha", "2026-12-08", { months: 6 }).to).toBe("2027-05-29");
    expect(viewRange("disponibilidade", "2026-12-08")).toMatchObject({ from: "2026-12-08", to: "2026-12-08", days: ["2026-12-08"] });
    expect(viewRange("disponibilidade", "2026-12-08", { mode: "semana" }).days).toHaveLength(7);
  });
});
