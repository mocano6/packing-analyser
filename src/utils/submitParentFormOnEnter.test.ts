import assert from "node:assert/strict";
import { submitParentFormOnEnter } from "./submitParentFormOnEnter";
import type { KeyboardEvent } from "react";

{
  let calls = 0;
  const form = { requestSubmit: () => { calls += 1; } } as unknown as HTMLFormElement;
  const textarea = { form } as HTMLTextAreaElement;
  submitParentFormOnEnter({
    key: "Enter",
    shiftKey: false,
    preventDefault: () => {},
    currentTarget: textarea,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>);
  assert.equal(calls, 1);
}

{
  let calls = 0;
  const form = { requestSubmit: () => { calls += 1; } } as unknown as HTMLFormElement;
  const textarea = { form } as HTMLTextAreaElement;
  submitParentFormOnEnter({
    key: "Enter",
    shiftKey: true,
    preventDefault: () => {},
    currentTarget: textarea,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>);
  assert.equal(calls, 0);
}

console.log("submitParentFormOnEnter tests: OK");
