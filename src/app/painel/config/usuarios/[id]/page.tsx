import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canEverywhere, requirePermission } from "@/lib/auth";
import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from "@/lib/domain";
import { ENVIRONMENT_LABELS, environmentsOf, hasEnvironment, isAdminRole, parseOverrides } from "@/lib/permissions";
import { getUser } from "@/server/config/users";
import { PermissionsEditor } from "./permissions-editor";

export const metadata: Metadata = { title: "Permissões" };
export const instant = false;

/**
 * Permissões individuais de uma conta: a grade módulo × ação com o padrão do perfil e os ajustes (conceder /
 * negar). Quem grava é `setUserPermissionsAction` (`usuarios:editar`), que valida tudo de novo no servidor.
 */
export default async function UserPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("usuarios", "ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await getUser(id);
  if (!user) notFound();

  const overrides = parseOverrides(user.permissions);
  const isSelf = user.id === admin.id;
  const fullAccess = isAdminRole(user.role);
  const usesPanel = hasEnvironment(user.role, "painel");
  const canEdit = canEverywhere(admin, "usuarios", "editar") && !isSelf && !fullAccess && usesPanel;
  const areas = environmentsOf(user.role).map((environment) => ENVIRONMENT_LABELS[environment]);

  return (
    <>
      <PageHeader
        title={`Permissões de ${user.name}`}
        badge={<Badge tone="roxo">{USER_ROLE_LABELS[user.role]}</Badge>}
        description={
          <>
            <span className="break-all">{user.email}</span> · entra em: {areas.join(" e ")}
          </>
        }
        back={{ href: "/painel/config/usuarios", label: "Usuários" }}
      />

      <Card as="section" aria-labelledby="perfil-titulo" className="mb-4">
        <CardHeader id="perfil-titulo" title={`Perfil: ${USER_ROLE_LABELS[user.role]}`} description={USER_ROLE_DESCRIPTIONS[user.role]} />
        <p className="text-texto-suave text-sm leading-relaxed">
          O perfil define o ponto de partida. Abaixo você pode <strong className="text-texto">permitir</strong> ou <strong className="text-texto">negar</strong> ações específicas só para esta pessoa. Para mudar o perfil inteiro, use <em>Editar</em> na lista de usuários.
        </p>
      </Card>

      {fullAccess ? (
        <Alert tone="info" title="Acesso total, sem ajustes" className="mb-4">
          Administradores e sócios sempre têm acesso a tudo, para ninguém ficar trancado para fora do sistema. Para restringir esta pessoa, mude o perfil dela.
        </Alert>
      ) : !usesPanel ? (
        <Alert tone="info" title="Este perfil não usa o painel" className="mb-4">
          O que esta conta enxerga é definido pelos vínculos: {user.role === "cliente" ? "as fichas de cliente a que ela está ligada (bloco “Acessos do cliente”, na ficha do cliente)" : "os projetos em que foi incluída (bloco “Equipe do projeto”, na página do projeto)"}. Não há permissões de painel para ajustar.
        </Alert>
      ) : isSelf ? (
        <Alert tone="info" title="Estas são as suas permissões" className="mb-4">
          Você não pode mudar as próprias permissões. Peça a outro administrador ou sócio.
        </Alert>
      ) : null}

      <PermissionsEditor userId={user.id} role={user.role} initial={overrides} canEdit={canEdit} />
    </>
  );
}
