/**
 * Czy skrót Enter powinien wysłać formularz (to samo co przycisk type="submit"),
 * m.in. gdy fokus jest w obrębie formularza, na `body` po otwarciu modala, lub
 * na przycisku w formularzu — bez wysyłki, gdy użytkownik edytuje pole INPUT/TEXTAREA/SELECT
 * spoza wskazanego `form` (inny otwarty formularz na stronie).
 */
export function isFormEnterToSubmit(
  e: {
    key: string;
    defaultPrevented: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;
    target: EventTarget | null;
  },
  form: HTMLFormElement,
  getActive: () => Element | null
): boolean {
  if (e.key !== "Enter" || e.defaultPrevented) return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.repeat) return false;
  for (let n: Node | null = e.target as Node | null; n; n = n.parentNode) {
    if (n.nodeName === "IFRAME") return false;
  }
  const active = getActive();
  if (active) {
    const tag = active.tagName;
    const inForm = form.contains(active);
    if (
      (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
      !inForm
    ) {
      return false;
    }
    if (inForm && tag === "TEXTAREA" && e.shiftKey) {
      return false;
    }
  }
  return true;
}
