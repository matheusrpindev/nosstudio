import { Copy, ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { APPROVAL_STATUS_LABELS, CONTENT_STATUS_LABELS } from "@/lib/domain";
import { safeHref } from "@/lib/format";
import { getContentItem } from "@/server/content/admin";
import { getClientOptions, getUserOptions } from "@/server/options";
import { deleteContentAction, duplicateContentAction, updateContentAction } from "../actions";
import { ContentForm } from "../content-form";
import { APPROVAL_TONES, CONTENT_STATUS_TONES } from "../ui";

export const metadata: Metadata = { title: "Conteúdo" };
export const instant = false;

export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const item = await getContentItem(id);
  if (!item) notFound();
  const [clients, users] = await Promise.all([getClientOptions(), getUserOptions()]);
  const back = item.publishDate ? `/painel/conteudo?vista=calendario&mes=${item.publishDate.slice(0, 7)}` : "/painel/conteudo?vista=lista";
  const assetHref = safeHref(item.assetUrl);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={item.title}
        badge={<StatusBadge value={item.status} labels={CONTENT_STATUS_LABELS} tones={CONTENT_STATUS_TONES} />}
        description={
          <>
            {item.clientId ? (
              <Link href={`/painel/clientes/${item.clientId}`} className="link">
                {item.clientName}
              </Link>
            ) : (
              "Conteúdo da NÓS Studio"
            )}{" "}
            · <StatusBadge value={item.approvalStatus} labels={APPROVAL_STATUS_LABELS} tones={APPROVAL_TONES} />
          </>
        }
        back={{ href: back, label: "Conteúdo" }}
        actions={
          <>
            {assetHref ? (
              <ButtonLink href={assetHref} external variant="secondary" icon={<ExternalLink />}>
                Abrir material
              </ButtonLink>
            ) : null}
            <ActionForm action={duplicateContentAction} hidden={{ id: item.id }} success="none" className="contents">
              <SubmitButton variant="secondary" icon={<Copy />} pendingLabel="Duplicando…">
                Duplicar
              </SubmitButton>
            </ActionForm>
          </>
        }
      />
      <Card>
        <ContentForm
          action={updateContentAction}
          id={item.id}
          values={{
            title: item.title,
            clientId: item.clientId,
            network: item.network,
            format: item.format,
            status: item.status,
            ideaNotes: item.ideaNotes,
            script: item.script,
            caption: item.caption,
            cta: item.cta,
            recordDate: item.recordDate,
            editDeadline: item.editDeadline,
            publishDate: item.publishDate,
            approvalStatus: item.approvalStatus,
            ownerId: item.ownerId,
            assetUrl: item.assetUrl,
            notes: item.notes,
          }}
          clients={clients}
          users={users}
          submitLabel="Salvar alterações"
          cancelHref={back}
        />
      </Card>
      <Card as="section" aria-labelledby="excluir-titulo" className="mt-4">
        <CardHeader id="excluir-titulo" title="Excluir conteúdo" description="Tira o item do calendário e da lista. Não dá para desfazer — para reaproveitar a ideia, use Duplicar." />
        <ConfirmDialog
          trigger={
            <Button variant="danger-ghost" icon={<Trash2 />} className="-ml-2">
              Excluir conteúdo
            </Button>
          }
          title="Excluir este conteúdo?"
          description={
            <>
              <strong className="text-texto">{item.title}</strong> será removido e não dá para desfazer.
            </>
          }
          confirmLabel="Excluir conteúdo"
          action={deleteContentAction}
          hidden={{ id: item.id }}
        />
      </Card>
    </div>
  );
}
