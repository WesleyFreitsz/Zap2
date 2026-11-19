import assert from "node:assert/strict";
import { test } from "node:test";
import { assertConversationAccess, conversationScope } from "./conversation-access";

test("employee only reaches conversations assigned to them", () => {
  const employee = { userId: "u1", role: "EMPLOYEE" };
  assert.doesNotThrow(() => assertConversationAccess({ assignedToId: "u1" }, employee));
  assert.throws(() => assertConversationAccess({ assignedToId: "u2" }, employee), /Access denied/);
  assert.throws(() => assertConversationAccess({ assignedToId: null }, employee), /Access denied/);
  assert.deepEqual(conversationScope(employee), { assignedToId: "u1" });
});

test("admins reach every conversation of the company", () => {
  const admin = { userId: "a1", role: "ADMIN" };
  assert.doesNotThrow(() => assertConversationAccess({ assignedToId: "u2" }, admin));
  assert.deepEqual(conversationScope(admin), {});
});
