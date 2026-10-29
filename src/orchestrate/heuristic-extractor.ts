import type { Extractor } from "../ports/extractor";
import type { AnswerItem, QueryPlan } from "../types";

const BRANDS = ["nordal", "kestra", "vermona", "deltree", "oskar"];

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/standing|sit.?stand|stand.?up|lift/i, "standing desk"],
  [/chair|seat/i, "desk chair"],
  [/monitor|screen|arm/i, "monitor arm"],
  [/lamp|light/i, "desk lamp"],
  [/shelf|shelv|book|rack/i, "bookshelf"],
  [/cabinet|filing|drawer|pedestal/i, "filing cabinet"],
];

/** The default Extractor — deterministic, offline, zero keys. Handles
 *  templated questions only; it exists to demonstrate the harness, not NLP.
 *  On validated data, "extraction" is trivial because the hard work already
 *  happened upstream. */
export class HeuristicExtractor implements Extractor {
  readonly name = "heuristic";

  parsePlan(question: string): QueryPlan {
    const q = question.toLowerCase();
    const priceMatch = q.match(/(?:under|below|less than|up to|max|at most|cheaper than)\s*[€$]?\s*([\d.,]+)/)
      ?? q.match(/[€$]\s*([\d.,]+)/) ?? q.match(/([\d.,]+)\s*(?:eur|euros?|usd|dollars?)/);
    let maxPriceEurCents: number | null = null;
    if (priceMatch) {
      const n = Number(priceMatch[1].replace(",", "."));
      if (Number.isFinite(n)) maxPriceEurCents = Math.round(n * 100);
    }
    let category: string | null = null;
    for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(q)) { category = cat; break; }
    const brand = BRANDS.find((b) => new RegExp(`\\b${b}\\b`, "i").test(q)) ?? null;
    return {
      category,
      maxPriceEurCents,
      brand: brand ? brand[0].toUpperCase() + brand.slice(1) : null,
    };
  }

  extract(rows: AnswerItem[]): AnswerItem[] {
    return rows;
  }
}
