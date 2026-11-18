/**
 * O React 19 chama `form.reset()` sozinho quando a action de um `<form action={…}>` termina (com sucesso ou com
 * erro). Campos de texto controlados sobrevivem — o React mantém o atributo `value` em dia —, mas caixas de
 * seleção, rádios e `<select>` CONTROLADOS (`checked=`/`value=` vindos de estado) voltam ao que estava marcado
 * quando a página foi renderizada, e o React só os corrige quando as props deles mudarem de novo. Resultado: a
 * tela mostra uma coisa e o estado (o que foi ou será salvo) outra — por exemplo, "Desconto aprovado" aparecendo
 * desmarcado logo depois de salvar marcado.
 *
 * Use como `onReset` do formulário: guarda o que estava marcado/escolhido no instante do reset e devolve logo
 * depois. `onlyMarked`: só os campos com o atributo `data-controlled` (formulários que também têm campos não
 * controlados, para os quais o reset automático é o comportamento esperado).
 */
export function keepChoicesOnReset(event: { currentTarget: HTMLFormElement }, onlyMarked = false): void {
  const restore: (() => void)[] = [];
  for (const element of Array.from(event.currentTarget.elements)) {
    if (onlyMarked && !element.hasAttribute("data-controlled")) continue;
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      const checked = element.checked;
      restore.push(() => {
        if (element.checked !== checked) element.checked = checked;
      });
    } else if (element instanceof HTMLSelectElement) {
      const selected = Array.from(element.options, (option) => option.selected);
      restore.push(() => {
        Array.from(element.options).forEach((option, index) => {
          if (index < selected.length && option.selected !== selected[index]) option.selected = selected[index];
        });
      });
    }
  }
  // o evento "reset" dispara ANTES de o navegador resetar os campos: a devolução fica para logo depois
  if (restore.length > 0) queueMicrotask(() => restore.forEach((apply) => apply()));
}
