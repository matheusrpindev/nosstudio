/**
 * GET /painel/agenda/exportar?de=YYYY-MM-DD&ate=YYYY-MM-DD[&agendas=…&categorias=…&cliente=…&projeto=…&responsavel=…]
 * Baixa a agenda do período em .ics (iCalendar), com os mesmos filtros da tela. Exige `agenda:baixar`.
 * Privacidade e alcance: ver `src/server/agenda/export.ts`.
 */
import { buildCalendar } from "@/lib/agenda/ics";
import { logAudit } from "@/lib/audit";
import { addDays, diffDays, isISODate, todayISO } from "@/lib/dates";
import { authorizeAgenda } from "@/server/agenda/access";
import { listIcsEvents } from "@/server/agenda/export";
import { listCalendars } from "@/server/agenda/queries";
import { parseAgendaState } from "../url";

/** Período máximo de uma exportação (a repetição das séries continua valendo além dele, pela RRULE). */
const MAX_DAYS = 2 * 366;

export async function GET(request: Request) {
  const auth = await authorizeAgenda("baixar");
  if (auth instanceof Response) return auth;
  const { user, access } = auth;

  const url = new URL(request.url);
  const today = todayISO();
  const state = parseAgendaState(Object.fromEntries(url.searchParams.entries()), today);
  const fromParam = url.searchParams.get("de");
  const toParam = url.searchParams.get("ate");
  const from = fromParam && isISODate(fromParam) ? fromParam : today;
  let to = toParam && isISODate(toParam) && toParam >= from ? toParam : addDays(from, 365);
  if (diffDays(from, to) > MAX_DAYS) to = addDays(from, MAX_DAYS);

  // só as agendas ativas, como na tela
  const calendars = await listCalendars();
  const active = calendars.map((calendar) => calendar.id);
  const events = await listIcsEvents(access, from, to, {
    calendarIds: state.calendars ? state.calendars.filter((id) => active.includes(id)) : active,
    categoryIds: state.categories,
    clientId: access.view === "todos" ? state.clientId : null,
    projectId: state.projectId,
    personId: state.personId,
  });
  const body = buildCalendar(events, { name: "Agenda da NÓS", now: new Date() });
  await logAudit({ user, action: "export", entity: "agenda", summary: `Exportou a agenda em .ics (${events.length} ${events.length === 1 ? "compromisso" : "compromissos"})` });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agenda-nos-${from}_${to}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
