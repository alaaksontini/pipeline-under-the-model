import { createHash } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { StageCounts } from "../types";
import { readCsvSource } from "./sources/csv-source";
import { readJsonSource } from "./sources/json-source";
import { readJsonlSource } from "./sources/jsonl-source";

const SOURCES: Record<string, { file: string; read: (p: string) => Generator<{ sourceRecordId: string; payload: unknown }> }> = {
  "supplier-a": { file: "supplier-a.csv", read: readCsvSource },
  "supplier-b": { file: "supplier-b.json", read: readJsonSource },
  "supplier-c": { file: "supplier-c.jsonl", read: readJsonlSource },
};

/** Stage 1 — INGEST. Raw records land in `raw_records` untouched, keyed by
 *  (source_id, source_record_id) with a content hash. Re-running is a no-op:
 *  ingest is idempotent by construction, not by cleanup. */
export function runIngest(db: Database.Database, rawDir: string): StageCounts {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO raw_records (source_id, source_record_id, content_hash, payload)
     VALUES (?, ?, ?, ?)`,
  );
  const counts: StageCounts = { ingested: 0, skipped: 0, perSource: {} };

  const tx = db.transaction(() => {
    for (const [sourceId, src] of Object.entries(SOURCES)) {
      let n = 0;
      for (const rec of src.read(join(rawDir, src.file))) {
        const payload = JSON.stringify(rec.payload);
        const hash = createHash("sha256").update(payload).digest("hex").slice(0, 16);
        const r = insert.run(sourceId, rec.sourceRecordId, hash, payload);
        if (r.changes === 0) counts.skipped++;
        else { counts.ingested++; n++; }
      }
      counts.perSource[sourceId] = (counts.perSource[sourceId] ?? 0) + n;
    }
  });
  tx();
  return counts;
}
