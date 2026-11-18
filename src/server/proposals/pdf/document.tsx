/**
 * PDF da proposta comercial, na identidade da NÓS Studio (@react-pdf/renderer).
 *
 * SEGURANÇA: este documento recebe SOMENTE `PublicProposal` (src/lib/proposals/public.ts) — a visão pública,
 * sem custos internos, margens, notas internas ou descontos não aprovados. Não importe nada do banco aqui.
 * A pré-visualização no painel e o arquivo baixado saem desta mesma função: são idênticos por construção.
 */
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import path from "node:path";
import type { ReactNode } from "react";
import { LOGO_SHAPES, type LogoVariant } from "@/components/brand/logo-data";
import { formatDate, formatDateLong } from "@/lib/dates";
import { formatBRL, formatPhone, instagramLink, whatsAppLink } from "@/lib/format";
import type { PublicProposal, PublicProposalItem } from "@/lib/proposals/public";

// Fontes estáticas locais (o react-pdf não aceita WOFF2 nem fonte variável).
const fontDir = path.join(process.cwd(), "src/fonts/static");
Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(fontDir, "montserrat-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "montserrat-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(fontDir, "montserrat-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(fontDir, "montserrat-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(fontDir, "montserrat-latin-700-normal.woff"), fontWeight: 700 },
    { src: path.join(fontDir, "montserrat-latin-800-normal.woff"), fontWeight: 800 },
    { src: path.join(fontDir, "montserrat-latin-900-normal.woff"), fontWeight: 900 },
  ],
});
// Sem hifenização automática (as regras embutidas são do inglês).
Font.registerHyphenationCallback((word) => [word]);

const C = {
  roxo: "#3B1F8E",
  lima: "#C6F432",
  lavanda: "#CFC6FF",
  lavandaClaro: "#EFECFF",
  offwhite: "#F6F4EF",
  grafite: "#1B1B22",
  cinza: "#5E5C66",
  areia: "#DAD5C9",
  branco: "#FFFFFF",
};
const M = 52; // margem lateral

