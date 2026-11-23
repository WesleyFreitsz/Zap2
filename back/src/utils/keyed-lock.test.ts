import assert from "node:assert/strict";
import test from "node:test";
import { createKeyedLock } from "./keyed-lock";

test("roda em fila por chave, em paralelo entre chaves e segue após erro", async () => {
  const withLock = createKeyedLock();
  const created: string[] = [];
  const findOrCreate = (key: string) => withLock(key, async () => {
    const exists = created.includes(key);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (!exists) created.push(key);
    return exists;
  });

  const results = await Promise.all([findOrCreate("a"), findOrCreate("a"), findOrCreate("a"), findOrCreate("b")]);
  assert.deepEqual(results, [false, true, true, false]);
  assert.deepEqual(created.sort(), ["a", "b"]);

  await assert.rejects(withLock("a", async () => { throw new Error("falhou"); }));
  assert.equal(await withLock("a", async () => "seguiu"), "seguiu");
});
