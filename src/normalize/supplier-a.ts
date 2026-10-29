import type { ProductDraft } from "../types";
import { inferCategory, parsePrice, toInt } from "../util/text";

const USD_TO_EUR = 1 / 1.08; // fixed demo rate — deterministic on purpose

/** supplier-a: flat rows, USD prices, no descriptions. */
export function mapSupplierA(rawId: number, p: Record<string, unknown>): ProductDraft {
  const usd = parsePrice(p.cost_usd);
  const text = `${p.item_name ?? ""} ${p.category ?? ""}`;
  return {
    rawId,
    sourceId: "supplier-a",
    sourceRecordId: `a-${rawId}`,
    name: typeof p.item_name === "string" ? p.item_name.trim() : null,
    nameRaw: p.item_name,
    brand: typeof p.brand === "string" && p.brand.trim() ? p.brand.trim() : null,
    priceEurCents: usd === null ? null : Math.round(usd * USD_TO_EUR * 100),
    priceRaw: p.cost_usd,
    currencyRaw: "USD",
    stock: toInt(p.stock),
    stockRaw: p.stock,
    category: typeof p.category === "string" && p.category.trim() ? p.category.trim().toLowerCase() : inferCategory(text),
    description: "",
  };
}
