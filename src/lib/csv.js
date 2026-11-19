function escapeCell(value) {
  let cell = String(value ?? "");
  if (/^[=+@\t-]/.test(cell)) cell = "'" + cell;
  return /[;"\r\n]/.test(cell) ? '"' + cell.replaceAll('"', '""') + '"' : cell;
}

export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(";"))
    .join("\r\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
