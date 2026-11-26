import { Suspense } from "react";
import { NavTabs } from "@/components/ui/tabs";
import { canEverywhere, getPanelUser, isAdminRole, type CurrentUser } from "@/lib/auth";

/** `allowed` repete a regra do guarda da página de cada aba: a aba só aparece para quem consegue abri-la. */
type Tab = { href: string; label: string; exact?: boolean; allowed: (user: CurrentUser) => boolean };

/** Subnavegação das Configurações. Cada aba some para quem não pode abrir a página dela. */
const TABS: readonly Tab[] = [
  { href: "/painel/config", label: "Visão geral", exact: true, allowed: (user) => canEverywhere(user, "config", "ver") },
  { href: "/painel/config/usuarios", label: "Usuários", allowed: (user) => canEverywhere(user, "usuarios", "ver") },
  { href: "/painel/config/notificacoes", label: "Notificações", allowed: (user) => isAdminRole(user.role) },
  { href: "/painel/config/propostas", label: "Propostas", allowed: (user) => canEverywhere(user, "config", "ver") },
  { href: "/painel/config/dados", label: "Dados", allowed: (user) => canEverywhere(user, "dados", "baixar") },
  { href: "/painel/config/auditoria", label: "Auditoria", allowed: (user) => canEverywhere(user, "auditoria", "ver") },
];

const toItems = (tabs: readonly Tab[]) => tabs.map(({ href, label, exact }) => ({ href, label, exact }));
const Tabs = ({ items }: { items: ReturnType<typeof toItems> }) => <NavTabs aria-label="Áreas das configurações" items={items} className="mb-6" />;

async function ConfigTabs() {
  const user = await getPanelUser();
  return <Tabs items={toItems(TABS.filter((tab) => user !== null && tab.allowed(user)))} />;
}

export default function ConfigLayout({ children }: LayoutProps<"/painel/config">) {
  return (
    <>
      {/* enquanto a sessão é lida, só a aba que qualquer pessoa com acesso às Configurações vê */}
      <Suspense fallback={<Tabs items={toItems(TABS.slice(0, 1))} />}>
        <ConfigTabs />
      </Suspense>
      {children}
    </>
  );
}