const s = StyleSheet.create({
  // ---- capa
  cover: { fontFamily: "Montserrat", color: C.branco, backgroundColor: C.roxo },
  coverInner: { flex: 1, paddingHorizontal: 64, paddingTop: 76, paddingBottom: 64, justifyContent: "space-between" },
  coverEyebrow: { fontSize: 9.5, fontWeight: 600, letterSpacing: 2.2, color: C.lavanda, textTransform: "uppercase" },
  coverTitle: { fontSize: 44, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.6, marginTop: 14 },
  coverFor: { fontSize: 12, fontWeight: 500, color: C.lavanda, marginTop: 30 },
  coverClient: { fontSize: 30, fontWeight: 800, color: C.lima, lineHeight: 1.08, letterSpacing: -0.8, marginTop: 4 },
  coverMeta: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#6B55B5", paddingTop: 16, gap: 28 },
  coverMetaLabel: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.6, color: C.lavanda, textTransform: "uppercase" },
  coverMetaValue: { fontSize: 11.5, fontWeight: 600, marginTop: 4 },

  // ---- páginas internas
  page: {
    fontFamily: "Montserrat",
    fontSize: 10.2,
    lineHeight: 1.55,
    color: C.grafite,
    backgroundColor: C.offwhite,
    paddingTop: 84,
    paddingBottom: 72,
    paddingHorizontal: M,
  },
  header: { position: "absolute", top: 30, left: M, right: M, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.75, borderBottomColor: C.areia, paddingBottom: 12 },
  headerText: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, color: C.cinza, textTransform: "uppercase" },
  // Rodapé fixo. Duas manhas do react-pdf em páginas com quebra automática: (1) posicionar por `top`
  // (A4 = 841,89 pt), porque `bottom` não é confiável; (2) todo o conteúdo sai de `render`, porque texto
  // estático posicionado fora da área de conteúdo não é desenhado.
  footer: { position: "absolute", top: 790, left: M, right: M, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.75, borderTopColor: C.areia, paddingTop: 10 },
  footerText: { fontSize: 7.5, fontWeight: 500, color: C.cinza },

  section: { marginBottom: 30 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionNum: { fontSize: 8.5, fontWeight: 700, color: C.roxo, letterSpacing: 0.6 },
  sectionRule: { width: 18, height: 0.75, backgroundColor: C.roxo },
  sectionLabel: { fontSize: 8.5, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", color: C.grafite },
  h2: { fontSize: 23, fontWeight: 900, lineHeight: 1.08, letterSpacing: -0.7, color: C.grafite, marginBottom: 12 },
  p: { marginBottom: 7, color: C.grafite },
  muted: { color: C.cinza },
  bold: { fontWeight: 700 },
  bulletRow: { flexDirection: "row", gap: 7, marginBottom: 4 },
  bulletMark: { width: 6, height: 6, marginTop: 4.5 },

  facts: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.75, borderTopColor: C.areia, marginTop: 8 },
  fact: { width: "50%", paddingVertical: 9, paddingRight: 12, borderBottomWidth: 0.75, borderBottomColor: C.areia },
  factLabel: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: C.cinza },
  factValue: { fontSize: 11, fontWeight: 600, marginTop: 2 },

  itemRow: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: C.areia, paddingVertical: 9, gap: 12 },
  itemIndex: { width: 22, fontSize: 8.5, fontWeight: 700, color: C.roxo, paddingTop: 1.5 },
  itemTitle: { fontSize: 11, fontWeight: 700, lineHeight: 1.3 },
  itemDesc: { fontSize: 9.2, color: C.cinza, marginTop: 1.5, lineHeight: 1.45 },
  itemQty: { fontSize: 9.2, fontWeight: 600, color: C.roxo, textAlign: "right" },
  itemPrice: { fontSize: 10, fontWeight: 700, textAlign: "right", marginTop: 1 },
  tag: { alignSelf: "flex-start", fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", backgroundColor: C.lavandaClaro, color: C.roxo, paddingVertical: 3, paddingHorizontal: 7, marginBottom: 6, marginTop: 14 },

  invest: { backgroundColor: C.roxo, color: C.branco, padding: 26, marginTop: 4 },
  investLabel: { fontSize: 8.5, fontWeight: 600, letterSpacing: 1.8, textTransform: "uppercase", color: C.lavanda },
  investTotal: { fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, color: C.lima, marginTop: 6 },
  investLine: { flexDirection: "row", justifyContent: "space-between", fontSize: 10, marginTop: 5, color: C.lavanda },
  investSplit: { flexDirection: "row", gap: 24, borderTopWidth: 0.75, borderTopColor: "#6B55B5", marginTop: 18, paddingTop: 14 },
  investSplitLabel: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: C.lavanda },
  investSplitValue: { fontSize: 15, fontWeight: 800, marginTop: 3 },

  payRow: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: C.areia, paddingVertical: 8, alignItems: "center" },
  payLabel: { flex: 1.3, fontSize: 10.5, fontWeight: 600 },
  payDue: { flex: 1, fontSize: 9.5, color: C.cinza },
  payAmount: { width: 110, fontSize: 10.5, fontWeight: 700, textAlign: "right" },
  validity: { marginTop: 14, padding: 12, backgroundColor: C.lavandaClaro, fontSize: 9.5, color: C.roxo, fontWeight: 600 },

  closing: { backgroundColor: C.grafite, color: C.branco, padding: 28, marginTop: 6 },
  closingTitle: { fontSize: 24, fontWeight: 900, letterSpacing: -0.7, lineHeight: 1.08 },
  closingLima: { color: C.lima },
  contactRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 18, borderTopWidth: 0.75, borderTopColor: "#3A3A45" },
  contact: { width: "50%", paddingTop: 12, paddingRight: 10 },
  contactLabel: { fontSize: 7.5, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: C.lavanda },
  contactValue: { fontSize: 11, fontWeight: 600, marginTop: 2, color: C.branco },
});

// ------------------------------------------------------------------- marca
function LogoSvg({ variant, width, letters, accent, text, frame }: { variant: LogoVariant; width: number; letters: string; accent: string; text?: string; frame?: string }) {
  const shape = LOGO_SHAPES[variant];
  return (
    <Svg width={width} height={(width * shape.height) / shape.width} viewBox={`0 0 ${shape.width} ${shape.height}`}>
      {shape.frame && frame ? <Path d={shape.frame} stroke={frame} strokeWidth={shape.frameStroke} strokeLinecap="round" fill="none" /> : null}
      <Path d={shape.letters} fill={letters} fillRule="evenodd" />
      <Path d={shape.accent} fill={accent} />
      {shape.studio && text ? <Path d={shape.studio} fill={text} fillRule="evenodd" /> : null}
    </Svg>
  );
}

