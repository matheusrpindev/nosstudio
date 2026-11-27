/**
 * Valores em linhas tipográficas (página /sobre): número, palavra gigante e o compromisso ao lado.
 * Quando nenhum valor tem frase (só os nomes, como no briefing v2), a lista vira uma grade de palavras.
 */
import { revealProps } from "./reveal";
import { pad2 } from "./text";

export function AboutValues({
  items,
  headingLevel = 3,
}: {
  items: { title: string; text: string }[];
  headingLevel?: 3 | 4;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <ol className="about__values" data-plain={items.every((item) => !item.text) || undefined}>
      {items.map((item, i) => (
        <li key={i} className="about__value" {...revealProps(i % 4)}>
          <span className="about__value-n" aria-hidden="true">
            {pad2(i + 1)}
          </span>
          <Title className="about__value-title">{item.title}</Title>
          {item.text ? <p className="about__value-text">{item.text}</p> : null}
        </li>
      ))}
    </ol>
  );
}
