import { describe, expect, it } from "vitest";
import { describeDeadline, groupByDay, plural, proposalDeadlineState, sortImportantTasks, taskState } from "./logic";

const today = "2026-11-18";

describe("proposalDeadlineState", () => {
  it("classifica o prazo de validade", () => {
    expect(proposalDeadlineState(null, today)).toBe("sem_prazo");
    expect(proposalDeadlineState("2026-11-17", today)).toBe("vencido");
    expect(proposalDeadlineState("2026-11-18", today)).toBe("vence_logo");
    expect(proposalDeadlineState("2026-11-21", today)).toBe("vence_logo");
    expect(proposalDeadlineState("2026-11-22", today)).toBe("ok");
  });
});

describe("describeDeadline", () => {
  it("descreve em linguagem natural", () => {
    expect(describeDeadline("2026-11-18", today)).toBe("vence hoje");
    expect(describeDeadline("2026-11-19", today)).toBe("vence amanhã");
    expect(describeDeadline("2026-11-21", today)).toBe("vence em 3 dias");
    expect(describeDeadline("2026-11-17", today)).toBe("venceu há 1 dia");
    expect(describeDeadline("2026-11-10", today)).toBe("venceu há 8 dias");
    expect(describeDeadline("2026-11-10", today, "prazo")).toBe("atrasada há 8 dias");
    expect(describeDeadline("2026-08-10", today)).toBe("venceu em 10/08/2026");
  });
});

describe("plural", () => {
  it("escolhe singular ou plural", () => {
    expect(plural(1, "orçamento", "orçamentos")).toBe("1 orçamento");
    expect(plural(0, "orçamento", "orçamentos")).toBe("0 orçamentos");
  });
});

describe("groupByDay", () => {
  it("agrupa dias consecutivos iguais", () => {
    const groups = groupByDay([
      { date: "2026-11-18", n: 1 },
      { date: "2026-11-18", n: 2 },
      { date: "2026-11-20", n: 3 },
    ]);
    expect(groups.map((g) => [g.date, g.items.length])).toEqual([
      ["2026-11-18", 2],
      ["2026-11-20", 1],
    ]);
  });
});

describe("tarefas importantes", () => {
  it("ordena atrasadas, hoje e prioridade alta", () => {
    const rows = [
      { id: 1, dueDate: null, priority: "alta" as const },
      { id: 2, dueDate: "2026-11-18", priority: "normal" as const },
      { id: 3, dueDate: "2026-11-10", priority: "baixa" as const },
      { id: 4, dueDate: "2026-11-25", priority: "alta" as const },
      { id: 5, dueDate: "2026-11-12", priority: "normal" as const },
    ];
    expect(sortImportantTasks(rows, today).map((r) => r.id)).toEqual([3, 5, 2, 4, 1]);
  });
  it("taskState", () => {
    expect(taskState(null, today)).toBe("futura");
    expect(taskState("2026-11-17", today)).toBe("atrasada");
    expect(taskState(today, today)).toBe("hoje");
  });
});
