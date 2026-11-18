"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/** Botão que copia o código HEX de uma cor. Cai para `execCommand` onde a Clipboard API não existe (http, navegadores antigos). */
export function CopyHexButton({ hex, name, className }: { hex: string; name: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(hex);
      ok = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = hex;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
    }
    if (!ok) return toast.error("Não foi possível copiar. Selecione o código e copie à mão.");
    toast(`${name} ${hex} copiado.`);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar o código ${hex} da cor ${name}`}
      className={cn("btn btn-secondary btn-sm min-h-11 w-full font-mono tabular-nums sm:min-h-9", className)}
    >
      <span className="btn-icone" aria-hidden="true">
        {copied ? <Check /> : <Copy />}
      </span>
      {copied ? "Copiado" : hex}
    </button>
  );
}
