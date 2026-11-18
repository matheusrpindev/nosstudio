import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getClientOptions, getUserOptions } from "@/server/options";
import { getProject } from "@/server/projects/admin";
import { updateProjectAction } from "../../actions";
import { ProjectForm } from "../../_components/project-form";

export const metadata: Metadata = { title: "Editar projeto" };
export const instant = false;

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const project = await getProject(id);
  if (!project) notFound();
  const [clients, users] = await Promise.all([getClientOptions(), getUserOptions()]);

  return (
    <>
      <PageHeader title="Editar projeto" description={project.title} back={{ href: `/painel/projetos/${project.id}`, label: "Projeto" }} />
      <div className="max-w-3xl">
        <ProjectForm action={updateProjectAction} defaults={project} clients={clients} users={users} projectId={project.id} cancelHref={`/painel/projetos/${project.id}`} submitLabel="Salvar projeto" />
      </div>
    </>
  );
}
