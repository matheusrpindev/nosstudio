import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { seesInternalNotes } from "@/lib/permissions";
import { getClient } from "@/server/clients/admin";
import { getUserOptions } from "@/server/options";
import { updateClientAction } from "../../actions";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Editar cliente" };
export const instant = false;

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clientes", "editar");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [client, owners] = await Promise.all([getClient(id), getUserOptions()]);
  if (!client) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Editar ${client.name}`} back={{ href: `/painel/clientes/${client.id}`, label: "Voltar ao cliente" }} />
      <ClientForm action={updateClientAction} client={client} owners={owners} cancelHref={`/painel/clientes/${client.id}`} submitLabel="Salvar alterações" showNotes={seesInternalNotes(user)} />
    </div>
  );
}
