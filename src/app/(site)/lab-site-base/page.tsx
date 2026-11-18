// ROTA TEMPORÁRIA de verificação visual (site-base). Remover antes de entregar.
import { CtaBand, FaqAccordion, ServicePanels, StatementBanner, Steps } from "@/components/site/blocks";
import { SiteButton, SiteButtonLink } from "@/components/site/button";
import { PageHeader, Section, SectionHeader } from "@/components/site/layout";
import { LeadForm } from "@/components/site/lead-form";
import { PackageBoard } from "@/components/site/package-card";
import { PhotoSlot } from "@/components/site/photo-slot";
import { PortfolioGrid, TestimonialGrid } from "@/components/site/showcase";
import { sectionCounter } from "@/components/site/text";
import { VideoEmbed } from "@/components/site/video-embed";
import type { PublicImage } from "@/lib/media";
import type { PublicPackage, PublicPortfolioProject, PublicTestimonial } from "@/server/site/queries";

const svg = (w: number, h: number, a: string, b: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.62}" cy="${h * 0.4}" r="${h * 0.22}" fill="#fff" opacity=".35"/></svg>`,
  )}`;
const img = (id: number, w: number, h: number, a = "#8a6f5a", b = "#2b2a33"): PublicImage => ({
  id,
  url: svg(w, h, a, b),
  width: w,
  height: h,
  alt: "[TESTE] imagem de verificação",
  sources: [],
  placeholderColor: a,
});

const project = (id: number, over: Partial<PublicPortfolioProject>): PublicPortfolioProject => ({
  id,
  slug: `teste-${id}`,
  title: "[TESTE] Título do projeto",
  category: "casamentos",
  summary: "Resumo curto do projeto, só para verificar o layout do cartão.",
  description: "",
  servicesDone: [],
  videoUrl: null,
  projectDate: "2026-10-12",
  featured: true,
  clientName: "",
  cover: null,
  gallery: [],
  ...over,
});
const projects = [
  project(1, { cover: img(1, 1200, 1500) }),
  project(2, { category: "marketing", title: "[TESTE] Um título de projeto bem mais comprido que o normal", clientName: "[TESTE] Cliente" }),
  project(3, { category: "eventos", cover: img(3, 1500, 1000, "#5a6f8a", "#1b1b22") }),
];

const testimonial = (id: number, over: Partial<PublicTestimonial>): PublicTestimonial => ({
  id,
  kind: "texto",
  authorName: "[TESTE] Nome da pessoa",
  authorRole: "[TESTE] Empresa",
  content: "Texto de depoimento de teste para verificar o layout do cartão, com duas ou três linhas de extensão.",
  mediaAlt: "",
  videoUrl: null,
  image: null,
  ...over,
});
const testimonials = [
  testimonial(1, {}),
  testimonial(2, { kind: "print", image: img(12, 720, 900, "#e6e2d8", "#cfc6ff"), mediaAlt: "[TESTE] print de conversa", content: "" }),
  testimonial(3, { kind: "video", videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", content: "Legenda curta do vídeo." }),
];

const pkg = (id: number, over: Partial<PublicPackage>): PublicPackage => ({
  id,
  kind: "plano",
  name: "[TESTE] Plano",
  tagline: "Para marcas que querem testar o layout.",
  description: "Foco em verificar o cartão completo.",
  includes: ["Planejamento de conteúdo", "Captação mensal", "Edição de vídeos"],
  deliverables: [
    { label: "Reels", quantity: "8 por mês" },
    { label: "Posts", quantity: "12 por mês" },
  ],
  recordingDuration: "1 diária de 4 horas",
  revisionLimit: "2 rodadas por peça",
  priceMode: "a_partir",
  priceCents: 250000,
  priceSuffix: "/mês",
  recommended: false,
  ctaLabel: "Solicitar orçamento",
  ...over,
});
const plans = [pkg(1, {}), pkg(2, { recommended: true, priceMode: "fixo" }), pkg(3, { priceMode: "sob_consulta", priceCents: null, deliverables: [] })];
const standalone = ["Diária de fotógrafo", "Diária de filmmaker", "Cobertura de eventos", "Storymaker"].map((name, i) =>
  pkg(10 + i, { kind: "avulso", name, tagline: "", description: i === 0 ? "Descrição opcional do avulso." : "", includes: [], deliverables: [], recordingDuration: "", revisionLimit: "", priceMode: "sob_consulta", priceCents: null }),
);

const faqs = [
  { id: 1, question: "[TESTE] Como solicitar um orçamento?", answer: "Resposta de teste com **negrito** e um [link](/contato).\n\nSegundo parágrafo." },
  { id: 2, question: "[TESTE] Uma pergunta bem mais comprida, para ver como o título quebra em duas linhas no celular?", answer: "Resposta curta." },
  { id: 3, question: "[TESTE] Terceira pergunta?", answer: "- item um\n- item dois" },
];

export default function Lab() {
  const next = sectionCounter();
  return (
    <>
      <PageHeader
        eyebrow="Laboratório · temporário"
        title="Tudo o que a sua história precisa para ser *bem contada.*"
        accent="marked"
        lead="Texto de apoio do cabeçalho de página, com uma ou duas linhas."
        text="Segundo parágrafo, mais discreto."
        actions={
          <>
            <SiteButtonLink href="/contato">Solicitar orçamento</SiteButtonLink>
            <SiteButtonLink href="/servicos" variant="secondary">
              Ver serviços
            </SiteButtonLink>
          </>
        }
      />

      <Section id="lab-portfolio" number={next()} label="Portfólio">
        <SectionHeader title="Histórias que já passaram pelo nosso olhar." lead="Texto de apoio opcional da seção." />
        <PortfolioGrid projects={projects} />
      </Section>

      <Section id="lab-depoimentos" number={next()} label="Depoimentos">
        <SectionHeader title="Quem viveu, conta." />
        <TestimonialGrid testimonials={testimonials} />
      </Section>

      <Section id="lab-faq" number={next()} label="Perguntas frequentes">
        <SectionHeader title="Ficou com alguma dúvida?" />
        <div className="s-faq__body">
          <div className="s-faq__side">
            <p>Conte sua ideia. Vamos encontrar juntos a melhor maneira de transformá-la em realidade.</p>
          </div>
          <FaqAccordion items={faqs} name="faq-lab" />
        </div>
      </Section>

      <Section id="lab-pacotes" number={next()} label="Pacotes (detalhe completo)">
        <SectionHeader title="Um plano para cada momento." />
        <PackageBoard packages={plans} recommendedLabel="Recomendado" detail="full" />
        <h3 className="s-h3 mt-16 mb-6">Serviços avulsos</h3>
        <PackageBoard packages={standalone} compact headingLevel={4} />
      </Section>

      <Section id="lab-fotos" number={next()} label="PhotoSlot">
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PhotoSlot image={img(20, 1200, 1500)} index="01" caption={<><strong>Com foto</strong><span>4:5</span></>} />
          <PhotoSlot image={null} tone="lavanda" monogram="Laura" index="02" caption={<><strong>Monograma</strong><span>estado vazio</span></>} />
          <PhotoSlot image={null} tone="grafite" ratio="1 / 1" caption={<><strong>Símbolo</strong><span>1:1</span></>} />
          <PhotoSlot image={img(21, 1600, 900, "#5a8a6f", "#1b1b22")} ratio="16 / 9" tone="paper" />
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <VideoEmbed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Vídeo de teste" />
          <VideoEmbed url="https://vimeo.com/76979871" title="Vídeo com capa" poster={img(22, 1600, 900)} />
        </div>
      </Section>

      <Section id="lab-passos" number={next()} label="Passos (3) + faixa única" bleed={<StatementBanner text="Cada história merece um olhar único." spaceTop />}>
        <SectionHeader title="Como funciona a proposta" />
        <Steps
          items={[
            { title: "Vocês contam", text: "Data, local e o que sonham." },
            { title: "A gente conversa", text: "Entendemos o estilo de vocês." },
            { title: "Proposta personalizada", text: "Um documento com tudo." },
          ]}
        />
        <div className="mt-16">
          <ServicePanels
            items={[
              { title: "Fotografia", text: "Um", href: "/servicos#fotografia" },
              { title: "Vídeo", text: "Dois", href: "/servicos#video" },
              { title: "Marketing", text: "Três", href: "/servicos#marketing" },
              { title: "Eventos", text: "Quatro", href: "/servicos#eventos" },
              { title: "Casamentos", text: "Cinco", href: "/casamentos" },
            ]}
          />
        </div>
      </Section>

      <Section id="lab-form" number={next()} label="Formulários" spaceTop="lg">
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <LeadForm variant="full" originPath="/lab-site-base" title="Variante full" consentText="Concordo com o uso dos dados." submitLabel="Enviar meu projeto" bordered />
          <LeadForm variant="event" originPath="/lab-site-base" title="Variante event" consentText="Concordo com o uso dos dados." submitLabel="Pedir proposta de casamento" defaultInterest="casamentos" defaultEventType="Casamento" bordered />
        </div>
        <div className="mt-10 flex flex-wrap gap-3" data-tone="lavanda" style={{ padding: "2rem" }}>
          <SiteButton>Primário</SiteButton>
          <SiteButton variant="secondary">Secundário</SiteButton>
        </div>
        <div className="flex flex-wrap gap-3" data-tone="grafite" style={{ padding: "2rem" }}>
          <SiteButton>Primário</SiteButton>
          <SiteButton variant="secondary">Secundário</SiteButton>
        </div>
      </Section>

      <CtaBand title="Não sabe por onde *começar?*" text="Conte sua ideia. Vamos encontrar juntos a melhor maneira." cta={{ label: "Solicitar orçamento", href: "/contato" }} secondaryCta={{ label: "Instagram", href: "https://instagram.com/nosstudio.cria" }} />
    </>
  );
}
