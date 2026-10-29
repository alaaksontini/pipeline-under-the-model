import type { ProductDraft } from "../types";
import { inferCategory, parsePrice, toInt } from "../util/text";

function first<T>(...xs: (T | undefined | null)[]): T | undefined {
  return xs.find((x) => x !== undefined && x !== null) as T | undefined;
}

/** supplier-c: JSONL where every line may use different keys for the
 *  same concept. The dirtiest feed in the demo. */
export function mapSupplierC(rawId: number, p: Record<string, unknown>): ProductDraft {
  const name = first(p.name, p.title);
  const price = first(p.price_eur, p.price, p.cost);
  const stock = first(p.qty, p.quantity, p.stock);
  const brand = first(p.vendor, p.brand);
  const cat = first(p.cat, p.category, p.category_text);
  const desc = first(p.desc, p.notes);

  const parsed = parsePrice(price);
  const category =
    typeof cat === "string" && cat.trim()
      ? cat.trim().toLowerCase()
      : inferCategory(`${name ?? ""} ${desc ?? ""}`);

  return {
    rawId,
    sourceId: "supplier-c",
    sourceRecordId: typeof p.id === "string" ? p.id : `c-${rawId}`,
    name: typeof name === "string" ? name.trim() : null,
    nameRaw: name,
    brand: typeof brand === "string" && brand.trim() ? brand.trim() : null,
    priceEurCents: parsed === null ? null : Math.round(parsed * 100),
    priceRaw: price,
    currencyRaw: "EUR",
    stock: toInt(stock),
    stockRaw: stock,
    category,
    description: typeof desc === "string" ? desc : "",
  };
}
