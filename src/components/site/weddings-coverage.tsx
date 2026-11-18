/**
 * "O que a cobertura pode incluir": lista numerada em grade, com fios finos entre os itens.
 * Tudo visível (nada depende de hover); a nota final lembra que cada proposta define o que está contratado.
 */
import { cn } from "@/lib/cn";
import { revealProps } from "./reveal";
import { pad2 } from "./text";

export function WeddingsCoverage({
  items,
  note,
  headingLevel = 3,
  className,
}: {
  items: { title: string; text: string }[];
  note?: string;
  headingLevel?: 3 | 4;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Title = `h${headingLevel}` as "h3" | "h4";
  return (
    <div className={cn("weddings-coverage", className)}>
      <ol className="weddings-coverage__list">
        {items.map((item, i) => (
          <li key={i} className="weddings-coverage__item" {...revealProps(i % 3)}>
            <span className="weddings-coverage__n" aria-hidden="true">
              {pad2(i + 1)}
            </span>
            <Title className="s-h3 weddings-coverage__title">
              <span className="sr-only">Item {i + 1}: </span>
              {item.title}
            </Title>
            {item.text ? <p className="weddings-coverage__text">{item.text}</p> : null}
          </li>
        ))}
      </ol>
      {note ? <p className="weddings-coverage__note s-meta">{note}</p> : null}
    </div>
  );
}
