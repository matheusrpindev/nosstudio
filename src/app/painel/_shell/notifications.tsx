"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover as RadixPopover } from "radix-ui";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { NotificationRow, NotificationsEmpty } from "../notificacoes/item";
import { MarkAllRead } from "../notificacoes/mark-all";
import { NOTIFICATIONS_CHANGED, type NotificationSummary } from "../notificacoes/shared";

const SUMMARY_URL = "/painel/notificacoes/resumo";
const POLL_MS = 60_000;

type Store = { summary: NotificationSummary; reload: () => void };
const NotificationsContext = createContext<Store | null>(null);

/**
 * Guarda as notificações de quem está logado para os dois sinos (barra lateral e barra do celular): começa com
 * o que o servidor mandou e atualiza a cada minuto, ao voltar para a aba, ao trocar de página e quando alguma
 * tela marca algo como lido. Uma falha de rede só mantém o último valor.
 */
export function NotificationsProvider({ initial, children }: { initial: NotificationSummary; children: ReactNode }) {
  const [summary, setSummary] = useState(initial);
  const pathname = usePathname();
  const loading = useRef(false);

  const reload = useCallback(async () => {
    if (loading.current || document.visibilityState === "hidden") return;
    loading.current = true;
    try {
      const response = await fetch(SUMMARY_URL, { cache: "no-store", headers: { Accept: "application/json" } });
      if (response.ok && response.headers.get("content-type")?.includes("application/json")) setSummary((await response.json()) as NotificationSummary);
    } catch {
      // sem rede: fica o que já estava na tela
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(reload, POLL_MS);
    const onVisible = () => (document.visibilityState === "visible" ? void reload() : undefined);
    window.addEventListener("focus", reload);
    window.addEventListener(NOTIFICATIONS_CHANGED, reload);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      window.removeEventListener(NOTIFICATIONS_CHANGED, reload);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  // trocar de página é um bom momento para conferir (o layout não é renderizado de novo na navegação)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void reload();
  }, [pathname, reload]);

  return <NotificationsContext value={{ summary, reload }}>{children}</NotificationsContext>;
}

/** O sino: contador de não lidas e, ao abrir, as mais recentes (marcar como lida, marcar todas, abrir o item). */
export function NotificationBell({ className, align = "start" }: { className?: string; align?: "start" | "end" }) {
  const store = use(NotificationsContext);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  if (!store) return null;
  const { summary, reload } = store;
  const unread = summary.unread;
  const label = unread === 0 ? "Notificações" : unread === 1 ? "Notificações: 1 não lida" : `Notificações: ${unread} não lidas`;

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setNow(Date.now());
          reload();
        }
      }}
    >
      <RadixPopover.Trigger asChild>
        <button type="button" aria-label={label} title={label} className={cn("relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-campo hover:bg-white/10 focus-visible:outline-white", className)}>
          <Bell aria-hidden="true" className="size-[1.375rem]" />
          {unread > 0 ? (
            <span aria-hidden="true" data-contador className="bg-lima text-grafite ring-menu absolute top-1 right-0.5 min-w-[1.125rem] rounded-full px-1 text-center text-[0.625rem] leading-[1.125rem] font-bold tabular-nums ring-2">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Notificações"
          className="flutuante-entrada border-borda shadow-flutuante text-texto z-[60] flex max-h-[min(32rem,calc(100dvh-6rem))] w-[23rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-cartao border bg-superficie-alta outline-none"
        >
          <div className="border-borda flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
            <h2 className="text-texto text-base font-bold">Notificações</h2>
            <MarkAllRead size="sm" disabled={unread === 0} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {summary.items.length === 0 ? (
              <NotificationsEmpty />
            ) : (
              <ul className="space-y-0.5">
                {summary.items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow item={item} now={now} dense onOpen={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-borda border-t p-1.5">
            <Link href="/painel/notificacoes" onClick={() => setOpen(false)} className="text-detalhe hover:bg-detalhe-suave flex min-h-11 items-center justify-center rounded-md text-sm font-semibold">
              Ver todas as notificações
            </Link>
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
