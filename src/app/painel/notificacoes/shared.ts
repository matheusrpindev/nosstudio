/** Formato das notificações entre o servidor e o sino (datas como texto ISO: atravessam JSON e props). */
export type NotificationItem = { id: number; title: string; body: string; href: string; read: boolean; createdAt: string };
export type NotificationSummary = { unread: number; items: NotificationItem[] };

/** Evento do navegador: algo mudou nas notificações (marcar como lida numa tela) — o sino busca de novo. */
export const NOTIFICATIONS_CHANGED = "nos:notificacoes";

/** "agora" · "há 5 min" · "há 3 h" · "ontem" · "há 4 dias" · "12/11/2026". */
export function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
