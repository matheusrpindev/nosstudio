/**
 * Valores em linhas tipográficas (página /sobre): número, palavra gigante e o compromisso ao lado.
 * Na home os mesmos valores aparecem resumidos com <ValuesList />.
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
    <ol className="about__values">
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
