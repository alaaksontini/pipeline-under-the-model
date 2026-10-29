import { describe, expect, it } from "vitest";
import type { ProductDraft, Rejection } from "../src/types";
import { schemaRejections } from "../src/validate/schema";
import { ruleRejections } from "../src/validate/rules";
import { runIngest } from "../src/ingest/ingest";
import { runNormalize } from "../src/normalize/normalize";
import { runValidate } from "../src/validate/validate";
import { RAW_DIR, stack } from "./fixtures/helpers";

const base: ProductDraft = {
  rawId: 1, sourceId: "supplier-c", sourceRecordId: "c-1",
  name: "X", nameRaw: "X", brand: "Nordal",
  priceEurCents: 10000, priceRaw: 100, currencyRaw: "EUR",
  stock: 3, stockRaw: 3, category: "desk lamp", description: "",
};

describe("validation rules", () => {
  const cases: Array<[string, Partial<ProductDraft>, string]> = [
    ["missing name", { name: null, nameRaw: undefined }, "required_field"],
    ["empty name", { name: "", nameRaw: "" }, "required_field"],
    ["unparseable price", { priceEurCents: null, priceRaw: "call us" }, "required_field"],
    ["negative price", { priceEurCents: -19900, priceRaw: -199 }, "required_field"],
    ["absurd price", { priceEurCents: 9999999900, priceRaw: 99999999 }, "price_sanity"],
    ["non-integer stock", { stock: null, stockRaw: "many" }, "required_field"],
    ["negative stock", { stock: -3, stockRaw: "-3" }, "stock_sanity"],
    ["unknown category", { category: "banana" }, "category_known"],
  ];
  for (const [label, patch, rule] of cases) {
    it(`rejects ${label} via ${rule}`, () => {
      const d = { ...base, ...patch };
      const reasons: Rejection[] = [...schemaRejections(d), ...ruleRejections(d)];
      expect(reasons.map((r) => r.rule)).toContain(rule);
    });
  }

  it("accepts a well-formed draft", () => {
    expect([...schemaRejections(base), ...ruleRejections(base)]).toHaveLength(0);
  });
});

describe("validate stage (golden dataset)", () => {
  it("adjudicates all 120 drafts: 89 accepted, 31 quarantined", async () => {
    const s = stack();
    runIngest(s.db, RAW_DIR);
    runNormalize(s.db);
    const v = await runValidate(s.db, s.embedder, s.vec);
    expect(v.accepted).toBe(89);
    expect(v.quarantined).toBe(31);
    const q = s.db
      .prepare(`SELECT reasons FROM quarantine WHERE source_record_id = 'c-247'`)
      .get() as { reasons: string };
    expect(q.reasons).toContain("category_known");
  });

  it("quarantine carries structured reasons, not just counts", async () => {
    const s = stack();
    runIngest(s.db, RAW_DIR);
    runNormalize(s.db);
    await runValidate(s.db, s.embedder, s.vec);
    const rows = s.db.prepare(`SELECT reasons FROM quarantine`).all() as Array<{ reasons: string }>;
    for (const r of rows) {
      const parsed = JSON.parse(r.reasons) as Rejection[];
      expect(parsed.length).toBeGreaterThan(0);
      for (const rej of parsed) {
        expect(rej).toHaveProperty("rule");
        expect(rej).toHaveProperty("field");
        expect(rej).toHaveProperty("expected");
        expect(rej).toHaveProperty("got");
      }
    }
  });
});
