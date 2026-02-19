export function parseDecimal(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "EMPTY" };

  // allow commas as thousands separators
  const normalized = s.replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return { ok: false, error: `NOT_A_NUMBER:${input}` };

  // keep as string to avoid float rounding; Prisma Decimal accepts string.
  // We do a simple fixed-ish normalization by using the original normalized string.
  return { ok: true, value: normalized };
}

export function parseDateFlexible(input: string): { ok: true; value: Date } | { ok: false; error: string } {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "EMPTY" };

  // ISO or Date.parse-able
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return { ok: true, value: new Date(iso) };

  // DD/MM/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    // ambiguous. Strategy:
    // - if a > 12 => treat as DD/MM
    // - else if b > 12 => treat as MM/DD
    // - else default to DD/MM (per Shopify payouts spec note)
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      month = a;
      day = b;
    }

    const d = new Date(Date.UTC(y, month - 1, day));
    if (Number.isNaN(d.getTime())) return { ok: false, error: `BAD_DATE:${input}` };
    return { ok: true, value: d };
  }

  return { ok: false, error: `UNSUPPORTED_DATE_FORMAT:${input}` };
}
