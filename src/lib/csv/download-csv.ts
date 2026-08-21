function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number)[][]
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

/** Trigger a browser download (UTF-8 with BOM for Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function csvFilename(base: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `hna-${slug || "export"}-${date}.csv`;
}

export function wantsCsvExport(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("csv") ||
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    (m.includes("export") && !m.includes("report pdf"))
  );
}
