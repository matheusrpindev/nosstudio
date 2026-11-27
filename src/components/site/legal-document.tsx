/**
 * Páginas legais (privacidade, termos de uso e cookies): markdown do painel (sem HTML cru) com âncoras nos
 * títulos `##` e índice lateral. Server Components. As âncoras levam o prefixo da página (`privacidade-`,
 * `termos-`, `cookies-`) para os ids não colidirem com os de outras páginas.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { safeHref } from "@/lib/format";
import { SiteLink } from "./button";
import { PageHeader, Section } from "./layout";

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
export function legalHeadings(body: string, prefix: string): { id: string; title: string }[] {
  const seen = new Map<string, number>();
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => {
    const title = plain(match[1]);
    const base = `${prefix}-${slugify(title) || "secao"}`;
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

export function LegalDocument({ body, prefix }: { body: string; prefix: string }) {
  const headings = legalHeadings(body, prefix);
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
            return <h2 id={heading?.id ?? `${prefix}-${slugify(textOf(children))}`}>{children}</h2>;
          },
          a: ({ href, children }) => {
            const safe = safeHref(href);
            if (!safe) return <>{children}</>;
            const external = /^https?:/i.test(safe);
            // links entre as páginas legais (/privacidade, /cookies…) navegam sem recarregar
            if (safe.startsWith("/")) return <Link href={safe}>{children}</Link>;
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

/**
 * Página legal completa: cabeçalho (título + versão), índice lateral e o texto. `prefix` é o slug da página.
 * `closing`: pergunta + link no fim do texto (rótulos de interface).
 */
export function LegalPage({
  eyebrow,
  title,
  version,
  body,
  prefix,
  tocLabel,
  closing,
}: {
  eyebrow: string;
  title: string;
  version: string;
  body: string;
  prefix: string;
  /** Título do índice ("Nesta política", "Nestes termos"). */
  tocLabel: string;
  closing: { text: string; label: string; href: string };
}) {
  const headings = legalHeadings(body, prefix);
  return (
    <>
      <PageHeader title={title} meta={version ? <>Versão {version}</> : null} eyebrow={eyebrow} />
      <Section id={`${prefix}-texto`} labelledBy={undefined}>
        <div className="privacy__grid">
          {headings.length > 1 ? (
            <nav className="privacy__toc" aria-labelledby={`${prefix}-indice`}>
              <h2 id={`${prefix}-indice`} className="s-meta privacy__toc-title">
                {tocLabel}
              </h2>
              <ol>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a href={`#${heading.id}`}>{heading.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="privacy__doc">
            <LegalDocument body={body} prefix={prefix} />
            <div className="privacy__foot">
              <p className="s-muted">{closing.text}</p>
              <SiteLink href={closing.href}>{closing.label}</SiteLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
