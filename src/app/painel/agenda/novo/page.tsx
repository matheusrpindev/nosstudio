import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam, paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { getProjectClientId } from "@/server/agenda/admin";
import { getClientOptions, getProjectOptions, getUserOptions } from "@/server/options";
import { createEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Novo compromisso" };
export const instant = false;

export default async function NewEventPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const dateParam = firstParam(params.data);
  const date = dateParam && isISODate(dateParam) ? dateParam : todayISO();
  const projectId = paramId(params.projeto) ?? null;
  // Vindo de um projeto sem ?cliente=, aproveita o cliente do projeto.
  const clientId = paramId(params.cliente) ?? (projectId ? await getProjectClientId(projectId) : null);
  const [clients, projects, users] = await Promise.all([getClientOptions(), getProjectOptions(), getUserOptions()]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo compromisso" description="Gravação, reunião, evento ou entrega. Aparece no calendário e em “Próximos 14 dias”." back={{ href: "/painel/agenda", label: "Agenda" }} />
      <Card>
        <EventForm
          action={createEventAction}
          values={{ title: "", kind: "reuniao", date, startTime: "09:00", endTime: null, location: "", clientId, projectId, ownerId: user.id, notes: "" }}
          clients={clients}
          projects={projects}
          users={users}
          submitLabel="Criar compromisso"
          cancelHref="/painel/agenda"
        />
      </Card>
    </div>
  );
}
