function normalizeCsvCellValue(value: unknown): string {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function escapeCsvCell(value: unknown): string {
  const normalized = normalizeCsvCellValue(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

export function buildCsvLine(values: unknown[]): string {
  return (Array.isArray(values) ? values : []).map((value) => escapeCsvCell(value)).join(",");
}
