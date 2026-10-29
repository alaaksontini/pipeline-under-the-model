import { describe, expect, it } from "vitest";
import { buildReport } from "../src/report/validation-report";
import { runPipeline } from "./fixtures/helpers";

/** Golden end-to-end: the seeded dataset must always produce the same
 *  pipeline outcome — this is the reproducibility claim, tested. */
describe("end-to-end pipeline", () => {
  it("120 raw -> 89 accepted -> 54 canonical after dedupe", async () => {
    const { db } = await runPipeline();
    const raw = (db.prepare(`SELECT COUNT(*) n FROM raw_records`).get() as { n: number }).n;
    const accepted = (db.prepare(`SELECT COUNT(*) n FROM products`).get() as { n: number }).n;
    const quarantined = (db.prepare(`SELECT COUNT(*) n FROM quarantine`).get() as { n: number }).n;
    const canonical = (db.prepare(`SELECT COUNT(*) n FROM products WHERE canonical = 1`).get() as { n: number }).n;
    const clusters = (db.prepare(`SELECT COUNT(DISTINCT cluster_id) n FROM products WHERE cluster_id IS NOT NULL`).get() as { n: number }).n;
    expect(raw).toBe(120);
    expect(accepted).toBe(89);
    expect(quarantined).toBe(31);
    expect(clusters).toBe(25);
    expect(canonical).toBe(54);
  });

  it("report is generated from tables and mentions real numbers", async () => {
    const { db } = await runPipeline();
    const report = buildReport(db);
    expect(report).toContain("120");
    expect(report).toContain("89");
    expect(report).toContain("31");
    expect(report).toContain("required_field");
  });
});
