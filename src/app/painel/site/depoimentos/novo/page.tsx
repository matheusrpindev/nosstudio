import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { saveTestimonialAction } from "../actions";
import { TestimonialForm } from "../form";
import { AuthorizationNotice } from "../notice";

export const metadata: Metadata = { title: "Novo depoimento" };
export const instant = false;

export default async function NewTestimonialPage() {
  await requirePermission("site", "editar");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo depoimento" back={{ href: "/painel/site/depoimentos", label: "Depoimentos do site" }} />
      <AuthorizationNotice />
      <Card>
        <TestimonialForm action={saveTestimonialAction} media={null} initial={{ id: null, kind: "texto", authorName: "", authorRole: "", content: "", mediaAlt: "", videoUrl: "", authorized: false, published: false }} />
      </Card>
    </div>
  );
}
