/**
 * Lembretes da agenda pela linha de comando — para quem prefere o cron ao temporizador do servidor
 * (`REMINDERS_TIMER=off`), ou para conferir na mão.
 *
 *   npx tsx --conditions=react-server scripts/reminders.ts            uma passada (ideal para o cron, a cada minuto)
 *   npx tsx --conditions=react-server scripts/reminders.ts --watch    fica rodando, uma passada por minuto
 *
 * Idempotente: rodar junto com o servidor (ou duas vezes no mesmo minuto) não repete nenhum lembrete.
 */
import { pruneReadNotifications } from "@/server/notifications";
import { dispatchAgendaReminders, pruneReminderDeliveries } from "@/server/notifications/reminders";

async function pass() {
  const result = await dispatchAgendaReminders();
  console.log(`✔ Lembretes: ${result.due} vencido(s) · ${result.notifications} aviso(s) no painel · ${result.emails} e-mail(s) enviado(s) · ${result.emailFailures} e-mail(s) não enviado(s)`);
}

async function main() {
  if (!process.argv.includes("--watch")) {
    await pass();
    await pruneReminderDeliveries();
    await pruneReadNotifications();
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return; // nunca sobrepõe passadas
    running = true;
    try {
      await pass();
    } catch (error) {
      console.error("✖ Falha na passada:", (error as Error)?.message ?? error);
    } finally {
      running = false;
    }
  };
  await tick();
  setInterval(tick, 60_000);
}

main().catch((error) => {
  console.error("✖ Falha ao enviar lembretes:", error);
  process.exit(1);
});