/** Cantoneiras de visor nos quatro cantos da página (motivo do logo). */
function ViewfinderCorners({ inset, size, color }: { inset: number; size: number; color: string }) {
  const r = 9;
  const d = `M1 ${size}V${r + 1}Q1 1 ${r + 1} 1H${size}`;
  const corner = (style: object, rotate: number) => (
    <Svg width={size + 2} height={size + 2} viewBox={`0 0 ${size + 2} ${size + 2}`} style={{ position: "absolute", transform: `rotate(${rotate}deg)`, ...style }}>
      <Path d={d} stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
  return (
    <>
      {corner({ top: inset, left: inset }, 0)}
      {corner({ top: inset, right: inset }, 90)}
      {corner({ bottom: inset, right: inset }, 180)}
      {corner({ bottom: inset, left: inset }, 270)}
    </>
  );
}

/** Marcador de lista: o paralelogramo do acento do logo. */
function AccentBullet({ color = C.roxo }: { color?: string }) {
  return (
    <Svg style={s.bulletMark} viewBox="0 0 10 10">
      <Path d="M4 0H10L6 10H0Z" fill={color} />
    </Svg>
  );
}

// ------------------------------------------------------------- texto rico
/** `**negrito**` dentro de uma linha. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={index} style={s.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}

/** Texto digitado no painel: parágrafos separados por linha em branco, listas com "- " e **negrito**. */
function RichText({ children, muted }: { children: string; muted?: boolean }) {
  const blocks = children
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <View>
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim());
        if (lines.every((line) => /^[-*•]\s+/.test(line))) {
          return (
            <View key={index} style={{ marginBottom: 6 }}>
              {lines.map((line, i) => (
                <View key={i} style={s.bulletRow} wrap={false}>
                  <AccentBullet />
                  <Text style={[{ flex: 1 }, muted ? s.muted : {}]}>{inline(line.replace(/^[-*•]\s+/, ""))}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} style={[s.p, muted ? s.muted : {}]}>
            {inline(lines.join("\n").replace(/^#+\s*/, ""))}
          </Text>
        );
      })}
    </View>
  );
}

function Section({
  number,
  label,
  title,
  keepTogether,
  children,
}: {
  number: number;
  label: string;
  title?: string;
  /** Seções curtas (investimento, pagamento): o bloco inteiro vai para a página seguinte se não couber. */
  keepTogether?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={s.section} wrap={!keepTogether}>
      <View style={s.sectionHead} minPresenceAhead={130}>
        <Text style={s.sectionNum}>{String(number).padStart(2, "0")}</Text>
        <View style={s.sectionRule} />
        <Text style={s.sectionLabel}>{label}</Text>
      </View>
      {title ? (
        <Text style={s.h2} minPresenceAhead={60}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function ItemRows({ items }: { items: PublicProposalItem[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={s.itemRow} wrap={false}>
          <Text style={s.itemIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>{item.title}</Text>
            {item.description ? <Text style={s.itemDesc}>{item.description}</Text> : null}
          </View>
          {item.quantityLabel || item.totalCents !== null ? (
            <View style={{ width: 118 }}>
              {item.quantityLabel ? <Text style={s.itemQty}>{item.quantityLabel}</Text> : null}
              {item.totalCents !== null ? <Text style={s.itemPrice}>{formatBRL(item.totalCents)}</Text> : null}
            </View>
          ) : null}
        </View>
      ))}
      <View style={{ borderTopWidth: 0.75, borderTopColor: C.areia }} />
    </View>
  );
}

// --------------------------------------------------------------- documento
export function ProposalDocument({ proposal }: { proposal: PublicProposal }) {
  const { company } = proposal;
  const versionLabel = proposal.version > 1 ? ` · versão ${proposal.version}` : "";
  const facts = [
    proposal.eventDate ? { label: "Data", value: formatDateLong(proposal.eventDate) } : null,
    proposal.eventLocation ? { label: "Local", value: proposal.eventLocation } : null,
    proposal.contactName && proposal.contactName !== proposal.clientName ? { label: "Contato", value: proposal.contactName } : null,
    proposal.ownerName ? { label: "Responsável na NÓS", value: proposal.ownerName } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  const whatsappUrl = whatsAppLink(company.whatsapp);
  const contacts = [
    company.whatsapp ? { label: "WhatsApp", value: formatPhone(company.whatsapp), href: whatsappUrl } : null,
    company.email ? { label: "E-mail", value: company.email, href: `mailto:${company.email}` } : null,
    company.instagram ? { label: "Instagram", value: company.instagram, href: instagramLink(company.instagram) } : null,
    company.siteUrl ? { label: "Site", value: company.siteUrl.replace(/^https?:\/\//, ""), href: company.siteUrl } : null,
  ].filter((contact): contact is { label: string; value: string; href: string } => contact !== null);

  // Numeração contínua: seções vazias não aparecem nem "pulam" número.
  let n = 0;
  const next = () => ++n;

  return (
    <Document
      title={`Proposta ${proposal.number} — ${proposal.clientName}`}
      author={company.brandName}
      subject={proposal.title}
      creator={company.brandName}
      producer={company.brandName}
      language="pt-BR"
    >
      {/* ------------------------------------------------------------ capa */}
      <Page size="A4" style={s.cover}>
        <ViewfinderCorners inset={28} size={46} color={C.lavanda} />
        <View style={s.coverInner}>
          <LogoSvg variant="assinatura" width={168} letters={C.branco} accent={C.lima} text={C.branco} frame={C.lavanda} />
          <View>
            <Text style={s.coverEyebrow}>Proposta comercial · {proposal.modalityLabel}</Text>
            <Text style={s.coverTitle}>{proposal.title}</Text>
            {proposal.clientName ? (
              <>
                <Text style={s.coverFor}>preparada para</Text>
                <Text style={s.coverClient}>{proposal.clientName}</Text>
              </>
            ) : null}
          </View>
          <View>
            <View style={s.coverMeta}>
              <View>
                <Text style={s.coverMetaLabel}>Proposta nº</Text>
                <Text style={s.coverMetaValue}>
                  {proposal.number}
                  {versionLabel}
                </Text>
              </View>
              <View>
                <Text style={s.coverMetaLabel}>Emissão</Text>
                <Text style={s.coverMetaValue}>{formatDate(proposal.issuedOn)}</Text>
              </View>
              {proposal.validUntil ? (
                <View>
                  <Text style={s.coverMetaLabel}>Válida até</Text>
                  <Text style={s.coverMetaValue}>{formatDate(proposal.validUntil)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 10, fontWeight: 600, color: C.lavanda, marginTop: 22 }}>{company.tagline}</Text>
          </View>
        </View>
      </Page>

      {/* ------------------------------------------------- páginas internas */}
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <LogoSvg variant="wordmark" width={40} letters={C.roxo} accent={C.lima} />
          <Text style={s.headerText}>
            Proposta {proposal.number}
            {versionLabel}
            {proposal.clientName ? ` · ${proposal.clientName}` : ""}
          </Text>
        </View>

        {company.aboutText ? (
          <Section number={next()} label="Quem somos" title="Antes de existir a NÓS, já existia um nós.">
            <RichText>{company.aboutText}</RichText>
          </Section>
        ) : null}

        {proposal.intro || facts.length > 0 ? (
          <Section number={next()} label="O projeto" title={proposal.title}>
            {proposal.intro ? <RichText>{proposal.intro}</RichText> : null}
            {facts.length > 0 ? (
              <View style={s.facts} wrap={false}>
                {facts.map((fact) => (
                  <View key={fact.label} style={s.fact}>
                    <Text style={s.factLabel}>{fact.label}</Text>
                    <Text style={s.factValue}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>
        ) : null}

        {proposal.items.length > 0 || proposal.optionals.length > 0 || proposal.exclusions ? (
          <Section number={next()} label="Serviços e entregas" title="O que está incluído">
            {proposal.items.length > 0 ? <ItemRows items={proposal.items} /> : null}
            {proposal.optionals.length > 0 ? (
              <View>
                <Text style={s.tag} minPresenceAhead={50}>
                  Opcionais — não inclusos no investimento
                </Text>
                <ItemRows items={proposal.optionals} />
              </View>
            ) : null}
            {proposal.exclusions ? (
              <View>
                <Text style={s.tag} minPresenceAhead={40}>
                  Não incluso
                </Text>
                <RichText muted>{proposal.exclusions}</RichText>
              </View>
            ) : null}
          </Section>
        ) : null}

        {proposal.scheduleText ? (
          <Section number={next()} label="Cronograma e cobertura" keepTogether={proposal.scheduleText.length < 900}>
            <RichText>{proposal.scheduleText}</RichText>
          </Section>
        ) : null}

        <Section number={next()} label="Investimento" keepTogether>
          <View style={s.invest} wrap={false}>
            <Text style={s.investLabel}>Investimento total</Text>
            <Text style={s.investTotal}>{formatBRL(proposal.totalCents)}</Text>
            {proposal.discount && proposal.subtotalCents !== null ? (
              <View style={{ marginTop: 8 }}>
                <View style={s.investLine}>
                  <Text>Subtotal</Text>
                  <Text>{formatBRL(proposal.subtotalCents)}</Text>
                </View>
                <View style={s.investLine}>
                  <Text>{proposal.discount.label}</Text>
                  <Text>− {formatBRL(proposal.discount.cents)}</Text>
                </View>
              </View>
            ) : null}
            {proposal.entry ? (
              <View style={s.investSplit}>
                <View>
                  <Text style={s.investSplitLabel}>Entrada{proposal.entry.percent ? ` (${proposal.entry.percent.toLocaleString("pt-BR")}%)` : ""}</Text>
                  <Text style={s.investSplitValue}>{formatBRL(proposal.entry.cents)}</Text>
                </View>
                <View>
                  <Text style={s.investSplitLabel}>Saldo restante</Text>
                  <Text style={s.investSplitValue}>{formatBRL(proposal.balanceCents)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Section>

        {proposal.payments.length > 0 || proposal.paymentNotes ? (
          <Section number={next()} label="Condições de pagamento" keepTogether={proposal.payments.length <= 8}>
            {proposal.payments.length > 0 ? (
              <View style={{ marginBottom: proposal.paymentNotes ? 10 : 0 }}>
                {proposal.payments.map((payment, index) => (
                  <View key={index} style={s.payRow} wrap={false}>
                    <Text style={s.payLabel}>{payment.label}</Text>
                    <Text style={s.payDue}>{payment.dueText}</Text>
                    <Text style={s.payAmount}>{formatBRL(payment.amountCents)}</Text>
                  </View>
                ))}
                <View style={{ borderTopWidth: 0.75, borderTopColor: C.areia }} />
              </View>
            ) : null}
            {proposal.paymentNotes ? <RichText>{proposal.paymentNotes}</RichText> : null}
          </Section>
        ) : null}

        {proposal.conditions || proposal.validUntil ? (
          <Section number={next()} label="Observações e condições">
            {proposal.conditions ? <RichText>{proposal.conditions}</RichText> : null}
            {proposal.validUntil ? (
              <Text style={s.validity}>Esta proposta é válida até {formatDateLong(proposal.validUntil)}.</Text>
            ) : null}
          </Section>
        ) : null}

        <View style={s.closing} wrap={false}>
          <Text style={s.closingTitle}>
            Você traz a história.{"\n"}
            <Text style={s.closingLima}>NÓS encontramos o olhar.</Text>
          </Text>
          {contacts.length > 0 ? (
            <View style={s.contactRow}>
              {contacts.map((contact) => (
                <View key={contact.label} style={s.contact}>
                  <Text style={s.contactLabel}>{contact.label}</Text>
                  <Text style={s.contactValue}>{contact.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* rodapé fixo: último filho da página, para ser repetido em todas */}
        <View
          style={s.footer}
          fixed
          render={(props) => {
            // o total de páginas chega em tempo de execução, mas não consta na tipagem do render de <View>
            const { pageNumber, totalPages } = props as { pageNumber: number; totalPages?: number };
            return (
              <>
                <Text style={s.footerText}>{`${company.brandName} — ${company.tagline}`}</Text>
                <Text style={s.footerText}>{totalPages ? `${pageNumber} / ${totalPages}` : String(pageNumber)}</Text>
              </>
            );
          }}
        />
      </Page>
    </Document>
  );
}
