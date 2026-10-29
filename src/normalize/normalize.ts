import type Database from "better-sqlite3";
import type { ProductDraft } from "../types";
import { mapSupplierA } from "./supplier-a";
import { mapSupplierB } from "./supplier-b";
import { mapSupplierC } from "./supplier-c";

type Mapper = (rawId: number, payload: Record<string, unknown>) => ProductDraft;
const MAPPERS: Record<string, Mapper> = {
  "supplier-a": mapSupplierA,
  "supplier-b": mapSupplierB,
  "supplier-c": mapSupplierC,
};

/** Stage 2 — NORMALIZE. Every pending raw record is mapped to the canonical
 *  ProductDraft shape and stored as a draft. Normalizers are best-effort:
 *  they never reject, they produce fields or nulls — judgment is the next
 *  stage's job. */
export function runNormalize(db: Database.Database): number {
  const pending = db
    .prepare(
      `SELECT r.id, r.source_id, r.source_record_id, r.payload
       FROM raw_records r
       WHERE NOT EXISTS (SELECT 1 FROM drafts d WHERE d.raw_id = r.id)`,
    )
    .all() as Array<{ id: number; source_id: string; source_record_id: string; payload: string }>;

  const insert = db.prepare(
    `INSERT INTO drafts (raw_id, source_id, payload, status) VALUES (?, ?, ?, 'pending')`,
  );
  const tx = db.transaction(() => {
    for (const row of pending) {
      const draft = MAPPERS[row.source_id](row.id, JSON.parse(row.payload));
      draft.sourceRecordId = row.source_record_id;
      insert.run(row.id, row.source_id, JSON.stringify(draft));
    }
  });
  tx();
  return pending.length;
}
