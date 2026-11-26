import { ExternalLink, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { MediaValue } from "@/components/ui/media-fields";
import { PageHeader } from "@/components/ui/page-header";
import { paramText, type PageSearchParams } from "@/components/ui/search-params";
import { DateText } from "@/components/ui/text";
import { requirePermission } from "@/lib/auth";
import { env } from "@/lib/env";
import { getMediaValues } from "@/server/media";
import { getSiteContentForEdit } from "@/server/site/content";
import { restoreSectionAction, saveSectionAction } from "../actions";
import { isSiteContentKey, SITE_SECTIONS, sectionFields } from "../config";
import { SectionForm } from "../section-form";
import { getSectionInfos } from "../store";

export const metadata: Metadata = { title: "Editar texto do site" };
export const instant = false;

type Props = { params: Promise<{ secao: string }>; searchParams: PageSearchParams };

/** Ids de imagens guardados na seção (campos de imagem e imagens dentro de itens de lista). */
function collectMediaIds(content: unknown, key: keyof typeof SITE_SECTIONS): number[] {
  const get = (node: unknown, path: string) => path.split(".").reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], node);
  const ids: number[] = [];
  for (const field of sectionFields(SITE_SECTIONS[key])) {
    if (field.type === "image") {
      const id = get(content, field.path);
      if (typeof id === "number") ids.push(id);
    } else if (field.type === "list") {
      const items = get(content, field.path);
      if (!Array.isArray(items)) continue;
      for (const spec of field.items.filter((s) => s.type === "image")) {
        for (const item of items) {
          const id = (item as Record<string, unknown>)[spec.key];
          if (typeof id === "number") ids.push(id);
        }
      }
    }
  }
  return ids;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "seusite.com.br";
  }
}

export default async function SiteTextSectionPage({ params, searchParams }: Props) {
  await requirePermission("site", "editar");
  const { secao } = await params;
  if (!isSiteContentKey(secao)) notFound();
  const sp = await searchParams;

  const section = SITE_SECTIONS[secao];
  const [content, infos] = await Promise.all([getSiteContentForEdit(secao), getSectionInfos([secao])]);
  const info = infos[secao];
  const mediaIds = collectMediaIds(content, secao);
  const values = await getMediaValues(mediaIds);
  const media: Record<number, MediaValue> = Object.fromEntries(values.map((value) => [value.id, value]));

  return (
    <>
      <PageHeader
        title={section.title}
        description={section.summary}
        back={{ href: "/painel/site/textos", label: "Textos do site" }}
        badge={info.customized ? <Badge tone="roxo">Editado</Badge> : <Badge tone="neutral">Texto original</Badge>}
        actions={
          <ButtonLink href={section.publicPath} external variant="secondary" icon={<ExternalLink />}>
            Ver no site
          </ButtonLink>
        }
      />

      <SectionForm
        // o parâmetro muda a cada "restaurar": remonta o formulário já com os textos originais
        key={paramText(sp.restaurado) ?? "editando"}
        sectionKey={secao}
        initial={content}
        media={media}
        siteHost={hostOf(env.siteUrl)}
        action={saveSectionAction}
      />

      <Card as="section" aria-labelledby="restaurar" className="mt-6">
        <CardHeader
          id="restaurar"
          title="Voltar ao texto original"
          description={
            info.customized ? (
              <>
                Esta seção foi editada
                {info.updatedAt ? (
                  <>
                    {" "}
                    <DateText value={info.updatedAt} format="datetime" />
                  </>
                ) : null}
                {info.updatedByName ? ` por ${info.updatedByName}` : ""}. Restaurar apaga as suas edições e devolve o texto combinado no briefing.
              </>
            ) : (
              "Esta seção ainda usa o texto original do briefing. Quando você salvar uma edição, poderá voltar a ele por aqui."
            )
          }
          action={
            info.customized ? (
              <ConfirmDialog
                trigger={
                  <Button variant="danger-ghost" icon={<RotateCcw />}>
                    Restaurar texto original
                  </Button>
                }
                title="Restaurar o texto original?"
                description={`As edições feitas em “${section.title}” serão apagadas e o site volta a mostrar o texto original. Não dá para desfazer.`}
                confirmLabel="Restaurar texto original"
                action={restoreSectionAction}
                hidden={{ _section: secao }}
              />
            ) : null
          }
        />
      </Card>
    </>
  );
}
