import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { seesInternalNotes } from "@/lib/permissions";
import { getUserOptions } from "@/server/options";
import { createClientAction } from "../actions";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Novo cliente" };
export const instant = false;

export default async function NewClientPage() {
  const user = await requirePermission("clientes", "editar");
  const owners = await getUserOptions();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo cliente" description="Cadastre quem entrou em contato. Só o nome é obrigatório; o resto pode ser completado depois." back={{ href: "/painel/clientes", label: "Clientes" }} />
      <ClientForm action={createClientAction} owners={owners} defaultOwnerId={user.id} cancelHref="/painel/clientes" submitLabel="Cadastrar cliente" showNotes={seesInternalNotes(user)} />
    </div>
  );
}
