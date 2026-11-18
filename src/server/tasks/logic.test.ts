import { describe, expect, it } from "vitest";
import {
  groupTasks,
  overdueDays,
  overdueLabel,
  taskGroupKey,
  type TaskView,
} from "./logic";

const TODAY = "2026-11-18";
const task = (over: Partial<TaskView>): TaskView => ({
  id: 1,
  title: "T",
  description: "",
  dueDate: null,
  priority: "normal",
  done: false,
  doneAt: null,
  ownerId: null,
  ownerName: null,
  clientId: null,
  clientName: null,
  projectId: null,
  projectTitle: null,
  ...over,
});

describe("taskGroupKey", () => {
  it("classifica pelo prazo", () => {
    expect(taskGroupKey(null, TODAY)).toBe("sem_data");
    expect(taskGroupKey("2026-11-17", TODAY)).toBe("atrasadas");
    expect(taskGroupKey("2026-11-18", TODAY)).toBe("hoje");
    expect(taskGroupKey("2026-11-19", TODAY)).toBe("semana");
    expect(taskGroupKey("2026-11-25", TODAY)).toBe("semana");
    expect(taskGroupKey("2026-11-26", TODAY)).toBe("depois");
  });
  it("vira o mês e o ano corretamente", () => {
    expect(taskGroupKey("2027-01-02", "2026-12-26")).toBe("semana");
    expect(taskGroupKey("2027-01-03", "2026-12-26")).toBe("depois");
  });
});

describe("groupTasks", () => {
  it("agrupa na ordem certa, omite grupos vazios e ignora concluídas", () => {
    const groups = groupTasks(
      [
        task({ id: 1, dueDate: "2026-12-30" }),
        task({ id: 2 }),
        task({ id: 3, dueDate: "2026-11-10" }),
        task({ id: 4, dueDate: "2026-11-18" }),
        task({ id: 5, dueDate: "2026-11-17", done: true }),
      ],
      TODAY,
    );
    expect(
      groups.map((g) => [g.key, g.label, g.tasks.map((t) => t.id)]),
    ).toEqual([
      ["atrasadas", "Atrasadas", [3]],
      ["hoje", "Hoje", [4]],
      ["depois", "Depois", [1]],
      ["sem_data", "Sem data", [2]],
    ]);
  });
  it("ordena por prazo, depois prioridade alta primeiro", () => {
    const [group] = groupTasks(
      [
        task({ id: 1, dueDate: "2026-11-20", priority: "normal" }),
        task({ id: 2, dueDate: "2026-11-20", priority: "alta" }),
        task({ id: 3, dueDate: "2026-11-19", priority: "baixa" }),
      ],
      TODAY,
    );
    expect(group.tasks.map((t) => t.id)).toEqual([3, 2, 1]);
  });
});

describe("overdueDays", () => {
  it("conta dias de atraso só para abertas com prazo vencido", () => {
    expect(overdueDays({ dueDate: "2026-11-15", done: false }, TODAY)).toBe(3);
    expect(overdueDays({ dueDate: "2026-11-18", done: false }, TODAY)).toBe(0);
    expect(overdueDays({ dueDate: "2026-11-01", done: true }, TODAY)).toBe(0);
    expect(overdueDays({ dueDate: null, done: false }, TODAY)).toBe(0);
  });
  it("texto singular/plural", () => {
    expect(overdueLabel(1)).toBe("Atrasada há 1 dia");
    expect(overdueLabel(3)).toBe("Atrasada há 3 dias");
  });
});
