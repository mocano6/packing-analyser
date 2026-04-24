import assert from "node:assert/strict";
import { isFormEnterToSubmit } from "./formEnterSubmitKeydown";

const form = {
  contains(el: Element | null) {
    return Boolean(el && (el as unknown as { _in: boolean })._in);
  },
} as unknown as HTMLFormElement;

const el = (tag: string, inForm: boolean) => ({ tagName: tag, _in: inForm }) as unknown as Element;

const fakeEventTarget: EventTarget = { parentNode: null } as unknown as EventTarget;

{
  const ok = isFormEnterToSubmit(
    {
      key: "Enter",
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      repeat: false,
      target: fakeEventTarget,
    },
    form,
    () => el("INPUT", true)
  );
  assert.equal(ok, true);
}

{
  const ok = isFormEnterToSubmit(
    {
      key: "Enter",
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
      repeat: false,
      target: fakeEventTarget,
    },
    form,
    () => el("TEXTAREA", true)
  );
  assert.equal(ok, false);
}

{
  const ok = isFormEnterToSubmit(
    {
      key: "Enter",
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      repeat: false,
      target: fakeEventTarget,
    },
    form,
    () => el("INPUT", false)
  );
  assert.equal(ok, false);
}

{
  const ok = isFormEnterToSubmit(
    {
      key: "Enter",
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      repeat: false,
      target: fakeEventTarget,
    },
    form,
    () => el("BUTTON", false)
  );
  assert.equal(ok, true);
}

console.log("formEnterSubmitKeydown tests: OK");
