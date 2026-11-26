import { ChevronDown, Info, MailPlus } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { DateText } from "@/components/ui/text";
import { canEverywhere, isAdminRole, requirePermission } from "@/lib/auth";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/domain";
import { smtpConfigured } from "@/lib/env";
import { hasEnvironment, parseOverrides } from "@/lib/permissions";
import { listInvites, type InviteRow, type InviteStatus } from "@/server/access/invites";
import { listUsers, type UserRow } from "@/server/config/users";
import { getClientOptions, getProjectOptions } from "@/server/options";
import { InviteDialog, ResendInviteDialog, RevokeInviteDialog } from "./invite-dialogs";
import { CreateUserDialog, UserActions } from "./user-dialogs";

export const metadata: Metadata = { title: "Usuários" };
export const instant = false;

const INVITE_STATUS_LABELS: Record<InviteStatus, string> = { pendente: "Pendente", aceito: "Aceito", expirado: "Expirado", revogado: "Revogado" };
const INVITE_STATUS_TONES: Record<InviteStatus, BadgeTone> = { pendente: "alerta", aceito: "sucesso", expirado: "neutral", revogado: "neutral" };
/** Pendentes primeiro; depois o histórico. */
const INVITE_ORDER: Record<InviteStatus, number> = { pendente: 0, expirado: 1, revogado: 2, aceito: 3 };

const roleTone = (role: UserRole): BadgeTone => (isAdminRole(role) ? "roxo" : hasEnvironment(role, "painel") ? "alerta" : "neutral");

