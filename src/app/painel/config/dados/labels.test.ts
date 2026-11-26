import { getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { EXPORT_EXCLUDED_TABLES } from "@/server/config/logic";
import { TABLE_LABELS } from "./labels";

/**
 * A exportação completa leva TODA tabela do schema que não esteja em `EXPORT_EXCLUDED_TABLES` — tabela nova entra
 * sozinha. Este teste obriga a decidir: ou a tabela ganha rótulo em `TABLE_LABELS` (entra na exportação e na
 * contagem de "Dados e backup"), ou vai para `EXPORT_EXCLUDED_TABLES`. Antes de dar o rótulo, confira se ela guarda
 * dado pessoal, credencial ou conteúdo de compromisso PARTICULAR da agenda (ver `src/server/config/data.ts`).
 */
describe("rótulos das tabelas exportadas", () => {
  const tables: string[] = [];
  for (const value of Object.values(schema)) if (is(value, SQLiteTable)) tables.push(getTableName(value));

  it("toda tabela do schema ou tem rótulo (é exportada) ou está na lista das que nunca saem", () => {
    const undecided = tables.filter((name) => !EXPORT_EXCLUDED_TABLES.has(name) && !(name in TABLE_LABELS));
    expect(undecided).toEqual([]);
  });

  it("não há rótulo de tabela que não existe, nem lista de exclusão com nome errado", () => {
    expect(Object.keys(TABLE_LABELS).filter((name) => !tables.includes(name))).toEqual([]);
    expect([...EXPORT_EXCLUDED_TABLES].filter((name) => !tables.includes(name))).toEqual([]);
  });

  it("as tabelas da agenda nova e da fundação de permissões têm rótulo", () => {
    for (const name of ["agenda_events", "agenda_categories", "agenda_calendars", "agenda_event_people", "agenda_checklist_templates", "project_members", "client_users"]) {
      expect(TABLE_LABELS[name], name).toBeTruthy();
    }
  });
});
