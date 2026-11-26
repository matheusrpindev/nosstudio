import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser, PANEL_HOME, passwordChangePath, safeNextPath } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { USER_ROLE_LABELS } from "@/lib/domain";
import { ENVIRONMENT_LABELS, landingFor } from "@/lib/permissions";
import { LoginForm, type LoginNotice } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Avisos que outras telas mandam para cá em `?aviso=` (qualquer outro valor é ignorado). */
const NOTICES: Record<string, LoginNotice> = {
  "senha-redefinida": { tone: "sucesso", text: "Senha redefinida. Entre com a nova senha." },
  "conta-criada": { tone: "sucesso", text: "Conta criada. Entre com o seu e-mail e a senha que você acabou de escolher." },
  "senha-criada": { tone: "sucesso", text: "Senha criada. A sua área ainda não foi liberada: avisaremos quando estiver disponível." },
};

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-texto text-[1.75rem] leading-tight font-extrabold tracking-tight text-balance">Boas histórias continuam aqui.</h1>
      {/* Ler a sessão e a URL é trabalho de requisição: fica atrás do Suspense (Cache Components). */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const intro = <p className="text-texto-suave mt-2 text-[0.9375rem] leading-relaxed">Use o e-mail e a senha da sua conta da NÓS Studio.</p>;

async function LoginGate({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  const aviso = typeof params.aviso === "string" ? params.aviso : "";

  // Qualquer conta com sessão (de qualquer ambiente): o destino é o ambiente DELA, nunca "o painel" por padrão.
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        {intro}
        <LoginForm next={next === PANEL_HOME ? "" : next} notice={NOTICES[aviso] ?? null} />
      </>
    );
  }

  // senha provisória: antes de qualquer coisa, a pessoa cria a própria
  if (user.mustChangePassword) redirect(passwordChangePath(user));
  const landing = landingFor(user);

  // Um guarda mandou a pessoa para cá: ela está logada, mas tentou abrir algo que a conta dela não pode ver.
  // Mostramos o aviso (em vez de devolvê-la em silêncio ao início) e o caminho de volta.
  if (aviso === "sem-acesso" || !landing.ok) {
    return (
      <div className="mt-6 space-y-5">
        <Alert tone="alerta" title={landing.ok ? "Sua conta não tem acesso a essa página" : "Acesso ainda não liberado"}>
          {landing.ok ? (
            <>
              Você entrou como <strong>{user.name}</strong> ({USER_ROLE_LABELS[user.role]}), e esse perfil não tem permissão para o que você tentou abrir. Se precisar desse acesso, peça a um administrador da NÓS Studio.
            </>
          ) : (
            landing.message
          )}
        </Alert>
        {landing.ok ? (
          <ButtonLink href={landing.path} size="lg" block>
            Voltar para {landing.environment === "painel" ? "o início do painel" : `a ${ENVIRONMENT_LABELS[landing.environment]}`}
          </ButtonLink>
        ) : null}
        <form action={logoutAction}>
          <button type="submit" className="btn btn-secondary btn-lg w-full">
            Sair e entrar com outra conta
          </button>
        </form>
      </div>
    );
  }

  // Já está logado: vai direto para o ambiente dele (no painel, para onde tentava ir).
  redirect(landing.environment === "painel" ? next : landing.path);
}

function FormSkeleton() {
  return (
    <div className="mt-8 space-y-5" role="status">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-[4.5rem]" />
      <Skeleton className="h-[4.5rem]" />
      <Skeleton className="h-12" />
    </div>
  );
}
