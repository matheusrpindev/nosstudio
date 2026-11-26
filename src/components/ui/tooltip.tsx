"use client";

import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";

export type TooltipProps = {
  /** Texto curto. Não coloque informação essencial só aqui (não aparece no toque). */
  content: ReactNode;
  /** Elemento focável (botão/link). */
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
};

/** Dica ao passar o mouse ou focar (Radix). `IconButton` já mostra o `aria-label` como `title`; use Tooltip para textos maiores. */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={250}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="flutuante-entrada bg-grafite shadow-flutuante z-[70] max-w-64 rounded-md px-2.5 py-1.5 text-xs leading-snug font-medium text-white"
          >
            {content}
            <RadixTooltip.Arrow className="fill-texto" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
