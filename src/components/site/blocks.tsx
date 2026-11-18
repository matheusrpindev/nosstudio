/**
 * Blocos de conteúdo reutilizáveis do site público (Server Components):
 * StatementBanner, ServicePanels, ValuesList, Steps, FaqAccordion, ContactChannels, CtaBand.
 */
import type { CSSProperties, ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/cn";
import { safeHref } from "@/lib/format";
import { SiteButtonLink, SmartLink } from "./button";
import { Display } from "./layout";
import { Icon, PlayMark, RatioFrame, ViewfinderFrame, type IconName, type RatioKind } from "./marks";
import { revealProps } from "./reveal";
import { pad2, splitStatement, type SiteTone } from "./text";

// ------------------------------------------------------- frase em destaque
/**
 * Frase de impacto em largura total. Com duas frases ("Você traz a história. NÓS encontramos o olhar."),
 * vira duas metades — lavanda e roxo — que se encontram numa emenda com o play. Com uma só, um campo roxo.
 * Passe `first`/`second` para controlar a divisão à mão.
 */
export function StatementBanner({
  text,
  first,
  second,
  spaceTop = false,
  className,
}: {
  text?: string;
  first?: string;
  second?: string;
  /** Respiro de seção acima (quando vem logo depois do conteúdo de uma <Section>). */
  spaceTop?: boolean;
  className?: string;
}) {
  const [a, b] = first !== undefined ? [first, second ?? null] : splitStatement(text ?? "");
  if (!a) return null;
  if (!b) {
    return (
      <p className={cn("s-statement s-statement--single", className)} data-space-top={spaceTop || undefined}>
        <span className="s-statement__b" data-tone="roxo">
          <ViewfinderFrame />
          <span className="s-statement__tx">{a}</span>
        </span>
      </p>
    );
  }
  return (
    <p className={cn("s-statement", className)} data-space-top={spaceTop || undefined}>
      <span className="s-statement__a" data-tone="lavanda">
        <span className="s-statement__tx">{a}</span>
      </span>{" "}
      <span className="s-statement__b" data-tone="roxo">
        <ViewfinderFrame />
        <PlayMark className="s-statement__play" />
        <span className="s-statement__tx">{b}</span>
      </span>
    </p>
  );
}

// ------------------------------------------------------ cartões de serviço
export type ServicePanelItem = { title: string; text: string; href?: string | null };

const PANEL_LOOKS: { tone: SiteTone; kind: RatioKind }[] = [
  { tone: "roxo", kind: "play" }, // 16:9 — audiovisual
  { tone: "lavanda", kind: "accent" }, // 9:16 — redes sociais
  { tone: "grafite", kind: "rings" }, // 4:5 — eventos e casamentos
];

/**
 * Painéis de serviço: blocos de cor contíguos, cada um com um enquadramento por proporção (16:9, 9:16, 4:5)
 * e um motivo da marca. O painel inteiro é clicável. Funciona com qualquer número de itens (3 por linha).
 */
export function ServicePanels({
  items,
  headingLevel = 3,
  className,
}: {
  items: ServicePanelItem[];
  headingLevel?: 2 | 3;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h2" | "h3";
  const cols = items.length <= 3 ? items.length : items.length === 4 ? 2 : 3;
  return (
    <ul className={cn("s-panels", className)} style={{ "--cols": cols } as CSSProperties}>
      {items.map((item, i) => {
        const look = PANEL_LOOKS[i % PANEL_LOOKS.length];
        const href = safeHref(item.href);
        return (
          <li key={i} className="s-panel" data-tone={look.tone} {...revealProps(i % 3)}>
            <div className="s-panel__top">
              <span className="s-panel__n" aria-hidden="true">
                {pad2(i + 1)}
                <span>/{pad2(items.length)}</span>
              </span>
              {href ? <Icon name="arrow-ne" className="s-panel__arrow" /> : null}
            </div>
            <div className="s-panel__motif">
              <RatioFrame kind={look.kind} />
            </div>
            <Title className="s-panel__title">{href ? <SmartLink href={href}>{item.title}</SmartLink> : item.title}</Title>
            {item.text ? <p className="s-panel__text">{item.text}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- valores
/** Lista de valores/princípios em 4 colunas, cada título com o acento do logo. */
export function ValuesList({ items, className }: { items: { title: string; text: string }[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <dl className={cn("s-values__list", className)}>
      {items.map((item, i) => (
        <div key={i} className="s-value" {...revealProps(i % 4)}>
          <dt>{item.title}</dt>
          <dd>{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ passos
/**
 * Passos numerados. No desktop, com `stairs`, viram uma escada que cruza o grid (até 8 passos);
 * `action` (um botão) ocupa o canto inferior esquerdo, sob a escada.
 */
export function Steps({
  items,
  stairs = true,
  action,
  headingLevel = 3,
  className,
}: {
  items: { title: string; text: string }[];
  stairs?: boolean;
  action?: ReactNode;
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  const useStairs = stairs && items.length >= 3;
  // quantas colunas cada degrau avança para a escada terminar na última coluna
  const shift = useStairs ? Math.max(1, Math.floor(8 / (items.length - 1))) : 0;
  return (
    <div className={cn("s-stairs", className)} data-stairs={useStairs ? "true" : undefined}>
      <ol className="s-steps" style={{ "--shift": shift } as CSSProperties}>
        {items.map((item, i) => (
          <li
            key={i}
            className="s-step"
            data-reveal=""
            style={{ "--i": i, "--d": i % 5 } as CSSProperties}
          >
            <span className="s-step__n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <div className="s-step__c">
              <Title>
                <span className="sr-only">Passo {i + 1}: </span>
                {item.title}
              </Title>
              {item.text ? <p>{item.text}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {action ? <p className="s-stairs__cta">{action}</p> : null}
    </div>
  );
}

// --------------------------------------------------------------------- FAQ
/**
 * Acordeão de perguntas com <details>/<summary> nativo: funciona sem JS, é navegável por teclado e, com
 * `name`, abre uma resposta por vez. As respostas aceitam markdown leve.
 */
export function FaqAccordion({
  items,
  name = "faq",
  openFirst = true,
  headingLevel = 3,
  className,
}: {
  items: { id: number | string; question: string; answer: string }[];
  /** Nome do grupo (uma resposta aberta por vez). Use nomes diferentes se houver dois acordeões na página. */
  name?: string;
  openFirst?: boolean;
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <div className={cn("s-faq", className)}>
      {items.map((item, i) => (
        <details key={item.id} className="s-faq__item" name={name} open={openFirst && i === 0}>
          <summary className="s-faq__q">
            <Title>{item.question}</Title>
            <span className="s-faq__ico" aria-hidden="true" />
          </summary>
          <Markdown className="s-faq__a">{item.answer}</Markdown>
        </details>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------- canais
export type ContactChannel = { label: string; value: string; href: string; icon?: IconName };

/** Lista de canais de contato (WhatsApp, Instagram, e-mail…) em linhas com fio. Só renderiza canais com link válido. */
export function ContactChannels({ channels, className }: { channels: ContactChannel[]; className?: string }) {
  const valid = channels.filter((channel) => channel.href);
  if (valid.length === 0) return null;
  return (
    <ul className={cn("s-channels", className)}>
      {valid.map((channel) => {
        const external = /^https?:/i.test(channel.href);
        return (
          <li key={channel.label}>
            <a href={channel.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <span className="s-channels__label">{channel.label}</span>
              <span className="s-channels__value">{channel.value}</span>
              <Icon name={channel.icon ?? "arrow-ne"} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------- faixa de chamada
/** Faixa de fechamento das páginas internas: título gigante + texto + botão(ões) sobre um bloco de cor. */
export function CtaBand({
  title,
  text,
  cta,
  secondaryCta,
  tone = "roxo",
  id,
}: {
  title: string;
  text?: string | null;
  cta?: { label: string; href: string } | null;
  secondaryCta?: { label: string; href: string; icon?: IconName } | null;
  tone?: SiteTone;
  id?: string;
}) {
  return (
    <section className="s-band" data-tone={tone} aria-labelledby={id}>
      <div className="s-wrap s-band__grid">
        <div className="s-band__call">
          <Display id={id} accent="marked">
            {title}
          </Display>
          {text ? <p className="s-lead s-band__text">{text}</p> : null}
        </div>
        {cta || secondaryCta ? (
          <div className="s-band__actions">
            {cta ? (
              <SiteButtonLink href={cta.href} block>
                {cta.label}
              </SiteButtonLink>
            ) : null}
            {secondaryCta ? (
              <SiteButtonLink href={secondaryCta.href} variant="secondary" icon={secondaryCta.icon ?? "arrow-ne"} block>
                {secondaryCta.label}
              </SiteButtonLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
