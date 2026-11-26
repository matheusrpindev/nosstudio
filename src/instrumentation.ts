/**
 * Código que roda UMA vez quando o servidor Next sobe (guia: node_modules/next/dist/docs/01-app/02-guides/
 * instrumentation.md). Aqui: liga o temporizador dos lembretes da agenda.
 *
 * - só no runtime Node (o temporizador usa o banco e o SMTP);
 * - nunca durante o `next build` (o build também carrega este arquivo nos processos que pré-renderizam páginas);
 * - a importação fica dentro de `register()` para o código de servidor não entrar em outros runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startReminderTimer } = await import("@/server/notifications/timer");
  startReminderTimer();
}
