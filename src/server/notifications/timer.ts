/**
 * Temporizador dos lembretes: roda o despachante a cada minuto DENTRO do servidor (processo Node de longa
 * duração — `scripts/start.sh` / Docker). Registrado por `src/instrumentation.ts`.
 *
 * - nunca sobrepõe execuções (se uma passada demora mais de um minuto, a seguinte é pulada);
 * - o estado fica em `globalThis`: o recarregamento de módulos em desenvolvimento não cria um segundo relógio;
 * - `REMINDERS_TIMER=off` desliga (para quem prefere chamar `scripts/reminders.ts` pelo cron). Rodar os dois ao
 *   mesmo tempo é seguro: o índice único das entregas impede o envio em dobro.
 */
import "server-only";
import { pruneReadNotifications } from "./index";
import { dispatchAgendaReminders, pruneReminderDeliveries } from "./reminders";

const INTERVAL_MS = 60_000;
const FIRST_RUN_MS = 15_000;
const PRUNE_EVERY = 6 * 60; // a cada 6 horas

type State = { timer: ReturnType<typeof setInterval> | null; running: boolean; runs: number };
const holder = globalThis as unknown as { __nosReminders?: State };

/** Uma passada protegida: nunca derruba o servidor, nunca roda duas ao mesmo tempo. */
export async function runReminderTick(state: State = (holder.__nosReminders ??= { timer: null, running: false, runs: 0 })): Promise<"ok" | "pulada" | "erro"> {
  if (state.running) return "pulada";
  state.running = true;
  try {
    const result = await dispatchAgendaReminders();
    if (result.notifications > 0 || result.emails > 0 || result.emailFailures > 0) {
      console.info(`[lembretes] ${result.notifications} aviso(s) no painel, ${result.emails} e-mail(s) enviado(s), ${result.emailFailures} não enviado(s)`);
    }
    if (state.runs % PRUNE_EVERY === 0) {
      await pruneReminderDeliveries();
      await pruneReadNotifications();
    }
    state.runs += 1;
    return "ok";
  } catch (error) {
    console.error("[lembretes] falha na passada:", (error as Error)?.message ?? "erro desconhecido");
    return "erro";
  } finally {
    state.running = false;
  }
}

export function startReminderTimer(): boolean {
  if (process.env.REMINDERS_TIMER === "off") return false;
  const state = (holder.__nosReminders ??= { timer: null, running: false, runs: 0 });
  if (state.timer) return false;
  state.timer = setInterval(() => void runReminderTick(state), INTERVAL_MS);
  // não segura o processo aberto (desligamento limpo) …
  state.timer.unref?.();
  // … e a primeira passada não espera um minuto inteiro
  setTimeout(() => void runReminderTick(state), FIRST_RUN_MS).unref?.();
  return true;
}
