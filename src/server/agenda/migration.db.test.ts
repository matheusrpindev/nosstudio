/**
 * Migration 0002 (agenda central): num banco no estado ANTERIOR (0000 + 0001) com compromissos dos cinco tipos
 * antigos, aplicar a 0002 não perde nenhum compromisso e converte `kind` em categoria, agenda, criador e pessoa.
 * Também confere que as categorias e agendas inseridas pela migration são as de `src/lib/domain.ts`.
 */
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGENDA_DEFAULT_CALENDARS, AGENDA_DEFAULT_CATEGORIES } from "@/lib/domain";

const DRIZZLE = path.join(process.cwd(), "drizzle");
const statements = (file: string) =>
  readFileSync(path.join(DRIZZLE, file), "utf8")
    .split("--> statement-breakpoint")
    .map((sql) => sql.trim())
    .filter(Boolean);

let dir = "";
let client: Client;
const run = async (file: string) => {
  for (const sql of statements(file)) await client.execute(sql);
};
const rows = async (sql: string) => (await client.execute(sql)).rows as unknown as Record<string, unknown>[];

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "nos-agenda-migration-"));
  client = createClient({ url: `file:${path.join(dir, "antes.db")}` });
  await run("0000_inicial.sql");
  await run("0001_perfis_e_permissoes.sql");
  // estado anterior: contas (duas do painel, uma inativa, uma de cliente), um cliente e compromissos dos 5 tipos
  await client.execute(
    `INSERT INTO users (id, name, email, password_hash, role, active) VALUES
      (1, 'Pedro', 'p@x', 'x', 'admin', 1), (2, 'Laura', 'l@x', 'x', 'socio', 1),
      (3, 'Inativa', 'i@x', 'x', 'gestor', 0), (4, 'Cliente', 'c@x', 'x', 'cliente', 1), (5, 'Func', 'f@x', 'x', 'funcionario', 1)`,
  );
  await client.execute(`INSERT INTO clients (id, name) VALUES (1, 'Café')`);
  await client.execute(
    `INSERT INTO agenda_events (id, title, kind, date, start_time, end_time, location, client_id, owner_id, notes) VALUES
      (1, 'Gravação', 'gravacao', '2026-11-18', '09:00', '12:00', 'Café', 1, 2, 'levar luz'),
      (2, 'Evento', 'evento', '2026-11-19', NULL, NULL, '', NULL, 1, ''),
      (3, 'Reunião com cliente', 'reuniao', '2026-11-20', '19:30', '20:30', '', 1, 1, ''),
      (4, 'Reunião interna', 'reuniao', '2026-11-21', '10:00', NULL, '', NULL, NULL, ''),
      (5, 'Entrega', 'entrega', '2026-11-22', NULL, NULL, '', 1, 2, ''),
      (6, 'Outro', 'outro', '2026-11-23', '08:00', NULL, '', NULL, 1, '')`,
  );
  await run("0002_agenda_central.sql");
});

