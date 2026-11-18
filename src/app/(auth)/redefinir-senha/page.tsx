import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Redefinir senha", referrer: "no-referrer" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-grafite text-[1.75rem] leading-tight font-extrabold tracking-tight">Criar nova senha</h1>
      <p className="text-cinza mt-2 text-[0.9375rem] leading-relaxed">Escolha uma senha nova para o seu acesso ao painel.</p>
      <Suspense
        fallback={
          <div className="mt-8 space-y-5" role="status">
            <span className="sr-only">Carregando…</span>
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-12" />
          </div>
        }
      >
        <ResetGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ResetGate({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token || token.length > 200) {
    return (
      <div className="mt-8 space-y-5">
        <Alert tone="alerta" title="Link incompleto ou inválido">
          Abra o link exatamente como chegou no e-mail — ou peça um novo.
        </Alert>
        <ButtonLink href="/recuperar-senha" size="lg" block>
          Pedir novo link
        </ButtonLink>
      </div>
    );
  }
  // A validade do token é conferida pela action no envio (não revelamos nada antes disso).
  return <ResetForm token={token} minLength={PASSWORD_MIN_LENGTH} />;
}
