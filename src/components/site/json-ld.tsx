import { env } from "@/lib/env";
import { instagramLink, safeUrl, toWhatsAppNumber } from "@/lib/format";
import { getSiteContent } from "@/server/site/queries";

/**
 * Dados estruturados (schema.org) da empresa. Só inclui o que os sócios preencheram — nada de endereço,
 * avaliações ou datas inventadas. O JSON é escapado ("<" → <), como recomenda a documentação do Next.
 */
export async function OrganizationJsonLd() {
  const { general, seo } = await getSiteContent();
  const sameAs = [instagramLink(general.instagram), ...general.socialLinks.map((link) => safeUrl(link.href))].filter(Boolean);
  const phone = toWhatsAppNumber(general.whatsapp);
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: general.brandName,
    slogan: general.tagline,
    description: seo.pages.home.description,
    url: env.siteUrl,
    logo: `${env.siteUrl}/brand/nos-studio-completo-roxo.svg`,
    image: `${env.siteUrl}/og`,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(general.email ? { email: general.email } : {}),
    ...(phone ? { telephone: `+${phone}` } : {}),
    ...(general.serviceArea ? { areaServed: general.serviceArea } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
