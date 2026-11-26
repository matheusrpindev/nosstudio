import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { USER_ROLE_LABELS } from "@/lib/domain";
import { ENVIRONMENT_LABELS, environmentsOf } from "@/lib/permissions";
import { getPendingInvite, INVITE_INVALID_MESSAGE } from "@/server/access/invites";
import { InviteForm } from "./invite-form";

// `referrer: no-referrer`: o token está na URL e não pode vazar para outros sites pelo cabeçalho Referer
export const metadata: Metadata = { title: "Convite", referrer: "no-referrer", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Aceite de convite (pública): a pessoa convidada cria a própria senha. Não existe cadastro aberto — sem um
 * convite válido para aquele e-mail, nada é criado. Token desconhecido, expirado, revogado e já usado mostram a
 * MESMA mensagem (não revelamos qual é o caso). A conta não abre sessão aqui: a pessoa entra pelo login.
 */
export default function InvitePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-texto text-[1.75rem] leading-tight font-extrabold tracking-tight text-balance">Você foi convidado(a).</h1>
      {/* Ler a URL e o banco é trabalho de requisição: fica atrás do Suspense (Cache Components). */}
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
        <InviteGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InviteGate({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  // a validade do convite depende do horário atual: precisa ser renderizado a cada requisição (Cache Components)
  await connection();
  const invite = typeof token === "string" ? await getPendingInvite(token) : null;
  if (!invite || typeof token !== "string") {
    return (
      <div className="mt-6 space-y-5">
        <Alert tone="alerta" title="Este convite não vale mais">
          {INVITE_INVALID_MESSAGE} Se você já criou a sua conta, é só entrar.
        </Alert>
        <ButtonLink href="/login" size="lg" block>
          Ir para a tela de entrada
        </ButtonLink>
      </div>
    );
  }

  const areas = environmentsOf(invite.role).map((environment) => ENVIRONMENT_LABELS[environment]);
  return (
    <>
      <p className="text-texto-suave mt-2 text-[0.9375rem] leading-relaxed">
        A NÓS Studio convidou <strong className="text-texto break-words">{invite.email}</strong> para acessar a plataforma como <strong className="text-texto">{USER_ROLE_LABELS[invite.role]}</strong> ({areas.join(" e ")}). Confira o seu nome e crie uma senha.
      </p>
      <InviteForm token={token} email={invite.email} name={invite.name} minLength={PASSWORD_MIN_LENGTH} />
    </>
  );
}
