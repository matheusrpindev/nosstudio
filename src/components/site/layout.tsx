/**
 * Primitivos de estrutura do site público: contêiner, grid de 12 colunas, seção numerada, cabeçalho de
 * seção e cabeçalho de página. Server Components (sem JS no cliente).
 */
import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { revealProps } from "./reveal";
import { parseAccent, type SiteTone } from "./text";

/** Largura máxima + margens laterais do site. */
export function Container({
  as: Tag = "div",
  className,
  children,
  ...rest
}: { as?: ElementType; className?: string; children: ReactNode; id?: string; style?: CSSProperties }) {
  return (
    <Tag className={cn("s-wrap", className)} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Grid de 12 colunas a partir de 1024px (uma coluna abaixo disso). Posicione os filhos com utilitários do
 * Tailwind: `lg:col-span-4`, `lg:col-start-5`, `lg:col-[5/-1]`…
 */
export function Grid({
  as: Tag = "div",
  className,
  children,
  ...rest
}: { as?: ElementType; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <Tag className={cn("s-grid", className)} {...rest}>
      {children}
    </Tag>
  );
}

type SectionProps = {
  id?: string;
  /** "01", "02"… (use `sectionCounter()` para manter a sequência quando uma seção some). */
  number?: string;
  /** Rótulo ao lado do número ("Serviços"). Sem rótulo, o fio numerado não aparece. */
  label?: string;
  /** Bloco de cor chapada. Sem `tone`, a seção fica no papel (off-white). */
  tone?: SiteTone;
  /** Respiro acima do fio. Padrão: nenhum no papel (a seção anterior já deixa o respiro), "md" em blocos de cor. */
  spaceTop?: "none" | "md" | "lg";
  /** Remove o respiro de baixo (use quando `bleed` encosta na próxima seção). */
  flush?: boolean;
  /** Conteúdo de largura total, fora do contêiner, depois do conteúdo (ex.: <StatementBanner />). */
  bleed?: ReactNode;
  /** id do título da seção (acessibilidade). */
  labelledBy?: string;
  className?: string;
  children: ReactNode;
};

/** Seção de página com o fio fino e a numeração ("01 — Serviços"). */
export function Section({ id, number, label, tone, spaceTop, flush, bleed, labelledBy, className, children }: SectionProps) {
  const top = spaceTop ?? (tone && tone !== "paper" ? "md" : "none");
  return (
    <section
      id={id}
      className={cn("s-section", className)}
      data-tone={tone}
      data-space-top={top === "none" ? undefined : top}
      data-flush={flush || bleed ? "true" : undefined}
      aria-labelledby={labelledBy}
    >
      <div className="s-wrap">
        {label ? (
          <div className="s-section__top">
            <span className="s-rule" aria-hidden="true" {...revealProps()} />
            <p className="s-section__idx">
              {number ? <span className="s-section__n">{number} —</span> : null}
              {label}
            </p>
          </div>
        ) : null}
        {children}
      </div>
      {bleed}
    </section>
  );
}

/** Título com trecho em destaque (o "sinal" lima). Veja `parseAccent` para as regras. */
export function Accented({ text, fallback = "none" }: { text: string; fallback?: "tail" | "none" }) {
  const { before, accent, after } = parseAccent(text, fallback);
  if (!accent) return <>{before}</>;
  return (
    <>
      {before}
      <mark className="s-signal">{accent}</mark>
      {after}
    </>
  );
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "p";

/** Título gigante (Montserrat Black/ExtraBold, tracking apertado). `size="d0"` é o maior (fechamentos). */
export function Display({
  as: Tag = "h2",
  size = "d1",
  accent,
  className,
  id,
  children,
}: {
  as?: HeadingTag;
  size?: "d0" | "d1";
  /** Destaca um trecho: "tail" = marcação `*assim*` ou as duas últimas palavras; "marked" = só a marcação. */
  accent?: "tail" | "marked";
  className?: string;
  id?: string;
  children: string;
}) {
  return (
    <Tag id={id} className={cn(size === "d0" ? "s-d0" : "s-d1", className)}>
      {accent ? <Accented text={children} fallback={accent === "tail" ? "tail" : "none"} /> : children}
    </Tag>
  );
}

/** Títulos de seção e de bloco. `size` controla o desenho; `as`, a semântica. */
export function Heading({
  as: Tag = "h2",
  size = "h2",
  className,
  id,
  children,
}: {
  as?: HeadingTag;
  size?: "h2" | "h3" | "h4";
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={cn(`s-${size}`, className)}>
      {children}
    </Tag>
  );
}

/** Cabeçalho de seção: título grande à esquerda e, opcionalmente, um texto de apoio à direita. */
export function SectionHeader({
  title,
  lead,
  id,
  as = "h2",
  className,
}: {
  title: string;
  lead?: string | null;
  /** id do título (ligue com `labelledBy` da <Section>). */
  id?: string;
  as?: HeadingTag;
  className?: string;
}) {
  return (
    <div className={cn("s-section__head", className)}>
      <Heading as={as} id={id}>
        <Accented text={title} />
      </Heading>
      {lead ? <p className="s-lead s-section__lead">{lead}</p> : null}
    </div>
  );
}

/**
 * Abertura das páginas internas: rótulo sobre fio, <h1> gigante, texto de apoio e ações.
 * Uma por página (é ela que carrega o único <h1>).
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  text,
  actions,
  meta,
  accent,
  tone,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Texto de apoio em destaque. */
  lead?: string | null;
  /** Segundo parágrafo, mais discreto. */
  text?: string | null;
  /** Botões (ficam à direita no desktop). */
  actions?: ReactNode;
  /** Conteúdo à direita do rótulo (ex.: versão da política, link do Instagram). */
  meta?: ReactNode;
  accent?: "tail" | "marked";
  tone?: SiteTone;
  /** Conteúdo extra abaixo (ex.: um <PhotoSlot /> ou um <Grid>). */
  children?: ReactNode;
}) {
  return (
    <header className="s-pagehead" data-tone={tone}>
      <div className="s-wrap s-pagehead__stage">
        {eyebrow || meta ? (
          <div className="s-pagehead__meta">
            {eyebrow ? <p className="s-meta">{eyebrow}</p> : <span />}
            {meta ? <div className="s-meta">{meta}</div> : null}
          </div>
        ) : null}
        <Display as="h1" accent={accent} className="s-pagehead__title">
          {title}
        </Display>
        {lead || text || actions ? (
          <div className="s-pagehead__body">
            <div className="s-pagehead__lead">
              {lead ? <p className="s-lead">{lead}</p> : null}
              {text ? <p className="s-muted">{text}</p> : null}
            </div>
            {actions ? <div className="s-pagehead__actions">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </header>
  );
}
