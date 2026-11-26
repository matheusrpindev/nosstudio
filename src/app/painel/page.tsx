import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays, formatDateLong, formatWeekday, todayISO } from "@/lib/dates";
import { getIssues, getSetupGaps, getSummary, listEvents, listImportantTasks } from "@/server/dashboard/queries";
import { WeekAgenda, UpcomingShoots } from "./_dashboard/agenda-cards";
import { Notices } from "./_dashboard/notices";
import { Shortcuts } from "./_dashboard/shortcuts";
import { SummaryCards } from "./_dashboard/summary-cards";
import { TasksCard } from "./_dashboard/tasks-card";

export const metadata: Metadata = { title: "Visão geral" };
export const instant = false;

/** Visão geral: a situação da empresa numa tela. Só leitura; tudo leva ao módulo certo. */
export default async function PainelHomePage() {
  const user = await requireUser();
  const today = todayISO();
  const firstName = user.name.split(" ")[0];

  const [summary, weekEvents, shoots, importantTasks, issues, gaps] = await Promise.all([
    getSummary(today),
    listEvents(today, addDays(today, 6)),
    listEvents(today, addDays(today, 30), ["gravacao", "evento"], 6),
    listImportantTasks(today),
    getIssues(today),
    getSetupGaps(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-texto-suave text-sm font-semibold first-letter:uppercase">
          {formatWeekday(today)}, {formatDateLong(today)}
        </p>
        <h1 className="text-texto mt-1 text-[1.75rem] leading-tight font-extrabold tracking-tight sm:text-4xl">Olá, {firstName}.</h1>
        <p className="text-texto-suave mt-2 max-w-xl text-[0.9375rem] leading-relaxed">Uma visão rápida da situação da NÓS Studio.</p>
      </header>

      <SummaryCards summary={summary} today={today} />
      {/* a pendência de SMTP leva a Configurações > Notificações, que é área só de administradores */}
      <Notices issues={issues} gaps={user.role === "admin" ? gaps : { ...gaps, smtp: false }} today={today} />
      <Shortcuts />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <WeekAgenda events={weekEvents} today={today} />
        </div>
        <div className="space-y-6">
          <TasksCard tasks={importantTasks.tasks} total={importantTasks.total} today={today} />
          <UpcomingShoots events={shoots} today={today} />
        </div>
      </div>
    </div>
  );
}
