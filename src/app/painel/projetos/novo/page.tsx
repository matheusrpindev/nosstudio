import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { getClientOptions, getUserOptions } from "@/server/options";
import { findProjectByProposal, getProposalForProject, type ProjectInput } from "@/server/projects/admin";
import { SERVICE_BY_MODALITY } from "@/server/projects/logic";
import { createProjectAction } from "../actions";
import { ProjectForm, ProposalNotice } from "../_components/project-form";

export const metadata: Metadata = { title: "Novo projeto" };
export const instant = false;

export default async function NewProjectPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("projetos", "editar");
  const params = await searchParams;
  const proposal = (await (async () => {
    const id = paramId(params.proposta);
    return id ? getProposalForProject(id) : null;
  })());
  const [clients, users, existing] = await Promise.all([getClientOptions(), getUserOptions(), proposal ? findProjectByProposal(proposal.id) : null]);

  const clientId = proposal?.clientId ?? paramId(params.cliente) ?? null;
  const defaults: Omit<ProjectInput, "proposalId"> & { proposalId: number | null } = {
    title: proposal?.title ?? "",
    clientId: clients.some((option) => option.value === clientId) ? clientId : null,
    proposalId: proposal?.id ?? null,
    serviceType: proposal ? SERVICE_BY_MODALITY[proposal.modality] : "outro",
    stage: "briefing",
    ownerId: proposal?.ownerId ?? user.id,
    location: proposal?.eventLocation ?? "",
    eventDate: proposal?.eventDate ?? null,
    shootDeadline: null,
    deliveryDeadline: null,
    deliveredAt: null,
    driveUrl: "",
    galleryUrl: "",
    referencesUrl: "",
    finalFilesUrl: "",
    links: [],
    backupStatus: "pendente",
    backupNote: "",
    notes: "",
  };

  return (
    <>
      <PageHeader title="Novo projeto" description="Cadastre o trabalho para acompanhar etapas, prazos, arquivos e entregas." back={{ href: "/painel/projetos", label: "Projetos" }} />
      <div className="max-w-3xl">
        <ProjectForm
          action={createProjectAction}
          defaults={defaults}
          clients={clients}
          users={users}
          cancelHref="/painel/projetos"
          submitLabel="Criar projeto"
          notice={proposal ? <ProposalNotice number={`${proposal.number}${proposal.version > 1 ? ` v${proposal.version}` : ""}`} title={proposal.title} existing={existing} /> : null}
        />
      </div>
    </>
  );
}
