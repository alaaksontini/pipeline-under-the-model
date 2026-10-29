import type { ProductDraft, Rejection } from "../types";

/** Field-level requirements, checked one by one so every rejection names
 *  the field, the expectation, and what was actually there. */
export function schemaRejections(d: ProductDraft): Rejection[] {
  const out: Rejection[] = [];
  const got = (v: unknown) => (v === undefined ? null : v);
  if (typeof d.nameRaw !== "string")
    out.push({ rule: "required_field", field: "name", expected: "string", got: got(d.nameRaw) });
  else if (!d.name || !d.name.trim())
    out.push({ rule: "required_field", field: "name", expected: "non-empty string", got: got(d.nameRaw) });

  if (d.brand === null)
    out.push({ rule: "required_field", field: "brand", expected: "non-empty string", got: got(d.brand) });

  if (d.priceEurCents === null)
    out.push({ rule: "required_field", field: "price", expected: "numeric price in an understood unit", got: got(d.priceRaw) });
  else if (d.priceEurCents <= 0)
    out.push({ rule: "required_field", field: "price", expected: "> 0", got: got(d.priceRaw) });

  if (typeof d.stockRaw !== "number" && typeof d.stockRaw !== "string")
    out.push({ rule: "required_field", field: "stock", expected: "integer", got: got(d.stockRaw) });
  else if (d.stock === null)
    out.push({ rule: "required_field", field: "stock", expected: "integer", got: got(d.stockRaw) });

  if (d.category === null)
    out.push({ rule: "required_field", field: "category", expected: "known or inferable category", got: null });

  return out;
}
