"use client";

import { BellRing, Check } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { markNotificationReadAction } from "./actions";
import { NOTIFICATIONS_CHANGED, relativeTime, type NotificationItem } from "./shared";

type Props = {
  item: NotificationItem;
  /** "Agora" de quem está vendo (ms): vem de quem monta a lista, para o texto não mudar entre servidor e navegador. */
  now: number;
  /** Chamado ao abrir o item (o sino fecha o balão). */
  onOpen?: () => void;
  /** Mais compacto (dentro do sino). */
  dense?: boolean;
};

/**
 * Uma notificação: abrir o item leva ao link e já marca como lida; o botão ✓ marca sem sair da tela.
 * Não lida = ponto lima + título em destaque (e o texto "não lida" para leitor de tela).
 */
export function NotificationRow({ item, now, onOpen, dense }: Props) {
  const [pending, startTransition] = useTransition();
  const markRead = () => {
    if (item.read) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", String(item.id));
      await markNotificationReadAction(initialActionState, data);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    });
  };
  const content = (
    <>
      <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primaria")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-snug break-words", item.read ? "text-texto-suave font-medium" : "text-texto font-bold")}>
          {item.read ? null : <span className="sr-only">Não lida: </span>}
          {item.title}
        </span>
        {item.body ? <span className="text-texto-suave mt-0.5 block text-[0.8125rem] leading-snug break-words">{item.body}</span> : null}
        <span className="text-texto-suave mt-0.5 block text-xs">{relativeTime(item.createdAt, now)}</span>
      </span>
    </>
  );
  const rowClass = cn("flex min-w-0 flex-1 items-start gap-2.5 rounded-md text-left", dense ? "px-2 py-2" : "px-3 py-3 sm:px-4");
  return (
    <div className={cn("flex items-start gap-1", pending && "opacity-70")}>
      {item.href ? (
        <Link
          href={item.href}
          onClick={() => {
            markRead();
            onOpen?.();
          }}
          className={cn(rowClass, "hover:bg-detalhe-suave focus-visible:outline-offset-[-2px]")}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
      {item.read ? null : (
        <button type="button" onClick={markRead} disabled={pending} aria-label={`Marcar como lida: ${item.title}`} title="Marcar como lida" className="btn btn-ghost btn-icon text-texto-suave mt-0.5 shrink-0">
          <Check aria-hidden="true" className="size-[1.125rem]" />
        </button>
      )}
    </div>
  );
}

export function NotificationsEmpty({ unreadOnly }: { unreadOnly?: boolean }) {
  return (
    <div className="text-texto-suave flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
      <BellRing aria-hidden="true" className="size-6" />
      <p>{unreadOnly ? "Nenhuma notificação por ler." : "Nenhuma notificação por aqui ainda."}</p>
      <p className="text-xs">Os lembretes dos compromissos em que você está aparecem aqui.</p>
    </div>
  );
}
