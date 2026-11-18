/**
 * Apresentação dos projetos compartilhada entre as telas do módulo.
 * Os RÓTULOS vêm de `src/lib/domain.ts`; aqui ficam só os TONS e pequenos componentes visuais.
 */
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import type { BackupStatus, ProjectStage } from "@/lib/domain";
import { deadlineLabel, deadlineStatus, type ProjectLinkEntry } from "@/server/projects/logic";

export const PROJECT_STAGE_TONES: Record<ProjectStage, BadgeTone> = {
  briefing: "neutral",
  planejamento: "neutral",
  gravacao: "roxo",
  edicao: "roxo",
  revisao: "alerta",
  entregue: "sucesso",
  cancelado: "neutral",
};

export const BACKUP_TONES: Record<BackupStatus, BadgeTone> = {
  pendente: "alerta",
  parcial: "roxo",
  ok: "sucesso",
};

/** Destaque do prazo de entrega: atrasado (vermelho) ou esta semana (amarelo). Nada quando está tranquilo. */
export function DeadlineBadge({ deadline, stage, today }: { deadline: ISODate | null; stage: ProjectStage; today: ISODate }) {
  const status = deadlineStatus(deadline, stage, today);
  const label = deadlineLabel(status);
  if (!label) return null;
  return <Badge tone={status.kind === "atrasado" ? "perigo" : "alerta"}>{label}</Badge>;
}

/** Chips de links de arquivos (abrem em nova aba). Alvo de toque de 44px no celular. */
export function LinkChips({ links, empty = "Nenhum link ainda" }: { links: readonly ProjectLinkEntry[]; empty?: string }) {
  if (links.length === 0) return <span className="text-cinza">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0 max-md:justify-end">
      {links.map((link) => (
        <li key={link.key}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link inline-flex min-h-11 items-center gap-1 text-[0.8125rem] font-semibold whitespace-nowrap md:min-h-8"
          >
            {link.label}
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

const SWITCH_BASE =
  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-roxo";

/** Alternância de visões da lista (link por visão; o estado vive na URL). */
export function ViewSwitch({ items, current }: { items: readonly { value: string; label: string; href: string }[]; current: string }) {
  return (
    <nav aria-label="Visões de projetos" className="bg-areia/60 -mx-0 mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
      {items.map((item) => {
        const active = item.value === current;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(SWITCH_BASE, active ? "bg-roxo text-offwhite shadow-sm" : "text-grafite/80 hover:bg-white/70 hover:text-roxo")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
