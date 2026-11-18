/**
 * Coluna lateral da página de contato: canais diretos (WhatsApp só com número configurado) e os primeiros
 * passos do "Como funciona", compactos. Server Component.
 */
import { SiteButtonLink } from "./button";
import { revealProps } from "./reveal";
import { pad2 } from "./text";

export type ContactAsideProps = {
  whatsapp: { href: string; label: string } | null;
  instagram: { href: string; label: string; handle: string } | null;
  email: { href: string; address: string } | null;
  steps: { title: string; text: string }[];
};

export function ContactAside({ whatsapp, instagram, email, steps }: ContactAsideProps) {
  const hasChannels = Boolean(whatsapp || instagram || email);
  if (!hasChannels && steps.length === 0) return null;
  return (
    <aside className="contact__aside" aria-label="Outros caminhos e próximos passos">
      {hasChannels ? (
        <section className="contact__block" aria-labelledby="contato-canais" {...revealProps()}>
          <h2 id="contato-canais" className="s-meta contact__label">
            Prefere falar direto?
          </h2>
          <div className="contact__buttons">
            {whatsapp ? (
              <SiteButtonLink href={whatsapp.href} icon="whatsapp" block>
                {whatsapp.label}
              </SiteButtonLink>
            ) : null}
            {instagram ? (
              <SiteButtonLink href={instagram.href} icon="instagram" variant="secondary" block>
                {instagram.label}
              </SiteButtonLink>
            ) : null}
            {email ? (
              <SiteButtonLink href={email.href} icon="mail" variant="secondary" block>
                {email.address}
              </SiteButtonLink>
            ) : null}
          </div>
          {instagram?.handle ? <p className="s-meta s-muted contact__handle">{instagram.handle}</p> : null}
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section className="contact__block" aria-labelledby="contato-depois" {...revealProps(1)}>
          <h2 id="contato-depois" className="s-meta contact__label">
            Depois do envio
          </h2>
          <ol className="contact__steps">
            {steps.map((step, i) => (
              <li key={i}>
                <span className="contact__step-n" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                <div>
                  <h3>
                    <span className="sr-only">Passo {i + 1}: </span>
                    {step.title}
                  </h3>
                  {step.text ? <p>{step.text}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </aside>
  );
}
