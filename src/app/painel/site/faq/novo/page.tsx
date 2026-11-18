import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { saveFaqAction } from "../actions";
import { FaqForm } from "../form";

export const metadata: Metadata = { title: "Nova pergunta" };
export const instant = false;

export default async function NewFaqPage() {
  await requireUser();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nova pergunta" back={{ href: "/painel/site/faq", label: "Perguntas frequentes" }} />
      <Card>
        <FaqForm action={saveFaqAction} faq={null} />
      </Card>
    </div>
  );
}
