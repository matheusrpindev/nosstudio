import { NavTabs } from "@/components/ui/tabs";

/** Subnavegação do editor do site. As páginas de cada aba (e a autenticação) ficam nas próprias páginas. */
const TABS = [
  { href: "/painel/site", label: "Visão geral", exact: true },
  { href: "/painel/site/inicio", label: "Página inicial" },
  { href: "/painel/site/textos", label: "Textos" },
  { href: "/painel/site/banners", label: "Banners" },
  { href: "/painel/site/avisos", label: "Avisos" },
  { href: "/painel/site/servicos", label: "Serviços" },
  { href: "/painel/site/pacotes", label: "Planos" },
  { href: "/painel/site/faq", label: "FAQ" },
  { href: "/painel/site/portfolio", label: "Portfólio" },
  { href: "/painel/site/depoimentos", label: "Depoimentos" },
  { href: "/painel/site/rodape", label: "Rodapé" },
  { href: "/painel/site/metricas", label: "Métricas" },
] as const;

export default function SiteEditorLayout({ children }: LayoutProps<"/painel/site">) {
  return (
    <>
      <NavTabs aria-label="Áreas do editor do site" items={TABS} className="mb-6" />
      {children}
    </>
  );
}
