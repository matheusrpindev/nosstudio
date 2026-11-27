/**
 * Leitor MÍNIMO de iCalendar — só para os testes conferirem o `.ics` que a agenda gera (`ics.ts`): desdobra as
 * linhas, separa nome, parâmetros e valor, e monta a árvore de componentes (VCALENDAR › VEVENT › VALARM…).
 * Não é um leitor completo do RFC 5545 (não trata aspas em parâmetros nem valores múltiplos).
 */
export type Prop = { name: string; params: Record<string, string>; value: string };
export type Component = { type: string; props: Prop[]; children: Component[] };

export const unescape = (value: string) => value.replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1");

export function parseIcs(text: string): Component {
  // desdobra: CRLF seguido de espaço ou TAB é continuação da linha anterior
  const lines = text.replace(/\r\n[ \t]/g, "").split("\r\n").filter(Boolean);
  const root: Component = { type: "ROOT", props: [], children: [] };
  const stack = [root];
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`linha sem ":" → ${line}`);
    const [name, ...paramParts] = line.slice(0, colon).split(";");
    const value = line.slice(colon + 1);
    if (name === "BEGIN") {
      const component: Component = { type: value, props: [], children: [] };
      stack[stack.length - 1].children.push(component);
      stack.push(component);
    } else if (name === "END") {
      const open = stack.pop();
      if (!open || open.type !== value) throw new Error(`END:${value} sem BEGIN correspondente`);
    } else {
      stack[stack.length - 1].props.push({ name, params: Object.fromEntries(paramParts.map((part) => part.split("=") as [string, string])), value });
    }
  }
  if (stack.length !== 1) throw new Error("componente não fechado");
  return root.children[0];
}

export const prop = (component: Component, name: string) => component.props.find((item) => item.name === name);
export const props = (component: Component, name: string) => component.props.filter((item) => item.name === name);
export const events = (calendar: Component) => calendar.children.filter((child) => child.type === "VEVENT");