afterAll(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("migration 0002: tipos antigos → categorias", () => {
  it("nenhum compromisso se perde e os campos antigos ficam como estavam", async () => {
    const events = await rows("SELECT id, title, kind, date, start_time, end_time, location, client_id, owner_id, notes FROM agenda_events ORDER BY id");
    expect(events).toHaveLength(6);
    expect(events[0]).toEqual({ id: 1, title: "Gravação", kind: "gravacao", date: "2026-11-18", start_time: "09:00", end_time: "12:00", location: "Café", client_id: 1, owner_id: 2, notes: "levar luz" });
  });

  it("cada tipo vira a categoria certa (reunião com cliente × interna) e a agenda certa", async () => {
    const converted = await rows(
      `SELECT e.id, c.slug AS category, k.slug AS calendar, e.created_by
       FROM agenda_events e LEFT JOIN agenda_categories c ON c.id = e.category_id LEFT JOIN agenda_calendars k ON k.id = e.calendar_id ORDER BY e.id`,
    );
    expect(converted).toEqual([
      { id: 1, category: "gravacoes", calendar: "producoes", created_by: 2 },
      { id: 2, category: "eventos", calendar: "producoes", created_by: 1 },
      { id: 3, category: "reunioes-clientes", calendar: "geral", created_by: 1 },
      { id: 4, category: "reunioes-internas", calendar: "geral", created_by: null },
      { id: 5, category: "entregas", calendar: "geral", created_by: 2 },
      { id: 6, category: "outros", calendar: "geral", created_by: 1 },
    ]);
  });

  it("o responsável antigo vira a pessoa “responsável” do compromisso; sem responsável, ninguém", async () => {
    expect(await rows("SELECT event_id, user_id, role FROM agenda_event_people ORDER BY event_id")).toEqual([
      { event_id: 1, user_id: 2, role: "responsavel" },
      { event_id: 2, user_id: 1, role: "responsavel" },
      { event_id: 3, user_id: 1, role: "responsavel" },
      { event_id: 5, user_id: 2, role: "responsavel" },
      { event_id: 6, user_id: 1, role: "responsavel" },
    ]);
  });

  it("os campos novos nascem com os padrões (confirmado, normal, sem repetição)", async () => {
    const [event] = await rows("SELECT status, visibility, priority, recurrence, recurrence_exceptions, checklist, reminders, attachments, end_date, series_id, production, description FROM agenda_events WHERE id = 1");
    expect(event).toEqual({
      status: "confirmado",
      visibility: "normal",
      priority: "normal",
      recurrence: null,
      recurrence_exceptions: "[]",
      checklist: "[]",
      reminders: "[]",
      attachments: "[]",
      end_date: null,
      series_id: null,
      production: null,
      description: "",
    });
  });

  it("as categorias e agendas da migration são exatamente as de AGENDA_DEFAULT_* (domain.ts)", async () => {
    const categories = await rows("SELECT slug, name, color, icon, blocks_day, is_production, active FROM agenda_categories ORDER BY sort_order");
    expect(categories).toEqual(
      AGENDA_DEFAULT_CATEGORIES.map((category) => ({
        slug: category.slug,
        name: category.name,
        color: category.color,
        icon: category.icon,
        blocks_day: category.blocksDay ? 1 : 0,
        is_production: category.isProduction ? 1 : 0,
        active: 1,
      })),
    );
    const calendars = await rows("SELECT slug, name, kind, color FROM agenda_calendars WHERE kind <> 'pessoal' ORDER BY id");
    expect(calendars).toEqual(AGENDA_DEFAULT_CALENDARS.map(({ slug, name, kind, color }) => ({ slug, name, kind, color })));
  });

  it("agenda pessoal: uma para cada conta ATIVA que entra no painel (cliente e inativa ficam de fora)", async () => {
    expect(await rows("SELECT name, user_id, color FROM agenda_calendars WHERE kind = 'pessoal' ORDER BY user_id")).toEqual([
      { name: "Pedro", user_id: 1, color: "lavanda" },
      { name: "Laura", user_id: 2, color: "rosa" },
      { name: "Func", user_id: 5, color: "azul" },
    ]);
  });

  it("apagar a série apaga as ocorrências separadas dela (ON DELETE CASCADE de series_id)", async () => {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute(`INSERT INTO agenda_events (id, title, date, recurrence) VALUES (50, 'Série', '2026-12-01', '{"freq":"diaria","interval":1}')`);
    await client.execute(`INSERT INTO agenda_events (id, title, date, series_id, original_date) VALUES (51, 'Ocorrência', '2026-12-03', 50, '2026-12-02')`);
    await client.execute("DELETE FROM agenda_events WHERE id = 50");
    expect(await rows("SELECT id FROM agenda_events WHERE id IN (50, 51)")).toEqual([]);
    // categoria apagada à mão: o compromisso fica, sem categoria
    await client.execute("DELETE FROM agenda_categories WHERE slug = 'entregas'");
    expect(await rows("SELECT category_id FROM agenda_events WHERE id = 5")).toEqual([{ category_id: null }]);
  });
});
