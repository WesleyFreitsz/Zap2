import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "./crypto";

test("criptografa e descriptografa o token com AES-GCM e rejeita alteração", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const token = "page-access-token";
  const encrypted = encryptSecret(token, key);
  assert.equal(decryptSecret(encrypted, key), token);
  assert.notEqual(encryptSecret(token, key), encrypted);
  assert.throws(() => decryptSecret(encrypted, Buffer.alloc(32, 8).toString("base64")), /Credencial Meta inválida/);
  assert.throws(() => encryptSecret(token, "invalid"), /Integração Meta não configurada/);

  const [iv, tag, cipherText] = encrypted.split(".");
  const modified = Buffer.from(cipherText, "base64");
  modified[0] ^= 1;
  assert.throws(() => decryptSecret(`${iv}.${tag}.${modified.toString("base64")}`, key), /Credencial Meta inválida/);
});
