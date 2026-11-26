import { Info } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { requireAdmin } from "@/lib/auth";
import { USER_ROLE_LABELS } from "@/lib/domain";
import { listUsers, type UserRow } from "@/server/config/users";
import { CreateUserDialog, UserActions } from "./user-dialogs";

export const metadata: Metadata = { title: "Usuários" };
export const instant = false;

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();

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
      cell: (user) => <Badge tone={user.role === "admin" ? "roxo" : "alerta"}>{USER_ROLE_LABELS[user.role]}</Badge>,
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
      cell: (user) => <UserActions user={{ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active }} isSelf={user.id === admin.id} />,
    },
  ];

  return (
    <>
      <PageHeader title="Usuários" description="Quem pode entrar no painel. Cada pessoa tem a própria conta e a própria senha." actions={<CreateUserDialog />} back={{ href: "/painel/config", label: "Configurações" }} />

      <Alert tone="info" title="Sobre os perfis" className="mb-5">
        <p>
          <strong>Administrador(a)</strong>: os sócios. Acesso completo, inclusive criar contas, exportar os dados e ver a auditoria.
        </p>
        <p className="mt-1.5">
          <strong>Acesso técnico (temporário)</strong>: conta do desenvolvedor, para dar suporte. Usa o painel, mas não gerencia contas nem exporta dados. Quando o suporte acabar, use <em>Desativar</em>: o acesso é revogado na hora e o histórico fica guardado.
        </p>
      </Alert>

      <DataList
        caption="Contas do painel"
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        empty={<p className="text-texto-suave flex items-center justify-center gap-2 px-6 py-10 text-sm"><Info aria-hidden="true" className="size-4" />Nenhuma conta cadastrada.</p>}
      />
    </>
  );
}
