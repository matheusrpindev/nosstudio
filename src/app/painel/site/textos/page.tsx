import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { SECTION_ORDER, SITE_SECTIONS } from "./config";
import { getSectionInfos } from "./store";

export const metadata: Metadata = { title: "Textos do site" };
export const instant = false;

export default async function SiteTextsPage() {
  await requireUser();
  const infos = await getSectionInfos(SECTION_ORDER);

  return (
    <>
      <PageHeader
        title="Textos do site"
        description="Escolha a parte do site que quer editar. Enquanto uma seção não for editada, o site mostra o texto original combinado com vocês."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_ORDER.map((key) => {
          const section = SITE_SECTIONS[key];
          const info = infos[key];
          return (
            <li key={key}>
              <Link
                href={`/painel/site/textos/${key}`}
                className="card card-pad group hover:border-detalhe focus-visible:border-foco flex h-full min-h-32 flex-col gap-2 transition-colors"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-texto text-base leading-snug font-bold">{section.title}</span>
                  <ArrowUpRight aria-hidden="true" className="text-borda-forte group-hover:text-detalhe size-4 shrink-0" />
                </span>
                <span className="text-texto-suave text-sm leading-relaxed">{section.summary}</span>
                <span className="mt-auto pt-1 text-xs">
                  {info.customized ? (
                    <span className="text-texto-suave flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone="roxo">Editado</Badge>
                      {info.updatedAt ? <DateText value={info.updatedAt} format="relative" /> : null}
                    </span>
                  ) : (
                    <Badge tone="neutral">Texto original</Badge>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
