"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Aviso discreto "Pedido sobre: <pacote>" quando a pessoa chega por `/contato?pacote=…` (botão de um pacote).
 * A query string só existe no navegador: a página de contato continua estática e este componente (dentro de
 * <Suspense>) resolve o parâmetro depois da hidratação. O <LeadForm> lê o mesmo parâmetro e envia o
 * `packageName` junto com o lead.
 */
function Notice({ label }: { label: string }) {
  const search = useSearchParams();
  const pacote = (search.get("pacote") ?? "").trim().slice(0, 120);
  if (!pacote) return null;
  return (
    <p className="contact__ref s-meta" role="status">
      <span>{label}</span> <strong>{pacote}</strong>
    </p>
  );
}

export function ContactPackageNotice({ label = "Pedido sobre:" }: { label?: string }) {
  return (
    <Suspense fallback={null}>
      <Notice label={label} />
    </Suspense>
  );
}
