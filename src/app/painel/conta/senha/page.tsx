import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Trocar senha" };
// navegação entre páginas irmãs pode bloquear (painel sem cache) — ver "Receita de um módulo" no README do kit
export const instant = false;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ChangePasswordPage({ searchParams }: Props) {
  // única página que aceita contas marcadas com "trocar a senha" (as outras redirecionam para cá)
  const user = await requireUser({ allowPasswordChange: true });
  const forced = user.mustChangePassword || (await searchParams).obrigatoria === "1";

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Trocar senha"
        description="Depois da troca, os outros aparelhos conectados precisam entrar de novo."
        back={user.mustChangePassword ? undefined : { href: "/painel/conta", label: "Minha conta" }}
      />
      {forced ? (
        <Alert tone="alerta" title="Troca de senha obrigatória" className="mb-4">
          Sua conta foi criada com uma senha provisória. Crie uma senha só sua para continuar usando o painel.
        </Alert>
      ) : null}
      <Card>
        <ChangePasswordForm minLength={PASSWORD_MIN_LENGTH} />
      </Card>
    </div>
  );
}
