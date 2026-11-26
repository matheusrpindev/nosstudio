import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canEverywhere, requirePermission } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AGENDA_CALENDAR_KIND_LABELS, AGENDA_DERIVED_CALENDAR_KINDS, AGENDA_FALLBACK_CATEGORY_SLUG, type AgendaColor } from "@/lib/domain";
import { listCalendars, listCategories, listChecklistTemplates } from "@/server/agenda/queries";
import { CREATABLE_CALENDAR_KINDS } from "@/server/agenda/settings";
import { CategoryIcon } from "../icons";
import { TONE_CLASS } from "../ui";
import { AGENDA_PATH } from "../url";
import { moveCalendarAction, moveCategoryAction, moveChecklistTemplateAction, setCalendarActiveAction, setCategoryActiveAction } from "./actions";
import { ActiveButton, CalendarDialog, CategoryDialog, DeleteTemplateButton, MoveButtons, TemplateDialog } from "./forms";

export const metadata: Metadata = { title: "Configurar agenda" };
export const instant = false;

function Row({ color, icon, name, badges, inactive, children }: { color?: AgendaColor; icon?: ReactNode; name: string; badges?: ReactNode; inactive?: boolean; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
      <span className={cn("flex min-w-0 flex-1 basis-56 items-center gap-2.5", inactive && "opacity-60")}>
        {color ? <span aria-hidden="true" className={cn("agenda-ponto size-3", TONE_CLASS[color])} /> : null}
        {icon}
        <span className="text-texto min-w-0 text-sm font-semibold break-words">{name}</span>
        <span className="flex flex-wrap gap-1.5">{badges}</span>
      </span>
      <span className="flex flex-wrap items-center justify-end">{children}</span>
    </li>
  );
}

export default async function AgendaConfigPage() {
  const user = await requirePermission("agenda", "editar");
  const canDelete = canEverywhere(user, "agenda", "excluir");
  const [categories, calendars, templates] = await Promise.all([
    listCategories({ includeInactive: true }),
    listCalendars({ includeInactive: true, includeDerived: true }),
    listChecklistTemplates({ includeInactive: true }),
  ]);
  const categoryOptions = categories.filter((category) => category.active).map((category) => ({ value: category.id, label: category.name }));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Configurar agenda" description="Categorias, agendas e modelos de checklist. Nada é apagado: desativar só tira das listas de escolha." back={{ href: AGENDA_PATH, label: "Agenda" }} />

      <div className="space-y-5">
        <Card flush as="section" aria-labelledby="categorias-titulo">
          <CardHeader id="categorias-titulo" title="Categorias" description="Dão cor e ícone ao compromisso." action={<CategoryDialog />} />
          <ul className="divide-borda divide-y">
            {categories.map((category, index) => (
              <Row
                key={category.id}
                color={category.color}
                icon={<CategoryIcon name={category.icon} className="text-texto-suave size-4 shrink-0" />}
                name={category.name}
                inactive={!category.active}
                badges={
                  <>
                    {category.isProduction ? <Badge tone="roxo">Produção</Badge> : null}
                    {category.blocksDay ? <Badge tone="alerta">Ocupa o dia</Badge> : null}
                    {!category.active ? <Badge>Inativa</Badge> : null}
                  </>
                }
              >
                <MoveButtons action={moveCategoryAction} id={category.id} name={category.name} first={index === 0} last={index === categories.length - 1} />
                <CategoryDialog category={{ id: category.id, name: category.name, color: category.color, icon: category.icon, blocksDay: category.blocksDay, isProduction: category.isProduction }} />
                <ActiveButton action={setCategoryActiveAction} id={category.id} name={category.name} active={category.active} locked={category.slug === AGENDA_FALLBACK_CATEGORY_SLUG} />
              </Row>
            ))}
          </ul>
        </Card>

        <Card flush as="section" aria-labelledby="agendas-titulo">
          <CardHeader
            id="agendas-titulo"
            title="Agendas"
            description="Financeira e Editorial são camadas que leem o financeiro e o calendário de conteúdo: aqui você só muda nome, cor e se aparecem."
            action={<CalendarDialog kinds={[...CREATABLE_CALENDAR_KINDS]} />}
          />
          <ul className="divide-borda divide-y">
            {calendars.map((calendar, index) => (
              <Row
                key={calendar.id}
                color={calendar.color}
                name={calendar.name}
                inactive={!calendar.active}
                badges={
                  <>
                    <Badge tone={AGENDA_DERIVED_CALENDAR_KINDS.includes(calendar.kind) ? "roxo" : "neutral"}>
                      {AGENDA_DERIVED_CALENDAR_KINDS.includes(calendar.kind) ? `Camada · ${AGENDA_CALENDAR_KIND_LABELS[calendar.kind]}` : AGENDA_CALENDAR_KIND_LABELS[calendar.kind]}
                    </Badge>
                    {!calendar.active ? <Badge>Inativa</Badge> : null}
                  </>
                }
              >
                <MoveButtons action={moveCalendarAction} id={calendar.id} name={calendar.name} first={index === 0} last={index === calendars.length - 1} />
                <CalendarDialog calendar={{ id: calendar.id, name: calendar.name, color: calendar.color, kind: calendar.kind }} kinds={[...CREATABLE_CALENDAR_KINDS]} />
                <ActiveButton action={setCalendarActiveAction} id={calendar.id} name={calendar.name} active={calendar.active} locked={calendar.slug === "geral"} />
              </Row>
            ))}
          </ul>
        </Card>

        <Card flush as="section" aria-labelledby="modelos-titulo">
          <CardHeader id="modelos-titulo" title="Modelos de checklist" description="Listas prontas para inserir num compromisso com “Usar modelo”." action={<TemplateDialog categories={categoryOptions} />} />
          {templates.length === 0 ? (
            <p className="text-texto-suave px-4 py-6 text-sm sm:px-6">Nenhum modelo ainda. Crie um para cada tipo de produção (gravação externa, casamento, ensaio…).</p>
          ) : (
            <ul className="divide-borda divide-y">
              {templates.map((template, index) => (
                <Row
                  key={template.id}
                  name={template.name}
                  badges={
                    <>
                      <Badge>
                        {template.items.length} {template.items.length === 1 ? "item" : "itens"}
                      </Badge>
                      {template.categoryId ? <Badge tone="roxo">{categoryName.get(template.categoryId) ?? "Categoria"}</Badge> : null}
                    </>
                  }
                >
                  <MoveButtons action={moveChecklistTemplateAction} id={template.id} name={template.name} first={index === 0} last={index === templates.length - 1} />
                  <TemplateDialog template={{ id: template.id, name: template.name, categoryId: template.categoryId, items: template.items }} categories={categoryOptions} />
                  {canDelete ? <DeleteTemplateButton id={template.id} name={template.name} /> : null}
                </Row>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
