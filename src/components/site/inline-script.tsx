/**
 * Script inline que roda durante a leitura do HTML, antes da primeira pintura — usado para ajustar o que o
 * servidor (estático) não tem como saber: hora local, localStorage. Padrão recomendado pelo Next
 * (guia "Preventing flash before hydration"): no cliente o tipo vira `text/plain` para o React não tentar
 * reexecutar nem avisar sobre <script> em componentes.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
