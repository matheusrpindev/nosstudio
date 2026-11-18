import { ListTree } from "lucide-react";
import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { parseManual } from "./manual";

export const metadata: Metadata = { title: "Ajuda" };
export const instant = false;

const MANUAL_PATH = path.join(process.cwd(), "docs", "manual-do-painel.md");

async function loadManual(): Promise<string | null> {
  try {
    return await readFile(MANUAL_PATH, "utf8");
  } catch {
    return null;
  }
}

export default async function HelpPage() {
  await requireUser();
  const source = await loadManual();
  const manual = source?.trim() ? parseManual(source) : null;

  if (!manual) {
    return (
      <>
        <PageHeader title="Ajuda" description="O manual de uso do painel, para consultar quando precisar." />
        <Alert tone="alerta" title="O manual não está disponível agora">
          Não encontramos o arquivo do manual neste servidor. Avise o responsável técnico: o texto está no projeto, em docs/manual-do-painel.md.
        </Alert>
      </>
    );
  }

  const toc = (
    <ol className="space-y-0.5 text-sm">
      {manual.sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="text-grafite hover:text-roxo hover:bg-offwhite focus-visible:bg-offwhite -mx-2 flex min-h-11 items-center rounded-md px-2 py-1.5 leading-snug font-semibold lg:min-h-9"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <PageHeader title="Ajuda" description="O manual de uso do painel, para consultar no computador ou no celular." />

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <details className="card card-pad group lg:hidden">
            <summary className="text-grafite flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
              <ListTree aria-hidden="true" className="text-roxo size-5" />
              Neste manual
            </summary>
            <nav aria-label="Sumário do manual" className="mt-2">
              {toc}
            </nav>
          </details>
          <nav aria-label="Sumário do manual" className="hidden lg:block">
            <p className="text-cinza mb-2 text-xs font-bold tracking-wider uppercase">Neste manual</p>
            {toc}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          {manual.intro ? <Markdown className="text-grafite">{manual.intro}</Markdown> : null}
          {manual.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titulo`} className="scroll-mt-20 pt-8 lg:scroll-mt-6">
              <h2 id={`${section.id}-titulo`} className="text-grafite border-areia border-b pb-2 text-2xl leading-tight font-extrabold">
                {section.title}
              </h2>
              <Markdown className="text-grafite mt-4">{section.markdown}</Markdown>
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
