import { Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatDate, nowLocal } from "@/lib/dates";
import { BRAND_COLOR_HEX } from "@/lib/domain";
import { ANNOUNCEMENT_PAGE_SHORT_LABELS, normalizeAnnouncementPages, type AnnouncementPageKey } from "@/lib/site/announcement-pages";
import { announcementHiddenPages, announcementStatuses, type AnnouncementStatus } from "@/server/site/admin/announcement-status";
import { listAnnouncements } from "@/server/site/admin/announcements";
import { MoveButtons, RowSwitch } from "../_colecoes/row-controls";
import { moveAnnouncementAction, toggleAnnouncementAction } from "./actions";
import { AnnouncementPreview } from "./preview";

export const metadata: Metadata = { title: "Avisos do site" };
export const instant = false;

const STATUS: Record<AnnouncementStatus, { label: string; tone: BadgeTone }> = {
  no_ar: { label: "No ar agora", tone: "sucesso" },
  na_fila: { label: "Ligado, mas outro aviso aparece antes em todas as páginas dele", tone: "alerta" },
  agendado: { label: "Agendado", tone: "roxo" },
  encerrado: { label: "Período encerrado", tone: "neutral" },
  desligado: { label: "Desligado", tone: "neutral" },
};

const formatLocal = (value: string) => `${formatDate(value.slice(0, 10))} às ${value.slice(11, 16)}`;

function period(startsAt: string | null, endsAt: string | null): string {
  if (startsAt && endsAt) return `De ${formatLocal(startsAt)} até ${formatLocal(endsAt)}`;
  if (startsAt) return `A partir de ${formatLocal(startsAt)}`;
  if (endsAt) return `Até ${formatLocal(endsAt)}`;
  return "Sem data para acabar";
}

const pageNames = (keys: readonly string[]) => keys.map((key) => ANNOUNCEMENT_PAGE_SHORT_LABELS[key as AnnouncementPageKey] ?? key).join(", ");

export default async function AnnouncementsPage() {
  await requirePermission("site", "ver");
  const rows = await listAnnouncements();
  const now = nowLocal();
  const statuses = announcementStatuses(rows, now);
  const live = rows.some((row) => statuses.get(row.id) === "no_ar");

  return (
    <>
      <PageHeader
        title="Avisos do site"
        description="A barra no topo do site, para recados como férias, datas de contato ou novidades."
        actions={
          <ButtonLink href="/painel/site/avisos/novo" icon={<Plus />}>
            Novo aviso
          </ButtonLink>
        }
      />

      <Alert tone="info" className="mb-5">
        Cada página do site mostra <strong>um aviso por vez</strong>: o primeiro da lista que estiver ligado, dentro do período e valer para aquela página. Use as setas para mudar a ordem. As cores abaixo são as mesmas que o visitante vê.
      </Alert>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="Nenhum aviso criado"
          description="O site fica sem barra no topo. Crie um aviso quando precisar dar um recado aos visitantes."
          action={
            <ButtonLink href="/painel/site/avisos/novo" icon={<Plus />}>
              Criar o primeiro aviso
            </ButtonLink>
          }
        />
      ) : (
        <>
          {!live ? (
            <p className="text-texto-suave mb-3 text-sm" role="status">
              Nenhum aviso está no ar agora: o site está sem barra no topo.
            </p>
          ) : null}
          <ul className="space-y-4">
            {rows.map((row, index) => {
              const status = STATUS[statuses.get(row.id) ?? "desligado"];
              const label = row.message.length > 40 ? `${row.message.slice(0, 40)}…` : row.message;
              const pages = normalizeAnnouncementPages(row.pages);
              const hidden = announcementHiddenPages(rows, row.id, now);
              return (
                <li key={row.id} className="card space-y-3 p-4">
                  <AnnouncementPreview message={row.message} linkLabel={row.linkUrl ? row.linkLabel : null} bg={BRAND_COLOR_HEX[row.bgColor]} fg={BRAND_COLOR_HEX[row.textColor]} dismissible={row.dismissible} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                    <span className="text-texto-suave text-[0.8125rem]">
                      {period(row.startsAt, row.endsAt)} · {pages.length === 0 ? "Todas as páginas" : `Só em: ${pageNames(pages)}`}
                      {hidden.length > 0 ? ` · em ${pageNames(hidden)} aparece outro aviso antes` : ""}
                    </span>
                    <div className="ml-auto flex items-center gap-3">
                      <RowSwitch id={row.id} checked={row.enabled} label={`Aviso “${label}” ligado`} action={toggleAnnouncementAction} />
                      <MoveButtons id={row.id} name={label} isFirst={index === 0} isLast={index === rows.length - 1} action={moveAnnouncementAction} />
                      <ButtonLink href={`/painel/site/avisos/${row.id}`} variant="secondary">
                        Editar
                      </ButtonLink>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
