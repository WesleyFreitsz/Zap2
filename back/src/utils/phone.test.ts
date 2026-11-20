import assert from "node:assert/strict";
import test from "node:test";
import { withBrazilianNinthDigit } from "./phone";

test("acrescenta o 9 só em celular brasileiro sem o dígito", () => {
  assert.equal(withBrazilianNinthDigit("554399841725"), "5543999841725");
  assert.equal(withBrazilianNinthDigit("5543999841725"), "5543999841725");
  assert.equal(withBrazilianNinthDigit("554332541725"), "554332541725");
  assert.equal(withBrazilianNinthDigit("23704511717525"), "23704511717525");
});
