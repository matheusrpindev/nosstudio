import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/cn";
import { safeHref } from "@/lib/format";

/**
 * Renderiza texto rico (markdown leve) vindo do banco com segurança: sem HTML cru, links validados.
 * Suporta parágrafos, **negrito**, *itálico*, listas, títulos (## e ###) e links.
 * Estilo: classe `.prosa` (definida pelo site e pelo painel) ou passe `className`.
 */
export function Markdown({ children, className }: { children: string | null | undefined; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <div className={cn("prosa", className)}>
      <ReactMarkdown
        skipHtml
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "a", "h2", "h3", "h4", "br", "blockquote", "hr"]}
        unwrapDisallowed
        components={{
          a: ({ href, children: label }) => {
            const safe = safeHref(href);
            if (!safe) return <>{label}</>;
            const external = /^https?:/i.test(safe);
            return (
              <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {label}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Quebra um texto simples em parágrafos (linhas em branco separam). Para copy sem formatação. */
export function Paragraphs({ children, className }: { children: string | null | undefined; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <>
      {children
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            {p}
          </p>
        ))}
    </>
  );
}
