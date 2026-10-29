import type { ProductDraft, Rejection } from "../types";
import { CATEGORIES } from "../util/text";

const MAX_PRICE_EUR_CENTS = 5_000_000; // €50,000 — office furniture sanity cap

/** Business rules on top of field requirements — the stuff a schema alone
 *  won't catch. */
export function ruleRejections(d: ProductDraft): Rejection[] {
  const out: Rejection[] = [];
  if (d.priceEurCents !== null && d.priceEurCents > MAX_PRICE_EUR_CENTS)
    out.push({ rule: "price_sanity", field: "price", expected: `<= €${MAX_PRICE_EUR_CENTS / 100}`, got: d.priceRaw });
  if (d.stock !== null && d.stock < 0)
    out.push({ rule: "stock_sanity", field: "stock", expected: ">= 0", got: d.stockRaw });
  if (d.category !== null && !(CATEGORIES as readonly string[]).includes(d.category))
    out.push({ rule: "category_known", field: "category", expected: CATEGORIES.join(" | "), got: d.category });
  return out;
}
