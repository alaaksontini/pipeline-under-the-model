export const CATEGORIES = [
  "standing desk",
  "desk chair",
  "monitor arm",
  "desk lamp",
  "bookshelf",
  "filing cabinet",
] as const;

/** `brand|name` lowercase alphanumeric — the exact-match dedupe key. */
export function dedupeKey(brand: string, name: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return `${clean(brand)}|${clean(name)}`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a price from messy human strings: "€383,64", "EUR 501.44", "1.234,56".
 *  Returns EUR units (not cents) or null when unparseable. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[€$]|eur|usd|eur\b/gi, "").trim();
  if (!s) return null;
  // decimal comma: "383,64" -> 383.64 ; thousands "1.234,56" -> 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/\bstand(ing|up)\b|sit.?stand|height.?adjustable/i, "standing desk"],
  [/monitor|vesa|screen.?mount/i, "monitor arm"],
  [/chair|seat|lumbar/i, "desk chair"],
  [/lamp|light|beam|glow|lumi/i, "desk lamp"],
  [/shelf|shelv|book|rack|tier/i, "bookshelf"],
  [/cabinet|filing|drawer|pedestal|archiv|docu/i, "filing cabinet"],
];

/** Infer category from free text when a source doesn't provide one.
 *  Returns null when nothing matches — validation decides what to do. */
export function inferCategory(text: string): string | null {
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return null;
}

export function toInt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return null;
}
