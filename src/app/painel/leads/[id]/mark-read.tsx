"use client";

import { useEffect } from "react";
import { markLeadReadAction } from "../actions";

/**
 * Marca o lead como lido quando o detalhe é realmente aberto no navegador.
 * Por que no cliente: renderizar a página (GET) não deve gravar nada — prefetch, robôs e recarregamentos
 * também renderizam. O efeito só roda quando a tela aparece para uma pessoa.
 */
export function MarkLeadRead({ id }: { id: number }) {
  useEffect(() => {
    void markLeadReadAction(id);
  }, [id]);
  return null;
}
