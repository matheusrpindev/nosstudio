import { Suspense } from "react";
import { NavTabs } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";

type Tab = { href: string; label: string; exact?: boolean; adminOnly?: boolean };

/** Subnavegação das Configurações. Áreas só de administrador somem para os demais perfis. */
const TABS: readonly Tab[] = [
  { href: "/painel/config", label: "Visão geral", exact: true },
  { href: "/painel/config/usuarios", label: "Usuários", adminOnly: true },
  { href: "/painel/config/notificacoes", label: "Notificações" },
  { href: "/painel/config/propostas", label: "Propostas" },
  { href: "/painel/config/dados", label: "Dados", adminOnly: true },
  { href: "/painel/config/auditoria", label: "Auditoria", adminOnly: true },
];

const Tabs = ({ items }: { items: readonly Tab[] }) => <NavTabs aria-label="Áreas das configurações" items={items} className="mb-6" />;

async function ConfigTabs() {
  const user = await getCurrentUser();
  return <Tabs items={TABS.filter((tab) => !tab.adminOnly || user?.role === "admin")} />;
}

export default function ConfigLayout({ children }: LayoutProps<"/painel/config">) {
  return (
    <>
      <Suspense fallback={<Tabs items={TABS} />}>
        <ConfigTabs />
      </Suspense>
      {children}
    </>
  );
}
