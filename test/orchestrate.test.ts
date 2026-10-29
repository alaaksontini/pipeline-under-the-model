import { describe, expect, it } from "vitest";
import { HeuristicExtractor } from "../src/orchestrate/heuristic-extractor";
import { orchestrate } from "../src/orchestrate/orchestrate";
import { runPipeline } from "./fixtures/helpers";

describe("orchestrate", () => {
  it("parses templated questions into a structured plan", () => {
    const e = new HeuristicExtractor();
    expect(e.parsePlan("standing desks under €300")).toEqual({
      category: "standing desk",
      maxPriceEurCents: 30000,
      brand: null,
    });
    expect(e.parsePlan("Nordal desk lamps")).toEqual({
      category: "desk lamp",
      maxPriceEurCents: null,
      brand: "Nordal",
    });
  });

  it("answers over canonical products with cited ids", async () => {
    const s = await runPipeline();
    const { answer, trace } = await orchestrate(s.db, s.embedder, s.extractor, "standing desks under €300");
    expect(answer.items.length).toBe(4);
    for (const it of answer.items) {
      expect(it.ref).toMatch(/^p-\d+$/);
      expect(it.priceEurCents).not.toBeNull();
      expect(it.priceEurCents!).toBeLessThanOrEqual(30000);
    }
    expect(trace.map((t) => t.step)).toEqual(["plan", "retrieve", "answer"]);
  });

  it("--against-raw produces a different (worse) answer on the same question", async () => {
    const s = await runPipeline();
    const clean = await orchestrate(s.db, s.embedder, s.extractor, "standing desks under €300", false);
    const raw = await orchestrate(s.db, s.embedder, s.extractor, "standing desks under €300", true);
    expect(raw.answer.items.length).not.toBe(clean.answer.items.length);
    for (const it of raw.answer.items) expect(it.ref).toMatch(/^raw-\d+$/);
    // the naive path cites quarantined records and duplicates
    const names = raw.answer.items.map((i) => i.name);
    expect(new Set(names).size).toBeLessThan(names.length);
  });

  it("is deterministic — same question, same answer, twice", async () => {
    const s = await runPipeline();
    const a = await orchestrate(s.db, s.embedder, s.extractor, "monitor arms under €500");
    const b = await orchestrate(s.db, s.embedder, s.extractor, "monitor arms under €500");
    expect(a.answer).toEqual(b.answer);
  });
});
