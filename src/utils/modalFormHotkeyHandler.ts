import { isFormEnterToSubmit } from "./formEnterSubmitKeydown";

/**
 * Logika Enter / Escape w modalach z formularzem (wspólna z hookiem useModalFormHotkeys).
 * Enter: requestSubmit jak „Zapisz”. Escape: onCancel jak „Anuluj”.
 */
export function applyModalFormHotkeyAction(
  e: KeyboardEvent,
  form: HTMLFormElement | null,
  onCancel: () => void,
  getActive: () => Element | null = () => document.activeElement
): void {
  if (!form) return;

  if (e.key === "Escape") {
    if (e.defaultPrevented) return;
    e.preventDefault();
    onCancel();
    return;
  }

  if (!isFormEnterToSubmit(e, form, getActive)) {
    return;
  }
  e.preventDefault();
  form.requestSubmit();
}
