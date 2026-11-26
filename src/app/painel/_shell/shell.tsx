import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toast";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { countNewLeads } from "@/server/leads/admin";
import type { NavBadges } from "../nav";
import { MobileNav } from "./mobile-nav";
import { NavList } from "./nav-list";

/**
 * Moldura do painel: barra lateral (desktop) ou barras superior/inferior (celular) + área de conteúdo.
 * A classe `tema-painel` na raiz liga o tema escuro para o documento inteiro (ver "TEMA ESCURO" em globals.css).
 * Roda dentro do <Suspense> do layout. `allowPasswordChange` evita laço de redirecionamento: a tela de troca
 * obrigatória de senha também vive dentro deste layout — cada PÁGINA continua chamando `requireUser()` sozinha.
 */
export async function Shell({ children }: { children: ReactNode }) {
  const user = await requireUser({ allowPasswordChange: true });
  const badges: NavBadges = { newLeads: await countNewLeads() };

  return (
    <div className="tema-painel flex min-h-dvh flex-1 flex-col lg:pl-64">
      <a href="#conteudo" className="btn btn-primary fixed top-2 left-2 z-[80] -translate-y-20 focus-visible:translate-y-0">
        Pular para o conteúdo
      </a>

      <aside className="bg-menu border-menu-borda fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r text-white lg:flex">
        <Link href="/painel" className="flex h-[4.5rem] shrink-0 items-center gap-2.5 px-6 focus-visible:outline-white" aria-label="NÓS Studio — painel, visão geral">
          <Logo variant="wordmark" tone="branco" label="" className="h-6" />
          <span aria-hidden="true" className="text-lavanda mt-0.5 text-sm font-medium tracking-wide">
            / painel
          </span>
        </Link>
        <nav aria-label="Menu do painel" className="menu-rolagem min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <NavList badges={badges} />
        </nav>
        <AccountBlock user={user} />
      </aside>

      <MobileNav
        logo={<Logo variant="wordmark" tone="branco" label="" className="h-5" />}
        badges={badges}
        account={<AccountBlock user={user} />}
      />

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
        {children}
      </main>
      <Toaster />
    </div>
  );
}

/** Rodapé do menu: quem está logado, "Minha conta", "Ver site" e "Sair". Server Component (vai como prop para a gaveta). */
function AccountBlock({ user }: { user: CurrentUser }) {
  return (
    <div className="shrink-0 border-t border-white/15 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3">
      <Link href="/painel/conta" data-fechar-menu className="flex min-h-12 items-center gap-3 rounded-campo px-3 py-1.5 hover:bg-white/10 focus-visible:outline-white">
        <Avatar name={user.name} tone="lima" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold text-white">{user.name}</span>
          <span className="text-lavanda block text-xs font-medium">Minha conta</span>
        </span>
      </Link>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center justify-center gap-2 rounded-campo px-2 text-[0.8125rem] font-semibold text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-white lg:min-h-10"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Ver site
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        <form action={logoutAction} className="contents">
          <button
            type="submit"
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-campo px-2 text-[0.8125rem] font-semibold text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-white lg:min-h-10"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

/** Esqueleto mostrado enquanto a sessão é lida (primeira carga). */
export function ShellFallback() {
  return (
    <div className="tema-painel flex min-h-dvh flex-1 flex-col lg:pl-64" aria-busy="true">
      <div className="bg-menu border-menu-borda fixed inset-y-0 left-0 hidden w-64 border-r lg:block" />
      <div className="bg-menu border-menu-borda h-14 border-b lg:hidden" />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6 lg:px-10 lg:pt-9">
        <PageSkeleton />
      </div>
    </div>
  );
}

/** Esqueleto genérico de página (também usado por `loading.tsx`). */
export function PageSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Carregando…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="rounded-cartao h-28" />
        <Skeleton className="rounded-cartao h-28 max-sm:hidden" />
        <Skeleton className="rounded-cartao h-28 max-sm:hidden" />
      </div>
      <Skeleton className="rounded-cartao mt-4 h-64" />
    </div>
  );
}
