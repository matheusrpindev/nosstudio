/**
 * Corpo da política de privacidade: markdown do painel (sem HTML cru) com âncoras nos títulos `##` e
 * índice lateral. Server Component. As âncoras levam o prefixo `privacidade-` (ids não colidem com outras páginas).
 */
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { safeHref } from "@/lib/format";

/** "Quem é responsável pelos dados" → "quem-e-responsavel-pelos-dados" */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function plain(text: string): string {
  return text.replace(/[*_`]/g, "").trim();
}

/** Títulos de seção (`## …`) do texto, na ordem, com o id da âncora. Ids repetidos recebem sufixo. */
export function privacyHeadings(body: string): { id: string; title: string }[] {
  const seen = new Map<string, number>();
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => {
    const title = plain(match[1]);
    const base = `privacidade-${slugify(title) || "secao"}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { id: count ? `${base}-${count + 1}` : base, title };
  });
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function PrivacyDocument({ body }: { body: string }) {
  const headings = privacyHeadings(body);
  let cursor = 0;
  return (
    <div className="s-prose privacy__prose">
      <ReactMarkdown
        skipHtml
        allowedElements={["p", "strong", "em", "ul", "ol", "li", "a", "h2", "h3", "h4", "br", "blockquote", "hr"]}
        unwrapDisallowed
        components={{
          h2: ({ children }) => {
            const heading = headings[cursor++];
            return <h2 id={heading?.id ?? `privacidade-${slugify(textOf(children))}`}>{children}</h2>;
          },
          a: ({ href, children }) => {
            const safe = safeHref(href);
            if (!safe) return <>{children}</>;
            const external = /^https?:/i.test(safe);
            return (
              <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
