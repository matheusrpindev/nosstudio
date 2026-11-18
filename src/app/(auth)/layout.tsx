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
      <aside className="bg-roxo relative flex shrink-0 flex-col justify-between overflow-hidden px-6 py-7 text-white lg:w-[44%] lg:max-w-2xl lg:px-16 lg:py-16">
        {/* motivo do visor (os cantos do logo) emoldurando o bloco — só no desktop */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-5 hidden lg:block">
          <span className="border-lavanda/30 absolute top-0 left-0 size-12 rounded-tl-2xl border-t-[3px] border-l-[3px]" />
          <span className="border-lavanda/30 absolute top-0 right-0 size-12 rounded-tr-2xl border-t-[3px] border-r-[3px]" />
          <span className="border-lavanda/30 absolute bottom-0 left-0 size-12 rounded-bl-2xl border-b-[3px] border-l-[3px]" />
          <span className="border-lavanda/30 absolute right-0 bottom-0 size-12 rounded-br-2xl border-r-[3px] border-b-[3px]" />
        </div>
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
