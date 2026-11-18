import { CalendarClock, ListChecks, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DateText } from "@/components/ui/text";
import type { ISODate } from "@/lib/dates";
import { SERVICE_INTEREST_LABELS } from "@/lib/domain";
import type { ProjectListItem } from "@/server/projects/admin";
import { checklistProgress } from "@/server/projects/logic";
import { DeadlineBadge } from "../ui";

/** Miolo do cartão do quadro (Server Component, passado ao `<Board>` em `content`). */
export function ProjectCard({ project, today }: { project: ProjectListItem; today: ISODate }) {
  const progress = checklistProgress(project.checklist);
  return (
    <div className="space-y-2">
      <div>
        <Link href={`/painel/projetos/${project.id}`} className="text-grafite hover:text-roxo block text-[0.9375rem] leading-snug font-semibold break-words">
          {project.title}
        </Link>
        {project.clientName ? <span className="text-cinza block text-[0.8125rem] break-words">{project.clientName}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">
          {SERVICE_INTEREST_LABELS[project.serviceType]}
        </Badge>
        <DeadlineBadge deadline={project.deliveryDeadline} stage={project.stage} today={today} />
      </div>
      <dl className="text-cinza flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {project.deliveryDeadline ? (
          <div className="flex items-center gap-1">
            <dt className="sr-only">Prazo de entrega</dt>
            <CalendarClock aria-hidden="true" className="size-3.5" />
            <dd>
              <DateText value={project.deliveryDeadline} format="short" />
            </dd>
          </div>
        ) : null}
        {progress.total > 0 ? (
          <div className="flex items-center gap-1">
            <dt className="sr-only">Checklist</dt>
            <ListChecks aria-hidden="true" className="size-3.5" />
            <dd className="tabular-nums">
              {progress.done}/{progress.total}
            </dd>
          </div>
        ) : null}
        {project.ownerName ? (
          <div className="flex items-center gap-1">
            <dt className="sr-only">Responsável</dt>
            <UserRound aria-hidden="true" className="size-3.5" />
            <dd>{project.ownerName.split(" ")[0]}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
