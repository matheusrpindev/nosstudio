import { ExternalLink, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { canEverywhere } from "@/lib/permissions";
import { HOME_SECTION_INFO } from "@/lib/site/home-layout";
import { getHomeLayoutForEdit } from "@/server/site/home-layout";
import { moveHomeSectionAction, reorderHomeSectionsAction, resetHomeLayoutAction, toggleHomeSectionAction } from "./actions";
import { SectionsEditor, type SectionRow } from "./sections-editor";
import { getHomeSectionStatus } from "./status";

export const metadata: Metadata = { title: "Página inicial do site" };
export const instant = false;

/**
 * Ordem e visibilidade das seções da página inicial (briefing v2, seção 03: "permitir reorganizar e ocultar
 * seções"). O topo e o rodapé são fixos; o conteúdo de cada seção é editado na tela indicada em "Conteúdo".
 */
export default async function HomeLayoutPage() {
  const user = await requirePermission("site", "ver");
  const canEdit = canEverywhere(user, "site", "editar");
  const [{ layout, customized }, status] = await Promise.all([getHomeLayoutForEdit(), getHomeSectionStatus()]);

  const rows: SectionRow[] = layout.map((item) => ({
    id: item.id,
    visible: item.visible,
    ...HOME_SECTION_INFO[item.id],
    ...status[item.id],
  }));
  const waiting = rows.filter((row) => row.visible && !row.hasContent).length;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Página inicial"
        description="Escolha a ordem das seções da página inicial e quais aparecem. Arraste pela alça ou use as setas; a chave liga e desliga. O site muda na hora."
        actions={
          <ButtonLink href="/" external variant="secondary" icon={<ExternalLink />}>
            Ver a página inicial
          </ButtonLink>
        }
      />

      <Alert tone="info" title="O que fica fixo" className="mb-5">
        A barra de avisos, o menu, o topo da página (onde entrará o carrossel de banners) e o rodapé não entram nesta lista: ficam sempre no mesmo lugar. Seção ligada
        mas sem conteúdo publicado não aparece no site{waiting > 0 ? ` — hoje ${waiting === 1 ? "há 1 nessa situação" : `há ${waiting} nessa situação`}` : ""}.
      </Alert>

      <SectionsEditor rows={rows} canEdit={canEdit} moveAction={moveHomeSectionAction} reorderAction={reorderHomeSectionsAction} toggleAction={toggleHomeSectionAction} />

      {canEdit ? (
        <Card as="section" aria-labelledby="restaurar-ordem" className="mt-6">
          <CardHeader
            id="restaurar-ordem"
            title="Voltar à ordem original"
            description={
              customized
                ? "A ordem ou a visibilidade foi alterada. Restaurar devolve a sequência combinada no briefing, com todas as seções ligadas."
                : "A página inicial está na ordem combinada no briefing, com todas as seções ligadas."
            }
            action={
              customized ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="danger-ghost" icon={<RotateCcw />}>
                      Restaurar ordem original
                    </Button>
                  }
                  title="Restaurar a ordem original?"
                  description="A página inicial volta à sequência do briefing e todas as seções são ligadas de novo. Os textos não mudam."
                  confirmLabel="Restaurar ordem original"
                  action={resetHomeLayoutAction}
                />
              ) : null
            }
          />
        </Card>
      ) : null}
    </div>
  );
}
