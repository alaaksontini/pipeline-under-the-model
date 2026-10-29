import type Database from "better-sqlite3";
import type { Embedder } from "../ports/embedder";
import type { VectorStore } from "../ports/vector-store";
import { Clusters } from "./cluster";
import { exactGroups } from "./exact";
import { fuzzyGroups, _setEmbedder } from "./fuzzy";

export interface DedupeCounts {
  clusters: number;
  merged: number;
}

/** Stage 4 — DEDUPE. Exact key groups first (free, deterministic), then
 *  vector-similarity fuzzy matching. Each cluster keeps one canonical row —
 *  the record with the richest description — and demotes the rest. */
export async function runDedupe(db: Database.Database, embedder: Embedder, vec: VectorStore): Promise<DedupeCounts> {
  _setEmbedder(embedder);
  const clusters = new Clusters();
  exactGroups(db, clusters);
  await fuzzyGroups(db, vec, clusters);

  const setCluster = db.prepare(`UPDATE products SET cluster_id = ?, canonical = ? WHERE id = ?`);
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM products WHERE cluster_id IS NOT NULL`).get() as { n: number };
  let n = existing.n + 1;

  let clustersMade = 0;
  let merged = 0;
  const tx = db.transaction(() => {
    for (const members of clusters.groups().values()) {
      if (members.length < 2) continue;
      const clusterId = `cl-${String(n++).padStart(3, "0")}`;
      const ranked = db
        .prepare(`SELECT id FROM products WHERE id IN (${members.map(() => "?").join(",")})
                  ORDER BY LENGTH(description) DESC, id ASC`)
        .all(...members) as Array<{ id: string }>;
      ranked.forEach((r, i) => setCluster.run(clusterId, i === 0 ? 1 : 0, r.id));
      clustersMade++;
      merged += members.length - 1;
    }
  });
  tx();
  return { clusters: clustersMade, merged };
}
