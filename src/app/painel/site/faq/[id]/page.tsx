import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { paramId } from "@/components/ui/search-params";
import { requireUser } from "@/lib/auth";
import { getFaq } from "@/server/site/admin/faqs";
import { deleteFaqAction, saveFaqAction } from "../actions";
import { FaqForm } from "../form";

export const metadata: Metadata = { title: "Editar pergunta" };
export const instant = false;

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = paramId((await params).id);
  const faq = id ? await getFaq(id) : null;
  if (!faq) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Editar pergunta"
        back={{ href: "/painel/site/faq", label: "Perguntas frequentes" }}
        actions={
          <ConfirmDialog
            trigger={
              <Button variant="danger-ghost" icon={<Trash2 />}>
                Excluir pergunta
              </Button>
            }
            title="Excluir esta pergunta?"
            description="Ela sai do site e não dá para recuperar. Para só tirar do ar, deixe como rascunho."
            confirmLabel="Excluir pergunta"
            action={deleteFaqAction}
            hidden={{ id: faq.id }}
          />
        }
      />
      <Card>
        <FaqForm action={saveFaqAction} faq={faq} />
      </Card>
    </div>
  );
}
