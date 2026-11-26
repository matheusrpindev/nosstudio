import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DateText } from "@/components/ui/text";
import { listInvites } from "@/server/access/invites";
import { listClientUserCandidates, listClientUsers } from "@/server/access/members";
import { InviteClientAccessDialog, LinkClientUserDialog, ResendClientInviteButton, RevokeClientInviteDialog, UnlinkClientUserDialog } from "./client-access-dialogs";

/**
 * Bloco "Acessos do cliente" (ficha do cliente): as contas de perfil Cliente vinculadas a esta ficha — são elas
 * que vão acompanhar os projetos deste cliente na Área do Cliente — e os convites ainda pendentes.
 * Server Component: só é renderizado para quem vê Usuários (admin, sócio); os botões, para quem edita. As ações
 * (`config/usuarios/actions.ts`, `server/access/invite-actions.ts`) conferem de novo.
 */
export async function ClientAccess({ clientId, clientName, canManage }: { clientId: number; clientName: string; canManage: boolean }) {
  const [linked, invites, candidates] = await Promise.all([listClientUsers(clientId), listInvites(), canManage ? listClientUserCandidates(clientId) : []]);
  const pending = invites.filter((invite) => invite.clientId === clientId && invite.status === "pendente");

  return (
    <Card as="section" aria-labelledby="acessos-titulo">
      <CardHeader
        id="acessos-titulo"
        title="Acessos do cliente"
        description="Pessoas deste cliente com conta para acompanhar os projetos na Área do Cliente."
        action={canManage ? <InviteClientAccessDialog clientId={clientId} clientName={clientName} /> : undefined}
      />
      {linked.length === 0 && pending.length === 0 ? (
        <p className="text-texto-suave text-sm">Ninguém deste cliente tem conta ainda. Use “Convidar” para mandar o link de criação de senha.</p>
      ) : (
        <ul className="divide-borda divide-y">
          {linked.map((account) => (
            <li key={account.userId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-texto text-sm font-semibold break-words">{account.name}</p>
                <p className="text-texto-suave text-[0.8125rem] break-all">{account.email}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                  <Badge tone={account.active ? "sucesso" : "neutral"} dot>
                    {account.active ? "Conta ativa" : "Conta desativada"}
                  </Badge>
                  <span className="text-texto-suave">
                    Último acesso: <DateText value={account.lastLoginAt} format="datetime" fallback="nunca entrou" />
                  </span>
                </p>
              </div>
              {canManage ? <UnlinkClientUserDialog clientId={clientId} userId={account.userId} name={account.name} /> : null}
            </li>
          ))}
          {pending.map((invite) => (
            <li key={`convite-${invite.id}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-texto text-sm font-semibold break-words">{invite.name || "Convite enviado"}</p>
                <p className="text-texto-suave text-[0.8125rem] break-all">{invite.email}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                  <Badge tone="alerta" dot>
                    Convite pendente
                  </Badge>
                  <span className="text-texto-suave">
                    vale até <DateText value={invite.expiresAt} format="date" />
                  </span>
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-1">
                  <ResendClientInviteButton inviteId={invite.id} email={invite.email} />
                  <RevokeClientInviteDialog inviteId={invite.id} email={invite.email} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage && candidates.length > 0 ? (
        <div className="border-borda mt-4 border-t pt-4">
          <LinkClientUserDialog clientId={clientId} candidates={candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.name} — ${candidate.email}` }))} />
        </div>
      ) : null}
      <p className="hint mt-4">A Área do Cliente ainda não está no ar: a conta fica pronta e a pessoa passa a entrar assim que ela abrir.</p>
    </Card>
  );
}
