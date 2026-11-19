import assert from "node:assert/strict";
import test from "node:test";
import { quickReplySchema } from "./quick-reply.schema";

test("validates quick reply shortcuts and preserves message formatting", () => {
  const reply = { shortcut: "ola-2", content: "Olá!\nComo posso ajudar?" };
  assert.deepEqual(quickReplySchema.parse(reply), reply);

  for (const shortcut of ["", "Olá", "/ola", "ola mundo", "a".repeat(31)]) {
    assert.equal(quickReplySchema.safeParse({ ...reply, shortcut }).success, false);
  }
  for (const content of ["", " \n ", "a".repeat(2001)]) {
    assert.equal(quickReplySchema.safeParse({ ...reply, content }).success, false);
  }
});
