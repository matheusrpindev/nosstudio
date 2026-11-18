"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { FLASH_COOKIE, type FlashPayload } from "./flash-shared";

export type ToastTone = "sucesso" | "erro" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };

// Store mínimo fora do React: `toast()` pode ser chamado de qualquer Client Component, handler ou efeito.
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}
function push(message: string, tone: ToastTone) {
  if (!message) return;
  const id = nextId++;
  // no máximo 3 avisos empilhados; o mais antigo sai
  items = [...items.slice(-2), { id, message, tone }];
  emit();
  // erros ficam mais tempo na tela
  window.setTimeout(() => dismiss(id), tone === "erro" ? 8000 : 4500);
}

/**
 * Mostra um aviso rápido no canto da tela (anunciado por leitores de tela).
 * `toast("Salvo.")` = sucesso · `toast.error("Não deu certo.")` · `toast.info("…")`.
 * Só funciona no cliente e exige um `<Toaster />` montado (o layout do painel já tem).
 */
export function toast(message: string, tone: ToastTone = "sucesso") {
  push(message, tone);
}
toast.success = (message: string) => push(message, "sucesso");
toast.error = (message: string) => push(message, "erro");
toast.info = (message: string) => push(message, "info");

/** Lê (e apaga) o aviso deixado por `flashToast()` numa Server Action antes de um `redirect()`. */
function consumeFlash() {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${FLASH_COOKIE}=`));
  if (!match) return;
  document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  try {
    const payload = JSON.parse(decodeURIComponent(match.slice(FLASH_COOKIE.length + 1))) as FlashPayload;
    if (typeof payload.m === "string") push(payload.m.slice(0, 300), payload.t === "erro" || payload.t === "info" ? payload.t : "sucesso");
  } catch {
    // cookie malformado: ignora
  }
}

const TONES: Record<ToastTone, { box: string; icon: typeof Info }> = {
  sucesso: { box: "bg-grafite text-white", icon: CircleCheck },
  info: { box: "bg-grafite text-white", icon: Info },
  erro: { box: "bg-perigo text-white", icon: CircleAlert },
};

/** Região dos avisos. Monte uma vez por layout (o painel e as telas de acesso já montam). */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  const pathname = usePathname();

  useEffect(() => {
    consumeFlash();
  }, [pathname]);

  return (
    <div
      role="region"
      aria-label="Avisos"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0"
    >
      {/* As duas regiões vivas existem desde o início: leitores de tela só anunciam mudanças em regiões já montadas. */}
      <div aria-live="polite" aria-atomic="false" className="contents">
        {list
          .filter((item) => item.tone !== "erro")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
      <div aria-live="assertive" aria-atomic="false" className="contents">
        {list
          .filter((item) => item.tone === "erro")
          .map((item) => (
            <ToastCard key={item.id} item={item} />
          ))}
      </div>
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const tone = TONES[item.tone];
  const Icon = tone.icon;
  return (
    <div
      data-toast={item.tone}
      className={cn(
        "toast-entrada shadow-flutuante pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-campo py-2 pr-1.5 pl-4 text-sm font-medium",
        tone.box,
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-2.5 size-[1.125rem] shrink-0", item.tone === "sucesso" && "text-lima")} />
      <p className="min-w-0 flex-1 py-2 leading-snug break-words">{item.message}</p>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Fechar aviso"
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white focus-visible:outline-white"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
