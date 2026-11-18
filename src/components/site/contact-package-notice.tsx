"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { knownPackageName } from "@/lib/site/lead-form-fields";

/**
 * Aviso discreto "Pedido sobre: <pacote>" quando a pessoa chega por `/contato?pacote=…` (botão de um pacote).
 * A query string só existe no navegador: a página de contato continua estática e este componente (dentro de
 * <Suspense>) resolve o parâmetro depois da hidratação. O <LeadForm> lê o mesmo parâmetro e envia o
 * `packageName` junto com o lead.
 *
 * Só aparece quando o parâmetro é o nome de um pacote publicado (`options`): texto arbitrário na URL é ignorado.
 */
function Notice({ label, options }: { label: string; options: readonly string[] }) {
  const search = useSearchParams();
  const pacote = knownPackageName(search.get("pacote"), options);
  if (!pacote) return null;
  return (
    <p className="contact__ref s-meta" role="status">
      <span>{label}</span> <strong>{pacote}</strong>
    </p>
  );
}

export function ContactPackageNotice({ label = "Pedido sobre:", options }: { label?: string; options: readonly string[] }) {
  return (
    <Suspense fallback={null}>
      <Notice label={label} options={options} />
    </Suspense>
  );
}
