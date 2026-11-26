import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { AccountPasswordForm } from "./account-password-form";

export const metadata: Metadata = { title: "Trocar senha", robots: { index: false, follow: false } };

/**
 * Troca de senha FORA do painel (tela neutra, mesmo visual do login): para contas que não entram no painel —
 * freelancer e cliente — e que receberam uma senha provisória. Reaproveita `changePasswordAction`, que vale
 * para qualquer sessão. Aqui não aparece NENHUM dado da NÓS: só a própria conta.
 */
export default function AccountPasswordPage() {
  return (
    <>
      <h1 className="text-texto text-[1.75rem] leading-tight font-extrabold tracking-tight">Trocar a senha</h1>
      {/* Ler a sessão é trabalho de requisição: fica atrás do Suspense (Cache Components). */}
      <Suspense
        fallback={
          <div className="mt-8 space-y-5" role="status">
            <span className="sr-only">Carregando…</span>
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-12" />
          </div>
        }
      >
        <PasswordGate />
      </Suspense>
    </>
  );
}

async function PasswordGate() {
  // qualquer conta com sessão (de qualquer ambiente); sem sessão → login
  const user = await requireSessionUser({ allowPasswordChange: true });
  return (
    <>
      <p className="text-texto-suave mt-2 text-[0.9375rem] leading-relaxed">
        Conta: <strong className="text-texto break-all">{user.email}</strong>
      </p>
      {user.mustChangePassword ? (
        <Alert tone="alerta" title="Troque a senha provisória" className="mt-5">
          Sua conta foi criada com uma senha provisória. Crie uma senha só sua para continuar.
        </Alert>
      ) : null}
      <AccountPasswordForm minLength={PASSWORD_MIN_LENGTH} forced={user.mustChangePassword} />
      <form action={logoutAction} className="mt-6 text-center">
        <button type="submit" className="link cursor-pointer text-sm">
          Sair desta conta
        </button>
      </form>
    </>
  );
}
