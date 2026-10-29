import type { ProductDraft } from "../types";
import { inferCategory, parsePrice, stripHtml, toInt } from "../util/text";

/** supplier-b: nested structure, EUR strings with symbols, HTML descriptions,
 *  a `pricing.unit` that claims "units" or "cents" — or an unknown value. */
export function mapSupplierB(rawId: number, p: Record<string, unknown>): ProductDraft {
  const prod = (p.product ?? {}) as Record<string, unknown>;
  const pricing = (p.pricing ?? {}) as Record<string, unknown>;
  const inv = (p.inventory ?? {}) as Record<string, unknown>;

  const amount = parsePrice(pricing.amount);
  const unit = typeof pricing.unit === "string" ? pricing.unit : null;
  let priceEurCents: number | null = null;
  if (amount !== null && unit === "units") priceEurCents = Math.round(amount * 100);
  else if (amount !== null && unit === "cents") priceEurCents = Math.round(amount);
  // unknown unit (e.g. "dollars"): leave null — validation quarantines it
  // rather than guessing at a conversion.

  const descHtml = typeof p.desc_html === "string" ? p.desc_html : "";
  const desc = stripHtml(descHtml);

  return {
    rawId,
    sourceId: "supplier-b",
    sourceRecordId: typeof p.id === "string" ? p.id : `b-${rawId}`,
    name: typeof prod.title === "string" ? prod.title.trim() : null,
    nameRaw: prod.title,
    brand: typeof prod.maker === "string" && prod.maker.trim() ? prod.maker.trim() : null,
    priceEurCents,
    priceRaw: pricing.amount,
    currencyRaw: unit,
    stock: toInt(inv.count),
    stockRaw: inv.count,
    category: inferCategory(`${prod.title ?? ""} ${desc}`),
    description: desc,
  };
}
