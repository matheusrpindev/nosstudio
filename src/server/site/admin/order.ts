/**
 * Utilitários compartilhados das coleções do editor do site: ordem (subir/descer) e slug único.
 * Só fala com o banco; quem autoriza e valida são as Server Actions em `src/app/painel/site/<coleção>/actions.ts`.
 */
import "server-only";
import { and, asc, eq, ne, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { slugify } from "@/lib/format";

/** Tabela com as colunas `id` e `sortOrder` (todas as coleções do site têm). */
export type OrderedTable = SQLiteTable & { id: SQLiteColumn; sortOrder: SQLiteColumn };

export type MoveDirection = "up" | "down";

/** Próximo número de ordem: o item novo vai para o fim da lista. */
export async function nextSortOrder(table: OrderedTable): Promise<number> {
  const [row] = await db.select({ max: sql<number | null>`max(${table.sortOrder})` }).from(table);
  return (row?.max ?? -1) + 1;
}

/**
 * Troca o item de lugar com o vizinho. A ordem exibida (`sortOrder`, depois `id`) é renumerada de 0 a N-1,
 * então itens que tinham o mesmo número (ex.: criados pelo seed) passam a ter posições distintas.
 * `scope`: restringe a lista a um grupo (ex.: só os planos mensais). Devolve `false` se o item não existe ou já está na ponta.
 */
export async function moveInOrder(table: OrderedTable, id: number, direction: MoveDirection, tiebreak: "asc" | "desc" = "asc", scope?: SQL): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: table.id })
      .from(table)
      .where(scope)
      .orderBy(asc(table.sortOrder), tiebreak === "asc" ? asc(table.id) : sql`${table.id} desc`);
    const ids = rows.map((row) => Number(row.id));
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= ids.length) return false;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    for (const [position, itemId] of ids.entries()) {
      await tx.update(table).set({ sortOrder: position } as never).where(eq(table.id, itemId));
    }
    return true;
  });
}

/**
 * Slug único dentro da tabela. Parte do texto dado (`slugify`) e acrescenta `-2`, `-3`… se já existir.
 * `exceptId`: ignora o próprio registro ao editar.
 */
export async function uniqueSlug(table: SQLiteTable & { id: SQLiteColumn; slug: SQLiteColumn }, text: string, exceptId?: number): Promise<string> {
  const base = slugify(text) || "item";
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    if (!(await slugTaken(table, candidate, exceptId))) return candidate;
  }
  return `${base.slice(0, 60)}-${Date.now()}`;
}

/** O slug já pertence a outro registro? */
export async function slugTaken(table: SQLiteTable & { id: SQLiteColumn; slug: SQLiteColumn }, slug: string, exceptId?: number): Promise<boolean> {
  const conditions: (SQL | undefined)[] = [eq(table.slug, slug)];
  if (exceptId !== undefined) conditions.push(ne(table.id, exceptId));
  const [row] = await db.select({ id: table.id }).from(table).where(and(...conditions)).limit(1);
  return Boolean(row);
}
