import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublicAddress } from "./automation.service";

test("bloqueia endereços internos, inclusive IPv4 mapeado em IPv6", () => {
  for (const address of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "localhost"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("aceita endereços públicos", () => {
  for (const address of ["8.8.8.8", "2001:4860::8888"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});
