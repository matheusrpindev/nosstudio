import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/server/settings";
import { ProposalDefaultsForm } from "./form";

export const metadata: Metadata = { title: "Padrões de proposta" };
export const instant = false;

export default async function ProposalDefaultsPage() {
  await requireUser();
  const defaults = await getSetting("proposal");
  return (
    <>
      <PageHeader title="Padrões de proposta" description="O que já vem preenchido em cada orçamento novo. Orçamentos que já existem não mudam." back={{ href: "/painel/config", label: "Configurações" }} />
      <ProposalDefaultsForm defaults={defaults} />
    </>
  );
}
