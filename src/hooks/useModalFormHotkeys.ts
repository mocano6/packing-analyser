import { type RefObject, useEffect } from "react";
import { applyModalFormHotkeyAction } from "@/utils/modalFormHotkeyHandler";

export interface UseModalFormHotkeysOptions {
  isOpen: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  onCancel: () => void;
}

/**
 * Enter: wysyła formularz jak „Zapisz” (jak Acc8sModal), także przy fokusie na body / przycisku.
 * Escape: zamyka jak „Anuluj”.
 */
export function useModalFormHotkeys({
  isOpen,
  formRef,
  onCancel,
}: UseModalFormHotkeysOptions): void {
  useEffect(() => {
    if (!isOpen) return;

    const onDocKey = (e: KeyboardEvent) => {
      applyModalFormHotkeyAction(e, formRef.current, onCancel);
    };

    document.addEventListener("keydown", onDocKey, true);
    return () => document.removeEventListener("keydown", onDocKey, true);
  }, [isOpen, formRef, onCancel]);
}
