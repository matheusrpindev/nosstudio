/**
 * Um banner do carrossel da página inicial (briefing v2, seção 04). É o MESMO componente no site e na prévia do
 * painel — arquivo sem dependência de servidor (serve em Server e Client Components).
 *
 * Três montagens (`banner.layout`):
 * - `tipografico`: composição da marca, sem mídia. A cor de fundo escolhe o tom e o motivo — roxo: visor + o Ó
 *   do logo; grafite/preto: o play; lima: o acento; lavanda: os anéis; off-white/branco: papel com campo roxo.
 * - `midia`: imagem (ou vídeo) cobrindo o banner, com um véu que garante o contraste do texto por cima.
 * - `peca`: arte já diagramada ocupando tudo, sem cortes; o título e a descrição viram texto acessível e o
 *   banner inteiro é o link do botão principal.
 *
 * Medidas: 12:5 (1920 × 800) a partir de 640px de largura e 4:5 (1080 × 1350) abaixo disso — ver banner.css,
 * que usa consultas de CONTÊINER: o banner responde à largura do bloco em que está, não à da janela (é o que
 * permite a prévia "celular" dentro do painel).
 *
 * `symbol`: o Ó do logo (<Logo variant="simbolo" tone="branco" label="" />). É um Server Component pesado; quem
 * renderiza o banner num Client Component recebe o logo por prop e repassa aqui.
 */
import type { CSSProperties, ReactNode } from "react";
import type { BrandColor } from "@/lib/domain";
import { pieceAccessibleName, type BannerView, type BannerViewport } from "@/lib/site/banners";
import { BannerMedia } from "./banner-media";
import { bannerTitleLines, bannerTitleMetrics } from "./banner-title";
import { SiteButtonLink, SmartLink } from "./button";
import { AccentMark, PlayMark, RecDot, RingsMark, ViewfinderFrame } from "./marks";
import "./banner.css";

type Motif = "symbol" | "play" | "accent" | "rings" | "field";

/** Tom do site (`data-tone`: cores de texto, fios e botões) e motivo da marca para cada cor de fundo. */
const COMPOSITIONS: Record<BrandColor, { tone: "roxo" | "grafite" | "lavanda" | "paper"; motif: Motif }> = {
  roxo: { tone: "roxo", motif: "symbol" },
  grafite: { tone: "grafite", motif: "play" },
  preto: { tone: "grafite", motif: "play" },
  lima: { tone: "lavanda", motif: "accent" },
  lavanda: { tone: "lavanda", motif: "rings" },
  offwhite: { tone: "paper", motif: "field" },
  branco: { tone: "paper", motif: "field" },
};

/** Marcação que o coletor de cliques do site lê (`data-track`). */
export const bannerTrackId = (id: number) => `banner:${id}`;

function Art({ motif, symbol }: { motif: Motif; symbol?: ReactNode }) {
  // sem o logo (não foi passado), o play do Ó ocupa o lugar do símbolo
  const mark = symbol ?? <PlayMark className="s-banner__play" />;
  return (
    <div className="s-banner__art" data-motif={motif} aria-hidden="true">
      {motif === "symbol" ? (
        <>
          <ViewfinderFrame />
          <RecDot className="s-banner__rec" />
          <span className="s-banner__mark">{mark}</span>
        </>
      ) : null}
      {motif === "field" ? (
        <div className="s-banner__field" data-tone="roxo">
          <ViewfinderFrame />
          <RecDot className="s-banner__rec" />
          <span className="s-banner__mark">{mark}</span>
        </div>
      ) : null}
      {motif === "play" ? (
        <>
          <ViewfinderFrame />
          <RecDot className="s-banner__rec" />
          <PlayMark className="s-banner__mark" />
        </>
      ) : null}
      {motif === "accent" ? (
        <>
          <AccentMark className="s-banner__mark" />
          <AccentMark className="s-banner__mark s-banner__mark--2" />
        </>
      ) : null}
      {motif === "rings" ? <RingsMark className="s-banner__mark" /> : null}
    </div>
  );
}

