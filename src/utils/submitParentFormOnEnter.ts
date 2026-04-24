import type { KeyboardEvent } from "react";

/**
 * Enter w textarea wysyła nadrzędny formularz (to samo co przycisk Zapisz).
 * Shift+Enter wstawia nową linię — bez tego w notatce nie dałoby się złamać wiersza.
 */
export function submitParentFormOnEnter(
  e: KeyboardEvent<HTMLTextAreaElement>
): void {
  if (e.key !== "Enter") return;
  if (e.shiftKey) return;
  e.preventDefault();
  e.currentTarget.form?.requestSubmit();
}
