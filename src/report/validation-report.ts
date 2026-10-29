import type Database from "better-sqlite3";
import type { Rejection } from "../types";

/** The validation report — generated from the quarantine table, never from
 *  logs. Rejection reasons are data. */
export function buildReport(db: Database.Database): string {
  const raw = (db.prepare(`SELECT COUNT(*) n FROM raw_records`).get() as { n: number }).n;
  const perSource = db
    .prepare(`SELECT source_id, COUNT(*) n FROM raw_records GROUP BY source_id ORDER BY source_id`)
    .all() as Array<{ source_id: string; n: number }>;
  const accepted = (db.prepare(`SELECT COUNT(*) n FROM products`).get() as { n: number }).n;
  const quarantined = (db.prepare(`SELECT COUNT(*) n FROM quarantine`).get() as { n: number }).n;
  const canonical = (db.prepare(`SELECT COUNT(*) n FROM products WHERE canonical = 1`).get() as { n: number }).n;
  const clusters = (db.prepare(`SELECT COUNT(DISTINCT cluster_id) n FROM products WHERE cluster_id IS NOT NULL`).get() as { n: number }).n;

  const ruleCounts = new Map<string, number>();
  const samples = new Map<string, Array<{ ref: string; got: unknown }>>();
  const qRows = db
    .prepare(`SELECT source_record_id, reasons FROM quarantine`)
    .all() as Array<{ source_record_id: string; reasons: string }>;
  for (const q of qRows) {
    for (const r of JSON.parse(q.reasons) as Rejection[]) {
      ruleCounts.set(r.rule, (ruleCounts.get(r.rule) ?? 0) + 1);
      const arr = samples.get(r.rule) ?? [];
      if (arr.length < 3) arr.push({ ref: q.source_record_id, got: r.got });
      samples.set(r.rule, arr);
    }
  }

  const lines: string[] = [];
  lines.push(`── validation report ────────────────────────────`);
  lines.push(`raw records ingested : ${raw} (${perSource.map((s) => `${s.source_id}: ${s.n}`).join(", ")})`);
  lines.push(`accepted             : ${accepted}`);
  lines.push(`quarantined          : ${quarantined}`);
  lines.push(`dedupe clusters      : ${clusters} (canonical products: ${canonical})`);
  if (ruleCounts.size) {
    lines.push(`rejection reasons:`);
    for (const [rule, n] of [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])) {
      const eg = samples.get(rule)!.map((s) => `${s.ref} got ${JSON.stringify(s.got)}`).join("; ");
      lines.push(`  ${rule.padEnd(15)} ×${String(n).padEnd(3)} e.g. ${eg}`);
    }
  }
  return lines.join("\n");
}
