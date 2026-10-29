import type Database from "better-sqlite3";
import type { Clusters } from "./cluster";

/** Exact pass: identical normalized (brand|name) keys are merged without
 *  needing vectors at all — supplier-c's verbatim duplicates land here. */
export function exactGroups(db: Database.Database, clusters: Clusters): void {
  const rows = db
    .prepare(`SELECT id, dedupe_key FROM products GROUP BY dedupe_key HAVING COUNT(*) > 1`)
    .all() as Array<{ id: string; dedupe_key: string }>;
  for (const r of rows) {
    const members = db
      .prepare(`SELECT id FROM products WHERE dedupe_key = ? ORDER BY id`)
      .all(r.dedupe_key) as Array<{ id: string }>;
    for (const m of members) clusters.union(r.id, m.id);
  }
}
