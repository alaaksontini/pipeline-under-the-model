import { describe, expect, it } from "vitest";
import { mapSupplierA } from "../src/normalize/supplier-a";
import { mapSupplierB } from "../src/normalize/supplier-b";
import { mapSupplierC } from "../src/normalize/supplier-c";
import { runIngest } from "../src/ingest/ingest";
import { runNormalize } from "../src/normalize/normalize";
import { RAW_DIR, stack } from "./fixtures/helpers";

describe("normalize", () => {
  it("supplier-a: converts USD prices to EUR cents", () => {
    const d = mapSupplierA(1, { item_name: "X Desk", brand: "Nordal", category: "standing desk", cost_usd: "108.00", stock: "5", tags: "a;b" });
    expect(d.priceEurCents).toBe(10000);
    expect(d.currencyRaw).toBe("USD");
  });

  it("supplier-b: parses European decimal-comma strings and strips HTML", () => {
    const d = mapSupplierB(1, {
      id: "b-1",
      product: { title: "Y Lamp", maker: "Kestra" },
      pricing: { amount: "€383,64", currency: "EUR", unit: "units" },
      desc_html: "<p>LED <b>desk lamp</b>, dimmable.</p>",
      inventory: { count: 7 },
    });
    expect(d.priceEurCents).toBe(38364);
    expect(d.description).toBe("LED desk lamp, dimmable.");
    expect(d.category).toBe("desk lamp");
  });

  it("supplier-b: unit=cents divides correctly; unknown unit leaves null for validation", () => {
    const cents = mapSupplierB(1, {
      product: { title: "Z", maker: "Oskar" },
      pricing: { amount: 24999, unit: "cents" },
      inventory: { count: 1 },
    });
    expect(cents.priceEurCents).toBe(24999);
    const weird = mapSupplierB(1, {
      product: { title: "Z", maker: "Oskar" },
      pricing: { amount: "10,00", unit: "dollars" },
      inventory: { count: 1 },
    });
    expect(weird.priceEurCents).toBeNull();
  });

  it("supplier-c: handles key variants for the same concepts", () => {
    const a = mapSupplierC(1, { name: "A", price_eur: 100, qty: 2, vendor: "Nordal", cat: "desk lamp" });
    const b = mapSupplierC(2, { title: "A", cost: "EUR 100.00", quantity: 2, brand: "Nordal", category_text: "desk lamp" });
    const c = mapSupplierC(3, { name: "A", price: 100, stock: 2, vendor: "Nordal", category: "desk lamp" });
    for (const d of [a, b, c]) {
      expect(d.name).toBe("A");
      expect(d.priceEurCents).toBe(10000);
      expect(d.stock).toBe(2);
      expect(d.brand).toBe("Nordal");
      expect(d.category).toBe("desk lamp");
    }
  });

  it("produces one draft per raw record", () => {
    const { db } = stack();
    runIngest(db, RAW_DIR);
    expect(runNormalize(db)).toBe(120);
    const n = (db.prepare("SELECT COUNT(*) n FROM drafts").get() as { n: number }).n;
    expect(n).toBe(120);
  });
});
