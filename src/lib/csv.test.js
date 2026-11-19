import assert from "node:assert/strict";
import test from "node:test";
import { toCsv } from "./csv.js";

test("uses semicolons and CRLF while escaping quotes and multiline cells", () => {
  assert.equal(
    toCsv(["Nome", "Tags", "Descrição"], [['Ana "Lima"', "A;B", "linha\numa\r\noutra"]]),
    'Nome;Tags;Descrição\r\n"Ana ""Lima""";"A;B";"linha\numa\r\noutra"',
  );
});

test("prefixes formula-like cells before escaping delimiters", () => {
  assert.equal(
    toCsv(["=Nome", "B", "C", "D", "E"], [["=1;2", "+1", "-1", "@nome", "\tvalor"]]),
    "'=Nome;B;C;D;E\r\n\"'=1;2\";'+1;'-1;'@nome;'\tvalor",
  );
});

test("preserves empty cells and exports headers for an empty list", () => {
  assert.equal(toCsv(["A", "B", "C", "D"], [["", null, undefined, 0]]), "A;B;C;D\r\n;;;0");
  assert.equal(toCsv(["A", "B"], []), "A;B");
});