export default async function UsersPage() {
  const admin = await requirePermission("usuarios", "ver");
  const canEdit = canEverywhere(admin, "usuarios", "editar");
  const [users, invites, clients, projects] = await Promise.all([listUsers(), listInvites(), getClientOptions(), getProjectOptions()]);
  const clientName = new Map(clients.map((option) => [option.value, option.label]));
  const projectTitle = new Map(projects.map((option) => [option.value, option.label]));
  const sortedInvites = [...invites].sort((a, b) => INVITE_ORDER[a.status] - INVITE_ORDER[b.status]);
  const pending = invites.filter((invite) => invite.status === "pendente").length;

  const columns: DataListColumn<UserRow>[] = [
    {
      key: "nome",
      header: "Nome",
      primary: true,
      cell: (user) => (
        <span className="flex items-center gap-3">
          <Avatar name={user.name} size="sm" />
          <span className="min-w-0">
            <span className="block break-words">
              {user.name}
              {user.id === admin.id ? <span className="text-texto-suave ml-1.5 text-xs font-normal">(você)</span> : null}
            </span>
            <span className="text-texto-suave block text-[0.8125rem] font-normal break-all">{user.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "perfil",
      header: "Perfil",
      cell: (user) => {
        const { grant, deny } = parseOverrides(user.permissions);
        const adjusted = grant.length + deny.length;
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={roleTone(user.role)}>{USER_ROLE_LABELS[user.role]}</Badge>
            {adjusted > 0 ? <Badge tone="lima">{adjusted === 1 ? "1 ajuste" : `${adjusted} ajustes`}</Badge> : null}
          </span>
        );
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={user.active ? "sucesso" : "neutral"} dot>
            {user.active ? "Ativa" : "Desativada"}
          </Badge>
          {user.mustChangePassword ? <Badge tone="alerta">Senha temporária</Badge> : null}
        </span>
      ),
    },
    { key: "acesso", header: "Último acesso", cell: (user) => <DateText value={user.lastLoginAt} format="datetime" fallback="Nunca entrou" /> },
    {
      key: "acoes",
      header: "Ações",
      interactive: true,
      cell: (user) => <UserActions user={{ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active }} isSelf={user.id === admin.id} canEdit={canEdit} />,
    },
  ];

  const inviteColumns: DataListColumn<InviteRow>[] = [
    {
      key: "pessoa",
      header: "Pessoa",
      primary: true,
      cell: (invite) => (
        <>
          <span className="block break-words">{invite.name || "Sem nome informado"}</span>
          <span className="text-texto-suave block text-[0.8125rem] font-normal break-all">{invite.email}</span>
        </>
      ),
    },
    {
      key: "perfil",
      header: "Perfil e vínculo",
      cell: (invite) => {
        const link =
          invite.clientId !== null
            ? `Cliente: ${clientName.get(invite.clientId) ?? "ficha excluída"}`
            : invite.projectId !== null
              ? `Projeto: ${projectTitle.get(invite.projectId) ?? "projeto excluído"}${invite.projectRole ? ` (${invite.projectRole})` : ""}`
              : null;
        return (
          <span className="block">
            <Badge tone={roleTone(invite.role)}>{USER_ROLE_LABELS[invite.role]}</Badge>
            {link ? <span className="text-texto-suave mt-1 block text-[0.8125rem] break-words md:text-left">{link}</span> : null}
          </span>
        );
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (invite) => (
        <span className="block">
          <Badge tone={INVITE_STATUS_TONES[invite.status]} dot>
            {INVITE_STATUS_LABELS[invite.status]}
          </Badge>
          <span className="text-texto-suave mt-1 block text-[0.8125rem] md:text-left">
            {invite.status === "pendente" ? (
              <>
                vale até <DateText value={invite.expiresAt} format="date" />
              </>
            ) : invite.status === "aceito" ? (
              <>
                em <DateText value={invite.acceptedAt} format="date" />
              </>
            ) : invite.status === "revogado" ? (
              <>
                em <DateText value={invite.revokedAt} format="date" />
              </>
            ) : (
              <>
                venceu em <DateText value={invite.expiresAt} format="date" />
              </>
            )}
          </span>
        </span>
      ),
    },
    { key: "criado", header: "Enviado em", hideOnMobile: true, cell: (invite) => <DateText value={invite.createdAt} format="date" /> },
    ...(canEdit
      ? [
          {
            key: "acoes",
            header: "Ações",
            interactive: true,
            cell: (invite: InviteRow) =>
              invite.status === "aceito" ? (
                <span className="text-texto-suave text-sm">Conta criada</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <ResendInviteDialog inviteId={invite.id} email={invite.email} />
                  {invite.status === "pendente" ? <RevokeInviteDialog inviteId={invite.id} email={invite.email} /> : null}
                </div>
              ),
          } satisfies DataListColumn<InviteRow>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem pode entrar no sistema e o que cada pessoa enxerga. Cada um tem a própria conta e a própria senha."
        actions={
          canEdit ? (
            <>
              <CreateUserDialog />
              <InviteDialog clients={clients} projects={projects} />
            </>
          ) : undefined
        }
        back={{ href: "/painel/config", label: "Configurações" }}
      />

      {/* fechado por padrão: no celular a explicação é longa e as listas ficam logo abaixo */}
      <details className="card group/perfis mb-5">
        <summary className="text-texto flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-bold sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Info aria-hidden="true" className="text-detalhe size-4 shrink-0" />
            Sobre os perfis: o que cada um acessa
          </span>
          <ChevronDown aria-hidden="true" className="text-texto-suave size-5 shrink-0 transition-transform group-open/perfis:rotate-180" />
        </summary>
        <div className="border-borda text-texto-suave space-y-2 border-t px-4 py-4 text-sm leading-relaxed sm:px-5">
          <p>
            <strong className="text-texto">Administrador(a) e Sócio(a)</strong>: acesso completo, inclusive convidar pessoas, mudar permissões, exportar dados e ver a auditoria.
          </p>
          <p>
            <strong className="text-texto">Gestor(a) de projetos</strong>: a operação do dia a dia (leads, clientes, propostas, contratos, projetos, tarefas, agenda, conteúdo e marca). Não vê o financeiro, o site nem as configurações.
          </p>
          <p>
            <strong className="text-texto">Funcionário(a)</strong>: entra no painel e vê só os projetos em que foi incluído, com as tarefas deles.
          </p>
          <p>
            <strong className="text-texto">Freelancer</strong> e <strong className="text-texto">Cliente</strong>: as contas já podem ser criadas, mas só entram quando a Área da Equipe e a Área do Cliente abrirem.
          </p>
          <p>
            <strong className="text-texto">Acesso técnico (temporário)</strong>: conta do desenvolvedor, para dar suporte. Não gerencia contas nem exporta dados. Quando o suporte acabar, use <em>Desativar</em>: o acesso é revogado na hora e o histórico fica guardado.
          </p>
          <p>Em “Permissões” de cada conta dá para liberar ou tirar ações específicas, sem mudar o perfil.</p>
        </div>
      </details>

      <Tabs
        aria-label="Contas e convites"
        items={[
          { value: "contas", label: "Contas", count: users.length },
          { value: "convites", label: "Convites", count: pending },
        ]}
      >
        <TabPanel value="contas">
          <DataList
            caption="Contas"
            columns={columns}
            rows={users}
            rowKey={(user) => user.id}
            empty={<p className="text-texto-suave flex items-center justify-center gap-2 px-6 py-10 text-sm"><Info aria-hidden="true" className="size-4" />Nenhuma conta cadastrada.</p>}
          />
        </TabPanel>
        <TabPanel value="convites">
          {!smtpConfigured() ? (
            <Alert tone="alerta" title="O envio de e-mails não está configurado" className="mb-4">
              Os convites não chegam por e-mail. Ao criar um convite, copie o link que aparece na tela e envie você mesmo(a) para a pessoa. O link só é mostrado uma vez; se perder, use “Convidar de novo”.
            </Alert>
          ) : null}
          <DataList
            caption="Convites"
            columns={inviteColumns}
            rows={sortedInvites}
            rowKey={(invite) => invite.id}
            empty={
              <EmptyState
                variant="plain"
                icon={<MailPlus />}
                title="Nenhum convite ainda"
                description="Use “Convidar pessoa” para dar acesso a alguém da equipe ou a um cliente. A pessoa cria a própria senha pelo link."
              />
            }
          />
          <p className="hint mt-3">Cada e-mail tem um convite válido por vez: convidar de novo cancela o link anterior. Convites valem por 7 dias.</p>
        </TabPanel>
      </Tabs>
    </>
  );
}
