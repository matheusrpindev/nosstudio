import type { Metadata } from "next";
import { canEverywhere, canUsePanelModule, requirePanelUser } from "@/lib/auth";
import { formatDateLong, formatWeekday, todayISO } from "@/lib/dates";
import { dashboardAccess, getIssues, getSetupGaps, getSummary, listImportantTasks, listUpcomingShoots, listWeekEvents } from "@/server/dashboard/queries";
import { getVisitSnapshot } from "@/server/metrics/queries";
import { WeekAgenda, UpcomingShoots } from "./_dashboard/agenda-cards";
import { Notices } from "./_dashboard/notices";
import { Shortcuts } from "./_dashboard/shortcuts";
import { SummaryCards } from "./_dashboard/summary-cards";
import { TasksCard } from "./_dashboard/tasks-card";
import { VisitsIndicator } from "./_dashboard/visits-indicator";

export const metadata: Metadata = { title: "Visão geral" };
export const instant = false;

/**
 * Visão geral: a situação da empresa numa tela. Só leitura; tudo leva ao módulo certo.
 * Abre para QUALQUER conta do painel, mas cada cartão, aviso, atalho e lista só aparece para quem pode ver o
 * módulo dele (`dashboardAccess`) — o que a pessoa não vê nem é consultado. O gestor não recebe números do
 * financeiro; o funcionário vê só o que é dos projetos em que está.
 */
export default async function PainelHomePage() {
  const user = await requirePanelUser();
  const today = todayISO();
  const firstName = user.name.split(" ")[0];
  const access = await dashboardAccess(user);
  const restricted = access.projects !== "todos";

  const [summary, weekEvents, shoots, importantTasks, issues, gaps, visits] = await Promise.all([
    getSummary(today, access),
    access.agenda ? listWeekEvents(user, today) : null,
    access.agenda ? listUpcomingShoots(user, today) : null,
    access.tasks ? listImportantTasks(today, access.tasks) : null,
    getIssues(today, access),
    getSetupGaps(access),
    // visitas do site: só para quem vê o módulo Site (para os demais nem é consultado)
    canEverywhere(user, "site", "ver") ? getVisitSnapshot(today) : null,
  ]);
  const shortcuts = {
    lead: canEverywhere(user, "leads", "editar"),
    client: canEverywhere(user, "clientes", "editar"),
    proposal: canEverywhere(user, "propostas", "editar"),
    event: canUsePanelModule(user, "agenda", "editar"),
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-texto-suave text-sm font-semibold first-letter:uppercase">
          {formatWeekday(today)}, {formatDateLong(today)}
        </p>
        <h1 className="text-texto mt-1 text-[1.75rem] leading-tight font-extrabold tracking-tight sm:text-4xl">Olá, {firstName}.</h1>
        <p className="text-texto-suave mt-2 max-w-xl text-[0.9375rem] leading-relaxed">
          {restricted ? "Uma visão rápida dos projetos em que você está." : "Uma visão rápida da situação da NÓS Studio."}
        </p>
      </header>

      <SummaryCards summary={summary} today={today} />
      {visits ? <VisitsIndicator snapshot={visits} /> : null}
      <Notices issues={issues} gaps={gaps} today={today} scope={{ deliveries: access.projects !== null, proposals: access.proposals, finance: access.finance, setup: access.site || access.admin }} />
      <Shortcuts allowed={shortcuts} />

      {weekEvents || importantTasks || shoots ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {weekEvents ? (
            <div className="space-y-6">
              <WeekAgenda events={weekEvents} today={today} canCreate={shortcuts.event} />
            </div>
          ) : null}
          <div className="space-y-6">
            {importantTasks ? <TasksCard tasks={importantTasks.tasks} total={importantTasks.total} today={today} /> : null}
            {shoots ? <UpcomingShoots events={shoots} today={today} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
