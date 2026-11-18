import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getEvent } from "@/server/agenda/admin";
import {
  getClientOptions,
  getProjectOptions,
  getUserOptions,
} from "@/server/options";
import { deleteEventAction, updateEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Compromisso" };
export const instant = false;

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const event = await getEvent(id);
  if (!event) notFound();
  const [clients, projects, users] = await Promise.all([
    getClientOptions(),
    getProjectOptions(),
    getUserOptions(),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={event.title}
        description={
          <>
            {event.clientId ? (
              <Link
                href={`/painel/clientes/${event.clientId}`}
                className="link"
              >
                {event.clientName}
              </Link>
            ) : null}
            {event.clientId && event.projectId ? " · " : null}
            {event.projectId ? (
              <Link
                href={`/painel/projetos/${event.projectId}`}
                className="link"
              >
                {event.projectTitle}
              </Link>
            ) : null}
            {!event.clientId && !event.projectId
              ? "Edite os dados abaixo."
              : null}
          </>
        }
        back={{
          href: `/painel/agenda?mes=${event.date.slice(0, 7)}`,
          label: "Agenda",
        }}
      />
      <Card>
        <EventForm
          action={updateEventAction}
          id={event.id}
          values={{
            title: event.title,
            kind: event.kind,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            clientId: event.clientId,
            projectId: event.projectId,
            ownerId: event.ownerId,
            notes: event.notes,
          }}
          clients={clients}
          projects={projects}
          users={users}
          submitLabel="Salvar alterações"
          cancelHref={`/painel/agenda?mes=${event.date.slice(0, 7)}`}
        />
      </Card>
      <Card as="section" aria-labelledby="excluir-titulo" className="mt-4">
        <CardHeader
          id="excluir-titulo"
          title="Excluir compromisso"
          description="Tira o compromisso da agenda. Não dá para desfazer."
        />
        <ConfirmDialog
          trigger={
            <Button variant="danger-ghost" icon={<Trash2 />} className="-ml-2">
              Excluir compromisso
            </Button>
          }
          title="Excluir este compromisso?"
          description={
            <>
              <strong className="text-grafite">{event.title}</strong> será
              removido da agenda e não dá para desfazer.
            </>
          }
          confirmLabel="Excluir compromisso"
          action={deleteEventAction}
          hidden={{ id: event.id }}
        />
      </Card>
    </div>
  );
}
