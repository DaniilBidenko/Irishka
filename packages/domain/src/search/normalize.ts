/** Нормализация поисковой строки: NFKC, lower, ё→е, пробелы. */
export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Экранирование % и _ для LIKE literal-поиска. */
export function escapeLikeLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function buildInstallationSearchBlob(parts: {
  title: string;
  summary: string;
  clientDisplayName?: string;
}): string {
  return normalizeSearchText(
    [parts.title, parts.summary, parts.clientDisplayName ?? ""].join(" "),
  );
}
