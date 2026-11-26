import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { USER_ROLE_LABELS } from "@/lib/domain";
import { listProjectMemberCandidates, listProjectMembers, type ProjectMemberRow } from "@/server/access/members";
import { AddMemberDialog, EditMemberDialog, RemoveMemberDialog } from "./project-team-dialogs";

const allowances = (member: ProjectMemberRow): string[] =>
  !member.canView ? [] : ["Ver", ...(member.canEdit ? ["Editar"] : []), ...(member.canDownload ? ["Baixar arquivos"] : []), ...(member.canUpload ? ["Enviar arquivos"] : [])];

/**
 * Bloco "Equipe do projeto" (detalhe do projeto): quem foi incluído e o que cada pessoa pode NESTE projeto.
 * Server Component: só é renderizado para quem vê Equipe (`equipe:ver`); os botões, para quem edita
 * (`equipe:editar`) — as ações conferem de novo no servidor.
 */
export async function ProjectTeam({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const [members, candidates] = await Promise.all([listProjectMembers(projectId), canManage ? listProjectMemberCandidates(projectId) : []]);
  const options = candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.name} — ${USER_ROLE_LABELS[candidate.role]}` }));

  return (
    <Card as="section" aria-labelledby="equipe-titulo">
      <CardHeader
        id="equipe-titulo"
        title="Equipe do projeto"
        description="Funcionários e freelancers só enxergam os projetos em que estão nesta lista."
        action={canManage ? <AddMemberDialog projectId={projectId} candidates={options} /> : undefined}
      />
      {members.length > 0 ? (
        <ul className="divide-borda divide-y">
          {members.map((member) => {
            const can = allowances(member);
            return (
              <li key={member.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-texto text-sm font-semibold break-words">
                      {member.name}
                      {member.role ? <span className="text-texto-suave font-normal"> · {member.role}</span> : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="roxo">{USER_ROLE_LABELS[member.userRole]}</Badge>
                      {!member.active ? <Badge tone="neutral">Conta desativada</Badge> : null}
                      {can.length > 0 ? can.map((item) => <Badge key={item}>{item}</Badge>) : <Badge tone="alerta">Acesso pausado</Badge>}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <EditMemberDialog
                        projectId={projectId}
                        member={{ userId: member.userId, name: member.name, role: member.role, canView: member.canView, canEdit: member.canEdit, canDownload: member.canDownload, canUpload: member.canUpload }}
                      />
                      <RemoveMemberDialog projectId={projectId} userId={member.userId} name={member.name} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-texto-suave text-sm">
          Ninguém foi incluído ainda. Sócios e gestores já veem todos os projetos; inclua aqui os funcionários e freelancers que vão trabalhar neste.
        </p>
      )}
    </Card>
  );
}
