import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, PANEL_HOME, safeNextPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1 className="text-grafite text-[1.75rem] leading-tight font-extrabold tracking-tight">Entrar no painel</h1>
      <p className="text-cinza mt-2 text-[0.9375rem] leading-relaxed">Use o e-mail e a senha da sua conta da NÓS Studio.</p>
      {/* Ler a sessão e a URL é trabalho de requisição: fica atrás do Suspense (Cache Components). */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginGate({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
  // Já está logado? Vai direto para o painel (ou para onde tentava ir).
  if (await getCurrentUser()) redirect(next);
  return <LoginForm next={next === PANEL_HOME ? "" : next} passwordReset={params.aviso === "senha-redefinida"} />;
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
