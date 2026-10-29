import { describe, expect, it } from "vitest";
import { runPipeline } from "./fixtures/helpers";

describe("dedupe (golden dataset)", () => {
  it("merges exact duplicates inside supplier-c", async () => {
    const { db } = await runPipeline();
    const rows = db
      .prepare(`SELECT DISTINCT cluster_id FROM products WHERE source_id = 'supplier-c' AND cluster_id IS NOT NULL`)
      .all() as Array<{ cluster_id: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it("merges reworded cross-supplier near-duplicates via fuzzy matching", async () => {
    const { db } = await runPipeline();
    // 'FocusLite Deltree' is the supplier-c rewording of 'Deltree FocusLite'
    const reworded = db
      .prepare(`SELECT cluster_id FROM products WHERE name = 'FocusLite Deltree'`)
      .get() as { cluster_id: string };
    const original = db
      .prepare(`SELECT cluster_id FROM products WHERE name = 'Deltree FocusLite'`)
      .get() as { cluster_id: string };
    expect(reworded.cluster_id).not.toBeNull();
    expect(reworded.cluster_id).toBe(original.cluster_id);
  });

  it("does NOT merge same model line at different sizes (number signature)", async () => {
    const { db } = await runPipeline();
    const a = db.prepare(`SELECT cluster_id FROM products WHERE name LIKE 'Vermona ArchivPro 4'`).get() as { cluster_id: string | null };
    const b = db.prepare(`SELECT cluster_id FROM products WHERE name LIKE 'Vermona ArchivPro 5' AND canonical = 1`).get() as { cluster_id: string | null };
    expect(a.cluster_id === null || a.cluster_id !== b.cluster_id).toBe(true);
  });

  it("keeps exactly one canonical row per cluster", async () => {
    const { db } = await runPipeline();
    const bad = db
      .prepare(`SELECT cluster_id, SUM(canonical) c FROM products WHERE cluster_id IS NOT NULL GROUP BY cluster_id HAVING c != 1`)
      .all();
    expect(bad).toHaveLength(0);
  });
});
