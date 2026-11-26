import { describe, expect, it } from "vitest";
import { canSeeEvent, eventUserIds, toVisibleEvent, type EventRecord } from "./privacy";

const S = "SENTINELA";

/** Um compromisso particular com uma sentinela em TODO campo de conteúdo. */
function privateEvent(over: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 42,
    title: `${S}-titulo`,
    kind: "reuniao",
    categoryId: 7,
    calendarId: 9,
    description: `${S}-descricao`,
    date: "2026-12-01",
    endDate: "2026-12-02",
    startTime: "14:00",
    endTime: "15:30",
    location: `${S}-local`,
    mapUrl: `https://${S}.example/mapa`,
    meetingUrl: `https://${S}.example/reuniao`,
    clientId: 3,
    projectId: 4,
    ownerId: 10,
    priority: "alta",
    status: "confirmado",
    visibility: "particular",
    checklist: [{ id: "c1", text: `${S}-checklist`, done: false }],
    notes: `${S}-observacoes`,
    reminders: [{ minutes: 15, channel: "email" }],
    recurrence: { freq: "semanal", interval: 1 },
    recurrenceExceptions: ["2026-12-08"],
    seriesId: null,
    originalDate: null,
    attachments: [991, 992],
    production: {
      address: `${S}-endereco`,
      crewArrival: "13:00",
      script: `${S}-roteiro`,
      references: `${S}-referencias`,
      equipment: `${S}-equipamentos`,
      contentCount: 5,
      estimatedMinutes: 90,
      editDeadline: "2026-12-05",
      deliveryDate: "2026-12-06",
      prepChecklist: [{ id: "p1", text: `${S}-preparacao`, done: true }],
    },
    createdBy: 10,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    categoryName: `${S}-categoria`,
    categoryColor: "rosa",
    categoryIcon: "heart",
    categoryBlocksDay: true,
    categoryIsProduction: true,
    calendarName: `${S}-agenda`,
    calendarKind: "comercial",
    clientName: `${S}-cliente`,
    projectTitle: `${S}-projeto`,
    creatorName: "Dona do compromisso",
    people: [
      { userId: 10, role: "responsavel", name: "Dona do compromisso" },
      { userId: 11, role: "participante", name: `${S}-participante` },
      { userId: null, role: "externo", name: `${S}-externo` },
    ],
    ...over,
  };
}

describe("toVisibleEvent — a única saída de um compromisso", () => {
  it("quem não participa de um particular recebe só “Ocupado”, o horário e quem está ocupado", () => {
    const visible = toVisibleEvent(privateEvent(), 99);
    expect(visible).toEqual({
      masked: true,
      id: 42,
      title: "Ocupado",
      date: "2026-12-01",
      endDate: "2026-12-02",
      startTime: "14:00",
      endTime: "15:30",
      recurrence: { freq: "semanal", interval: 1 },
      recurrenceExceptions: ["2026-12-08"],
      cancelled: false,
      ownerId: 10,
      ownerName: "Dona do compromisso",
    });
  });

  it("nenhuma sentinela, id de cliente/projeto/categoria/agenda/anexo nem configuração sai no mascarado", () => {
    const json = JSON.stringify(toVisibleEvent(privateEvent(), 99));
    expect(json).not.toContain(S);
    for (const forbidden of ["clientId", "projectId", "categoryId", "calendarId", "attachments", "checklist", "notes", "reminders", "production", "people", "priority", "location", "Url", "description", "categoryColor"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(json).not.toMatch(/99[12]/); // ids dos anexos
  });

  it("o mascarado é uma lista de campos PERMITIDOS: um campo novo na linha não vaza", () => {
    const withNewColumn = { ...privateEvent(), segredoNovo: `${S}-coluna-futura` } as EventRecord;
    expect(JSON.stringify(toVisibleEvent(withNewColumn, 99))).not.toContain(S);
    expect(Object.keys(toVisibleEvent(privateEvent(), 99)).sort()).toEqual(
      ["cancelled", "date", "endDate", "endTime", "id", "masked", "ownerId", "ownerName", "recurrence", "recurrenceExceptions", "startTime", "title"].sort(),
    );
  });

  it("criador, responsável e participante veem tudo; externo (sem conta) não conta", () => {
    for (const viewer of [10, 11]) {
      const visible = toVisibleEvent(privateEvent(), viewer);
      expect(visible.masked).toBe(false);
      expect(JSON.stringify(visible)).toContain(`${S}-titulo`);
    }
    // criado por outra pessoa em nome dela: o criador continua vendo
    expect(toVisibleEvent(privateEvent({ createdBy: 55 }), 55).masked).toBe(false);
    expect(eventUserIds(privateEvent({ createdBy: 55 })).sort()).toEqual([10, 11, 55]);
  });

  it("administrador não é exceção: a regra é participar, não o perfil (a função nem recebe o perfil)", () => {
    expect(canSeeEvent(privateEvent(), 1)).toBe(false);
    expect(toVisibleEvent.length).toBe(2);
  });

  it("compromisso normal sai inteiro para qualquer pessoa", () => {
    const visible = toVisibleEvent(privateEvent({ visibility: "normal" }), 99);
    expect(visible.masked).toBe(false);
    expect(visible.title).toBe(`${S}-titulo`);
  });

  it("particular cancelado avisa que não ocupa mais (para a tela não desenhar o bloco)", () => {
    const visible = toVisibleEvent(privateEvent({ status: "cancelado" }), 99);
    expect(visible.masked && visible.cancelled).toBe(true);
  });

  it("particular sem dono conhecido (conta apagada): mascarado, sem nome", () => {
    const visible = toVisibleEvent(privateEvent({ createdBy: null, creatorName: null, people: [] }), 99);
    expect(visible).toMatchObject({ masked: true, ownerId: null, ownerName: null });
  });
});
