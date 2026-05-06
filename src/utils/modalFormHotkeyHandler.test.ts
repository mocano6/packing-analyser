import assert from "node:assert/strict";
import { applyModalFormHotkeyAction } from "./modalFormHotkeyHandler";

const form = {
  contains() {
    return true;
  },
  _submitted: 0,
  requestSubmit(this: { _submitted: number }) {
    this._submitted += 1;
  },
} as unknown as HTMLFormElement & { _submitted: number };

{
  let cancelled = 0;
  let escapePrevented = false;
  const e = {
    key: "Escape",
    get defaultPrevented() {
      return escapePrevented;
    },
    preventDefault() {
      escapePrevented = true;
    },
  } as unknown as KeyboardEvent;

  applyModalFormHotkeyAction(e, form, () => {
    cancelled += 1;
  });
  assert.equal(cancelled, 1);
  assert.equal(escapePrevented, true);
}

{
  form._submitted = 0;
  let enterPrevented = false;
  const e = {
    key: "Enter",
    get defaultPrevented() {
      return enterPrevented;
    },
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    target: { parentNode: null } as unknown as EventTarget,
    preventDefault() {
      enterPrevented = true;
    },
  } as unknown as KeyboardEvent;

  applyModalFormHotkeyAction(
    e,
    form,
    () => {
      assert.fail("cancel should not run");
    },
    () => ({ tagName: "BUTTON", parentNode: null }) as unknown as Element
  );
  assert.equal(form._submitted, 1);
  assert.equal(enterPrevented, true);
}

console.log("modalFormHotkeyHandler tests: OK");
