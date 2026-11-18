import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Entrar", template: "%s · Painel NÓS Studio" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#3b1f8e" };

/** Telas de acesso: a marca de um lado (em cima, no celular) e o formulário do outro. Sem cadastro público. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <aside className="bg-roxo relative flex shrink-0 flex-col justify-between overflow-hidden px-6 py-7 text-white lg:w-[44%] lg:max-w-2xl lg:px-14 lg:py-12">
        {/* motivo do visor (cantos do logo), bem discreto */}
        <svg aria-hidden="true" viewBox="0 0 400 400" fill="none" className="text-lavanda/15 pointer-events-none absolute -right-24 -bottom-24 hidden size-[30rem] lg:block">
          <path d="M40 130V70a30 30 0 0 1 30-30h60M270 40h60a30 30 0 0 1 30 30v60M360 270v60a30 30 0 0 1-30 30h-60M130 360H70a30 30 0 0 1-30-30v-60" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
        </svg>
        <Link href="/" className="relative inline-flex w-fit rounded-md focus-visible:outline-white" aria-label="NÓS Studio — voltar ao site">
          <Logo variant="assinatura" tone="branco" label="" className="h-14 lg:h-24" />
        </Link>
        <div className="relative mt-6 lg:mt-0">
          <p className="text-2xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-3xl lg:text-5xl">
            Sua história, <span className="text-lima">nosso olhar.</span>
          </p>
          <p className="text-lavanda mt-3 hidden max-w-sm text-[0.9375rem] leading-relaxed lg:block">Painel de gestão da NÓS Studio — leads, clientes, orçamentos, agenda e o conteúdo do site num só lugar.</p>
        </div>
        <p className="text-lavanda/80 relative hidden text-xs font-medium lg:block">Acesso restrito aos sócios.</p>
      </aside>
      <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
