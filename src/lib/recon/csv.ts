export type CsvRow = Record<string, string>;

// Minimal CSV parser: handles commas, quotes, and CRLF.
// Not streaming; intended for MVP-sized CSVs.
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    cur.push(field);
    field = "";
  };

  const pushRow = () => {
    // skip completely empty trailing row
    if (cur.length === 1 && cur[0] === "") {
      cur = [];
      return;
    }
    rows.push(cur);
    cur = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushField();
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (ch === "\r") {
      // ignore; will be handled by following \n
      continue;
    }

    field += ch;
  }

  // flush
  pushField();
  if (cur.length) pushRow();

  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const obj: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (line[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

export function getCsvHeaders(text: string): string[] {
  const parsed = parseCsv(text);
  // parseCsv drops the header; so we parse manually:
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}
