/**
 * MOVER um compromisso (arrastar e soltar, redimensionar) e DESFAZER o movimento.
 *
 * Mover é um reagendamento: reaproveita `updateEventScoped` (com a pergunta de série). Para desfazer, a action
 * devolve ao navegador um "recibo" assinado (HMAC com `APP_SECRET`) com o estado anterior da linha e o que o
 * movimento criou ("só este" cria uma ocorrência avulsa; "este e os seguintes" cria uma série nova). Desfazer
 * confere a assinatura, o dono do recibo, a validade e se nada mudou desde então — e só então restaura.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents } from "@/db/schema";
import type { Recurrence } from "@/lib/agenda/recurrence";
import { addDays, diffDays, isISODate, isTime, type ISODate } from "@/lib/dates";
import type { AgendaSeriesScope } from "@/lib/domain";
import { env } from "@/lib/env";
import { canMutateEvent, type AgendaAccess } from "./access";
import type { EventInput } from "./input";
import { recordToInput, updateEventScoped, type ScopedResult } from "./mutations";
import type { EventRecord } from "./privacy";
import { loadEventRecord } from "./records";

export type MoveTarget = { date: ISODate; startTime: string | null; endTime: string | null };

/**
 * O formulário completo do compromisso com a nova data e o novo horário. Mantém a duração em dias; um
 * compromisso de dia inteiro continua de dia inteiro; sem hora de fim continua sem.
 */
export function moveInput(record: EventRecord, occurrence: ISODate | null, target: MoveTarget): { error: string } | { error: null; input: EventInput } {
  const base = recordToInput(record, occurrence);
  if (!isISODate(target.date)) return { error: "Data inválida." };
  const span = base.endDate ? diffDays(base.date, base.endDate) : 0;
  const endDate = span > 0 ? addDays(target.date, span) : null;
  if (base.startTime === null) return { error: null, input: { ...base, date: target.date, endDate } };
  if (!target.startTime || !isTime(target.startTime)) return { error: "Horário inválido." };
  const endTime = base.endTime === null ? null : target.endTime;
  if (base.endTime !== null && (!endTime || !isTime(endTime))) return { error: "Horário inválido." };
  if (endTime && span === 0 && endTime <= target.startTime) return { error: "O fim precisa ser depois do início." };
  // o que vira a noite (22:00 → 02:00) continua virando só se o novo fim ainda cair antes do novo início
  const overnight = span === 1 && base.endTime !== null && base.endTime <= base.startTime;
  const lastDay = overnight ? (endTime && endTime <= target.startTime ? addDays(target.date, 1) : null) : endDate;
  return { error: null, input: { ...base, date: target.date, endDate: lastDay, startTime: target.startTime, endTime } };
}

// ----------------------------------------------------------------- recibo
type Snapshot = {
  date: ISODate;
  endDate: ISODate | null;
  startTime: string | null;
  endTime: string | null;
  recurrence: Recurrence | null;
  exceptions: string[];
};

type Receipt = {
  /** Quem moveu. */
  u: number;
  /** O compromisso movido (a série, quando é uma). */
  id: number;
  /** A linha criada pelo movimento ("só este" / "este e os seguintes"), se houve. */
  c: number | null;
  /** Como a linha estava antes. */
  b: Snapshot;
  /** `updatedAt` das duas linhas logo depois do movimento: se mudaram, não dá mais para desfazer. */
  s: number;
  cs: number | null;
  /** Validade (ms). */
  x: number;
};

export const UNDO_TTL_MS = 10 * 60_000;

const sign = (body: string) => createHmac("sha256", env.appSecret).update(`agenda-undo:${body}`).digest("base64url");

function seal(receipt: Receipt): string {
  const body = Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function open(token: string): Receipt | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Receipt;
  } catch {
    return null;
  }
}

/** Move o compromisso e devolve, além do resultado, o recibo para desfazer. */
export async function moveEvent(
  record: EventRecord,
  input: EventInput,
  scope: AgendaSeriesScope,
  occurrence: ISODate | null,
  userId: number,
  now: Date = new Date(),
): Promise<{ saved: ScopedResult; undo: string }> {
  const before: Snapshot = {
    date: record.date,
    endDate: record.endDate,
    startTime: record.startTime,
    endTime: record.endTime,
    recurrence: record.recurrence ?? null,
    exceptions: [...(record.recurrenceExceptions ?? [])],
  };
  const saved = await updateEventScoped(record, input, scope, occurrence, userId);
  const stamps = async (id: number) => (await db.select({ updatedAt: agendaEvents.updatedAt }).from(agendaEvents).where(eq(agendaEvents.id, id)))[0]?.updatedAt.getTime() ?? 0;
  const created = saved.id !== record.id ? saved.id : null;
  const receipt: Receipt = { u: userId, id: record.id, c: created, b: before, s: await stamps(record.id), cs: created ? await stamps(created) : null, x: now.getTime() + UNDO_TTL_MS };
  return { saved, undo: seal(receipt) };
}

export type UndoResult = { ok: true; id: number; date: ISODate } | { ok: false; reason: "invalido" | "expirado" | "mudou" | "sem_acesso" };

/** Desfaz um movimento a partir do recibo. Não desfaz se o compromisso foi alterado depois (por qualquer pessoa). */
export async function undoMove(access: AgendaAccess, token: string, now: Date = new Date()): Promise<UndoResult> {
  const receipt = open(token);
  if (!receipt || receipt.u !== access.userId) return { ok: false, reason: "invalido" };
  if (now.getTime() > receipt.x) return { ok: false, reason: "expirado" };
  const record = await loadEventRecord(receipt.id);
  if (!record) return { ok: false, reason: "mudou" };
  if (!canMutateEvent(access, record)) return { ok: false, reason: "sem_acesso" };

  const changed = await db.transaction(async (tx) => {
    const [row] = await tx.select({ updatedAt: agendaEvents.updatedAt }).from(agendaEvents).where(eq(agendaEvents.id, receipt.id));
    if (!row || row.updatedAt.getTime() !== receipt.s) return true;
    if (receipt.c !== null) {
      const [created] = await tx.select({ updatedAt: agendaEvents.updatedAt }).from(agendaEvents).where(eq(agendaEvents.id, receipt.c));
      if (!created || created.updatedAt.getTime() !== receipt.cs) return true;
      // ocorrências avulsas que passaram para a série nova voltam para a original; a linha criada some
      // (os anexos são os mesmos do original: nada a apagar em disco)
      await tx.update(agendaEvents).set({ seriesId: receipt.id }).where(eq(agendaEvents.seriesId, receipt.c));
      await tx.delete(agendaEvents).where(eq(agendaEvents.id, receipt.c));
    }
    await tx
      .update(agendaEvents)
      .set({
        date: receipt.b.date,
        endDate: receipt.b.endDate,
        startTime: receipt.b.startTime,
        endTime: receipt.b.endTime,
        recurrence: receipt.b.recurrence,
        recurrenceExceptions: receipt.b.exceptions,
        updatedAt: now,
      })
      .where(eq(agendaEvents.id, receipt.id));
    return false;
  });
  return changed ? { ok: false, reason: "mudou" } : { ok: true, id: receipt.id, date: receipt.b.date };
}
