/** CSV header labels for recap exports. */
export type CsvHeader = {
  /** Column identifier used in exported data. */
  key: string;
  /** Header label shown in the CSV file. */
  label: string;
};

/** CSV row record keyed by header keys. */
export type CsvRow = Record<string, string | number | null | undefined>;

/**
 * Escape a CSV value for export.
 */
function escapeCsvValue(value: string): string {
  const needsQuotes = value.includes(",") || value.includes("\n") || value.includes("\"");
  const escaped = value.replace(/"/g, "\"\"");
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Build a CSV string from headers and rows.
 */
export function buildCsv(headers: CsvHeader[], rows: CsvRow[]): string {
  const headerLine = headers.map((header) => escapeCsvValue(header.label)).join(",");
  const lines = rows.map((row) =>
    headers
      .map((header) => {
        const raw = row[header.key];
        if (raw === null || raw === undefined) {
          return "";
        }
        return escapeCsvValue(String(raw));
      })
      .join(",")
  );

  return [headerLine, ...lines].join("\n");
}