export function BannerSlide({
  banner,
  eyebrow,
  symbol,
  priority = false,
  viewport,
  titleAs: Title = "h2",
}: {
  banner: BannerView;
  /** Linha de apoio acima do título (a assinatura do site: "Marketing • Conteúdo • Audiovisual"). */
  eyebrow?: string;
  symbol?: ReactNode;
  /** Primeiro banner do carrossel: a imagem carrega com prioridade. */
  priority?: boolean;
  /** Prévia do painel: força a versão de imagem (o layout segue a largura do bloco). */
  viewport?: BannerViewport;
  /** Elemento do título. No site é `h2` (o `h1` da página fica no carrossel); na prévia do painel, `p`. */
  titleAs?: "h2" | "p";
}) {
  const track = bannerTrackId(banner.id);
  const title = banner.title.trim();
  const subtitle = banner.subtitle.trim();

  // ------------------------------------------------------------ peça pronta
  if (banner.layout === "peca") {
    const name = pieceAccessibleName(banner) || banner.primary?.label || subtitle || "Banner";
    const media = <BannerMedia desktop={banner.desktop} mobile={banner.mobile} alt={name} priority={priority} viewport={viewport} />;
    return (
      <div className="s-banner" data-layout="peca" data-bg={banner.bgColor}>
        {/* o título e o subtítulo não aparecem (já estão na arte): ficam para leitores de tela e buscadores */}
        {title && title !== name ? <Title className="sr-only">{title}</Title> : null}
        {subtitle && subtitle !== name ? <p className="sr-only">{subtitle}</p> : null}
        {banner.primary?.href ? (
          <SmartLink href={banner.primary.href} className="s-banner__piece" data-track={track}>
            {media}
          </SmartLink>
        ) : (
          <div className="s-banner__piece">{media}</div>
        )}
      </div>
    );
  }

  const lines = bannerTitleLines(title);
  const metrics = bannerTitleMetrics(lines);
  const fit = { "--b-word": metrics.word, "--b-line": metrics.line } as CSSProperties;
  const actions = [banner.primary, banner.secondary].filter((link) => link?.href && link.label).length;
  const isMedia = banner.layout === "midia";
  const composition = COMPOSITIONS[banner.bgColor] ?? COMPOSITIONS.roxo;
  // sobre mídia: texto claro = tom escuro do site (botões e fios claros); texto escuro = tom de papel
  const tone = isMedia ? (banner.tone === "escuro" ? "paper" : "grafite") : composition.tone;

  return (
    <div
      className="s-banner"
      data-layout={banner.layout}
      data-bg={isMedia ? undefined : banner.bgColor}
      data-text={isMedia ? banner.tone : undefined}
      data-tone={tone}
      data-actions={actions}
    >
      {isMedia ? (
        <BannerMedia desktop={banner.desktop} mobile={banner.mobile} video={banner.video} alt={banner.alt.trim()} priority={priority} viewport={viewport} />
      ) : (
        <Art motif={composition.motif} symbol={symbol} />
      )}
      <div className="s-wrap s-banner__in">
        {eyebrow ? <p className="s-meta s-banner__eyebrow">{eyebrow}</p> : null}
        {title ? (
          <Title className="s-banner__title" style={fit}>
            <span className="l1">{lines[0]}</span>
            {lines[1] ? (
              <>
                {" "}
                <span className="l2">{lines[1]}</span>
              </>
            ) : null}
          </Title>
        ) : null}
        {subtitle || actions > 0 ? (
          <div className="s-banner__foot">
            {subtitle ? <p className="s-lead s-banner__sub">{subtitle}</p> : null}
            {actions > 0 ? (
              <div className="s-banner__actions">
                {banner.primary ? (
                  <SiteButtonLink href={banner.primary.href} data-track={track}>
                    {banner.primary.label}
                  </SiteButtonLink>
                ) : null}
                {banner.secondary ? (
                  <SiteButtonLink href={banner.secondary.href} variant="secondary" data-track={track}>
                    {banner.secondary.label}
                  </SiteButtonLink>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Um banner parado, fora do carrossel, com o contêiner de medidas em volta (prévias do painel e banner único).
 * A largura do bloco em que for colocado decide a montagem: menos de 640px = celular.
 */
export function BannerStill({ children }: { children: ReactNode }) {
  return (
    <div className="s-banners">
      <div className="s-banners__viewport">
        <div className="s-banners__stage">
          <div className="s-banners__slide" data-active="">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
