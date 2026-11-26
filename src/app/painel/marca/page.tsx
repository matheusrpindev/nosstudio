import { Download, ExternalLink, FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { BRAND_ASSET_CATEGORIES, BRAND_ASSET_CATEGORY_LABELS, BRAND_COLOR_HEX, BRAND_COLOR_LABELS, type BrandColor } from "@/lib/domain";
import { safeUrl } from "@/lib/format";
import { listBrandAssets, type BrandAssetItem } from "@/server/brand/admin";
import { AssetActions } from "./asset-actions";
import { CopyHexButton } from "./copy-hex";

export const metadata: Metadata = { title: "Marca" };
export const instant = false;

const PALETTE: readonly BrandColor[] = ["roxo", "lima", "lavanda", "offwhite", "grafite"];
const PALETTE_ROLE: Record<string, string> = {
  roxo: "Cor principal",
  lima: "Destaque pontual",
  lavanda: "Apoio suave",
  offwhite: "Fundo claro",
  grafite: "Texto e fundo escuro",
};
/** Cores claras precisam de borda para a amostra não sumir no fundo da página. */
const LIGHT_SWATCHES = new Set<BrandColor>(["lima", "lavanda", "offwhite"]);

/** SVGs do logo que vêm com o site (`/brand/*.svg`): são os únicos arquivos da marca que o site público serve. */
const isLogoSvg = (item: BrandAssetItem) => item.category === "logo" && /^\/brand\/[a-z0-9-]+\.svg$/.test(item.url);

function openLinks(item: BrandAssetItem) {
  const link = item.url.startsWith("/brand/") ? item.url : safeUrl(item.url);
  const file = item.file;
  const fileHref = file ? (file.mime === "application/pdf" || file.mime.startsWith("image/") ? `${file.url}?inline=1` : file.url) : null;
  return { link, file, fileHref };
}

function AssetRow({ item, first, last }: { item: BrandAssetItem; first: boolean; last: boolean }) {
  const { link, file, fileHref } = openLinks(item);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-texto font-semibold break-words">{item.title}</p>
        {item.description ? <p className="text-texto-suave mt-0.5 text-sm break-words">{item.description}</p> : null}
        {link || fileHref ? (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-8 items-center gap-1.5">
                <ExternalLink aria-hidden="true" className="size-4" />
                Abrir link<span className="sr-only"> de {item.title} (abre em nova aba)</span>
              </a>
            ) : null}
            {fileHref && file ? (
              <a href={fileHref} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-8 items-center gap-1.5">
                <FileText aria-hidden="true" className="size-4" />
                Abrir arquivo ({file.originalName})<span className="sr-only"> (abre em nova aba)</span>
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
      <AssetActions id={item.id} title={item.title} first={first} last={last} />
    </li>
  );
}

export default async function BrandPage() {
  await requireUser();
  const grouped = await listBrandAssets();
  const logos = grouped.logo.filter(isLogoSvg);
  const total = BRAND_ASSET_CATEGORIES.reduce((sum, category) => sum + grouped[category].length, 0);
  const fontLink = grouped.fontes.map((item) => safeUrl(item.url)).find(Boolean);

  return (
    <>
      <PageHeader
        title="Marca"
        description="Logos, paleta, fontes e materiais da NÓS Studio num lugar só. Tudo aqui é interno: só os SVGs do logo ficam acessíveis no site."
        actions={
          <ButtonLink href="/painel/marca/novo" icon={<Plus />}>
            Adicionar item
          </ButtonLink>
        }
      />

      <div className="space-y-4">
        {/* ----------------------------------------------------------- paleta */}
        <Card as="section" aria-labelledby="paleta-titulo">
          <CardHeader id="paleta-titulo" title="Paleta oficial" description="Toque no código para copiar. O lima nunca vai como texto sobre fundo claro (falta contraste)." />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PALETTE.map((color) => (
              <li key={color} className="flex min-w-0 flex-col gap-2">
                <div
                  aria-hidden="true"
                  className={`h-20 rounded-campo ${LIGHT_SWATCHES.has(color) ? "border-borda-forte border" : ""}`}
                  style={{ backgroundColor: BRAND_COLOR_HEX[color] }}
                />
                <div>
                  <p className="text-texto text-sm font-bold">{BRAND_COLOR_LABELS[color]}</p>
                  <p className="text-texto-suave text-[0.8125rem]">{PALETTE_ROLE[color]}</p>
                </div>
                <CopyHexButton hex={BRAND_COLOR_HEX[color]} name={BRAND_COLOR_LABELS[color]} />
              </li>
            ))}
          </ul>
        </Card>

        {/* ------------------------------------------------------------- logo */}
        <Card as="section" aria-labelledby="logo-titulo">
          <CardHeader id="logo-titulo" title="Versões do logo" description="Cada versão aparece sobre fundo claro e escuro. Baixe o SVG para usar em apresentações, propostas e redes." />
          {logos.length === 0 ? (
            <p className="text-texto-suave text-sm">Nenhuma versão do logo cadastrada ainda.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {logos.map((logo, index) => (
                <li key={logo.id} className="border-borda rounded-campo flex min-w-0 flex-col border">
                  <div className="grid grid-cols-2">
                    <div className="bg-superficie-alta rounded-tl-campo flex h-28 items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático do próprio site */}
                      <img src={logo.url} alt={`${logo.title} sobre fundo claro`} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="bg-grafite rounded-tr-campo flex h-28 items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático do próprio site */}
                      <img src={logo.url} alt={`${logo.title} sobre fundo escuro`} className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="text-texto text-sm leading-snug font-bold break-words">{logo.title}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-1">
                      <a href={logo.url} download className="btn btn-secondary btn-sm min-h-11 sm:min-h-9">
                        <span className="btn-icone" aria-hidden="true">
                          <Download />
                        </span>
                        Baixar SVG<span className="sr-only"> — {logo.title}</span>
                      </a>
                      <AssetActions id={logo.id} title={logo.title} first={index === 0} last={index === logos.length - 1} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------------- tipografia */}
        <Card as="section" aria-labelledby="tipografia-titulo">
          <CardHeader
            id="tipografia-titulo"
            title="Tipografia"
            description="Montserrat é a única fonte da marca (Google Fonts, licença aberta). Títulos em peso forte, textos em regular."
            action={
              fontLink ? (
                <ButtonLink href={fontLink} external variant="secondary" size="sm" icon={<ExternalLink />}>
                  Baixar a fonte
                </ButtonLink>
              ) : undefined
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-superficie-alta rounded-campo p-4">
              <p className="text-texto-suave text-[0.8125rem] font-semibold">Montserrat ExtraBold (800)</p>
              <p className="text-detalhe mt-1 text-3xl leading-tight font-extrabold tracking-tight break-words">Nós criamos junto.</p>
            </div>
            <div className="bg-superficie-alta rounded-campo p-4">
              <p className="text-texto-suave text-[0.8125rem] font-semibold">Montserrat Regular (400) e SemiBold (600)</p>
              <p className="text-texto mt-1 text-base leading-relaxed">Marketing, conteúdo e audiovisual com cara de gente. <strong className="font-semibold">Abc Def Ghi 0123456789</strong></p>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------- biblioteca */}
      <h2 className="text-texto mt-10 mb-1 text-xl font-extrabold">Biblioteca</h2>
      <p className="text-texto-suave mb-4 text-sm">Links e arquivos por categoria. Use as setas para mudar a ordem dentro de cada grupo.</p>

      {total === 0 ? (
        <EmptyState icon={<FileText />} title="Biblioteca vazia" description="Adicione links do Drive ou do Canva, templates e arquivos da marca." action={<ButtonLink href="/painel/marca/novo" icon={<Plus />}>Adicionar item</ButtonLink>} />
      ) : null}

      <div className="space-y-4">
        {BRAND_ASSET_CATEGORIES.map((category) => {
          // as versões do logo com prévia já estão no destaque acima; aqui ficam só os demais itens do grupo
          const items = category === "logo" ? grouped.logo.filter((item) => !isLogoSvg(item)) : grouped[category];
          if (category === "logo" && items.length === 0 && logos.length > 0) return null;
          return (
            <Card as="section" key={category} aria-labelledby={`cat-${category}`}>
              <CardHeader
                id={`cat-${category}`}
                title={BRAND_ASSET_CATEGORY_LABELS[category]}
                as="h3"
                action={
                  <ButtonLink href={`/painel/marca/novo?categoria=${category}`} variant="ghost" size="sm" icon={<Plus />} aria-label={`Adicionar em ${BRAND_ASSET_CATEGORY_LABELS[category]}`}>
                    <span className="max-sm:sr-only">Adicionar</span>
                  </ButtonLink>
                }
              />
              {items.length === 0 ? (
                <p className="text-texto-suave text-sm">Nada aqui ainda.</p>
              ) : (
                <ul className="divide-borda divide-y">
                  {items.map((item, index) => (
                    <AssetRow key={item.id} item={item} first={index === 0} last={index === items.length - 1} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Alert tone="info" className="mt-6">
        Itens com arquivo ficam privados: só abrem para quem está logado no painel.
      </Alert>
    </>
  );
}
