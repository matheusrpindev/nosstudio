import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LOGO_SHAPES } from "@/components/brand/logo-data";
import { getSiteContent } from "@/server/site/queries";

/**
 * Imagem de compartilhamento padrão (1200×630) gerada com a identidade da marca.
 * Usada em Open Graph/WhatsApp quando os sócios não definiram uma imagem própria em Painel → Site → SEO.
 */
const fontDir = path.join(process.cwd(), "src/fonts/static");
const fonts = [
  { name: "Montserrat", weight: 800 as const, style: "normal" as const, data: readFileSync(path.join(fontDir, "montserrat-latin-800-normal.woff")) },
  { name: "Montserrat", weight: 500 as const, style: "normal" as const, data: readFileSync(path.join(fontDir, "montserrat-latin-500-normal.woff")) },
];

const ROXO = "#3B1F8E";
const LIMA = "#C6F432";
const LAVANDA = "#CFC6FF";
const BRANCO = "#FFFFFF";

function Bracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const size = 64;
  const [top, left] = [corner.startsWith("t"), corner.endsWith("l")];
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        [top ? "top" : "bottom"]: 40,
        [left ? "left" : "right"]: 40,
        [top ? "borderTop" : "borderBottom"]: `4px solid ${LAVANDA}`,
        [left ? "borderLeft" : "borderRight"]: `4px solid ${LAVANDA}`,
        [`border${top ? "Top" : "Bottom"}${left ? "Left" : "Right"}Radius`]: 14,
      }}
    />
  );
}

export async function GET() {
  const { general } = await getSiteContent();
  const wordmark = LOGO_SHAPES.wordmark;
  const symbol = LOGO_SHAPES.simbolo;
  // "Sua história, nosso olhar." → duas linhas, a segunda em lima
  const comma = general.tagline.indexOf(",");
  const [first, second] =
    comma > 0 ? [general.tagline.slice(0, comma + 1), general.tagline.slice(comma + 1).trim()] : [general.tagline, ""];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ROXO, color: BRANCO, fontFamily: "Montserrat", position: "relative" }}>
        <Bracket corner="tl" />
        <Bracket corner="tr" />
        <Bracket corner="bl" />
        <Bracket corner="br" />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "88px 96px", width: 800 }}>
          <svg width={150} height={(150 * wordmark.height) / wordmark.width} viewBox={`0 0 ${wordmark.width} ${wordmark.height}`}>
            <path d={wordmark.letters} fill={BRANCO} fillRule="evenodd" />
            <path d={wordmark.accent} fill={LIMA} />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>
            <span>{first}</span>
            {second ? <span style={{ color: LIMA }}>{second}</span> : null}
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: LAVANDA, letterSpacing: 1 }}>{general.descriptor}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <svg width={260} height={(260 * symbol.height) / symbol.width} viewBox={`0 0 ${symbol.width} ${symbol.height}`}>
            <path d={symbol.letters} fill={BRANCO} fillRule="evenodd" />
            <path d={symbol.accent} fill={LIMA} />
          </svg>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
