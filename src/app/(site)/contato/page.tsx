import { ContactAside } from "@/components/site/contact-aside";
import { ContactPackageNotice } from "@/components/site/contact-package-notice";
import { LeadForm } from "@/components/site/lead-form";
import { PageHeader, Section } from "@/components/site/layout";
import { instagramLink, whatsAppLink } from "@/lib/format";
import { buildMetadata } from "@/lib/site/seo";
import { getLeadOriginNames, getSiteContent } from "@/server/site/queries";
import "./contact.css";

export const generateMetadata = () => buildMetadata("contato");

/**
 * Contato e orçamento: página de conversão, com o formulário "inteligente" do briefing v2 (seção 10) — os campos
 * adicionais mudam conforme o serviço escolhido. Estática: `?servico=` e `?pacote=` são lidos no navegador pelo
 * <LeadForm> (pré-seleção do serviço/plano de origem) e por <ContactPackageNotice> (aviso "Pedido sobre").
 */
export default async function ContactPage() {
  const [{ contactPage, general, howItWorks }, packageNames] = await Promise.all([getSiteContent(), getLeadOriginNames()]);
  // `?pacote=` só vale para nomes de planos e serviços publicados (nada de texto arbitrário exibido na página)

  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const instagram = instagramLink(general.instagram);
  const steps = howItWorks.steps.filter((step) => step.title).slice(0, 5);

  return (
    <>
      {/* cabeçalho enxuto: numa página de conversão o formulário precisa aparecer logo */}
      <div className="contact__head">
        <PageHeader eyebrow={contactPage.eyebrow} title={contactPage.title} lead={contactPage.text} accent="marked" />
      </div>
      <Section id="contato-formulario" labelledBy={undefined}>
        <div className="contact__grid">
          <div className="contact__main">
            <ContactPackageNotice options={packageNames} />
            <LeadForm
              id="formulario"
              variant="full"
              originPath="/contato"
              consentText={contactPage.consentText}
              submitLabel={contactPage.submitLabel}
              packageOptions={packageNames}
              bordered
            />
          </div>
          <ContactAside
            whatsapp={whatsapp ? { href: whatsapp, label: contactPage.whatsappLabel } : null}
            instagram={instagram ? { href: instagram, label: contactPage.instagramLabel, handle: general.instagram } : null}
            email={general.email ? { href: `mailto:${general.email}`, address: general.email } : null}
            steps={steps}
          />
        </div>
      </Section>
    </>
  );
}
