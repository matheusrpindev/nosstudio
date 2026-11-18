"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre a janela de impressão do navegador. O CSS de impressão da página deixa só o texto do contrato. */
export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
