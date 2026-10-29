import type Database from "better-sqlite3";
import type { Embedder } from "../ports/embedder";
import type { VectorStore } from "../ports/vector-store";
import type { ProductDraft, Rejection } from "../types";
import { dedupeKey } from "../util/text";
import { schemaRejections } from "./schema";
import { ruleRejections } from "./rules";

export interface ValidationCounts {
  accepted: number;
  quarantined: number;
}

/** Stage 3 — VALIDATE. Every pending draft is adjudicated: clean records
 *  become products (+ embedding), rejected records go to quarantine with
 *  structured reasons. Nothing is silently dropped — the report stage reads
 *  this table, not a log file. */
export async function runValidate(
  db: Database.Database,
  embedder: Embedder,
  vec: VectorStore,
): Promise<ValidationCounts> {
  const pending = db
    .prepare(`SELECT id, source_id, payload FROM drafts WHERE status = 'pending'`)
    .all() as Array<{ id: number; source_id: string; payload: string }>;

  const insertProduct = db.prepare(
    `INSERT INTO products (id, draft_id, dedupe_key, source_id, name, brand,
       price_eur_cents, stock, category, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertQuarantine = db.prepare(
    `INSERT INTO quarantine (draft_id, source_id, source_record_id, reasons, payload)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const setStatus = db.prepare(`UPDATE drafts SET status = ? WHERE id = ?`);
  const nextSeq = db.prepare(`SELECT COUNT(*) + 1 AS n FROM products`);

  const counts: ValidationCounts = { accepted: 0, quarantined: 0 };

  // Adjudication is sequential: product ids come from a counter and
  // embeddings are awaited — a real Embedder does IO.
  for (const row of pending) {
    const d = JSON.parse(row.payload) as ProductDraft;
    const reasons: Rejection[] = [...schemaRejections(d), ...ruleRejections(d)];
    if (reasons.length === 0) {
      const id = `p-${String((nextSeq.get() as { n: number }).n).padStart(3, "0")}`;
      db.transaction(() => {
        insertProduct.run(
          id, row.id, dedupeKey(d.brand!, d.name!), d.sourceId,
          d.name!, d.brand!, d.priceEurCents!, d.stock!, d.category!, d.description ?? "",
        );
        setStatus.run("accepted", row.id);
      })();
      // dedupe vectors are brand+name only — descriptions would dilute the
      // token overlap that fuzzy matching depends on.
      await vec.upsert(id, await embedder.embed(`${d.brand} ${d.name}`));
      counts.accepted++;
    } else {
      db.transaction(() => {
        insertQuarantine.run(row.id, d.sourceId, d.sourceRecordId, JSON.stringify(reasons), row.payload);
        setStatus.run("quarantined", row.id);
      })();
      counts.quarantined++;
    }
  }
  return counts;
}
