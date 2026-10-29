import type Database from "better-sqlite3";
import type { Embedder } from "../ports/embedder";
import type { VectorStore } from "../ports/vector-store";
import { tokenize } from "../embed/hashing-embedder";
import type { Clusters } from "./cluster";

const JACCARD_MIN = 0.6;
const K = 12;

let embedderRef: Embedder | null = null;
export function _setEmbedder(e: Embedder) { embedderRef = e; }

/** Model numbers in a name ("140cm", "3") — the same product line at a
 *  different size is NOT a duplicate. */
function numbersIn(name: string): string {
  return (name.match(/\d+/g) ?? []).sort().join(",");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/** Fuzzy pass — the production pattern in miniature: the vector index gives
 *  RECALL (cheap ANN candidates), deterministic rules give PRECISION
 *  (same brand + category + number signature + token overlap). The model's
 *  job is to bring candidates near the surface; code decides. */
export async function fuzzyGroups(db: Database.Database, vec: VectorStore, clusters: Clusters): Promise<void> {
  if (!embedderRef) throw new Error("fuzzy dedupe needs an Embedder");
  const products = db
    .prepare(`SELECT id, brand, name, category, dedupe_key FROM products`)
    .all() as Array<{ id: string; brand: string; name: string; category: string; dedupe_key: string }>;
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const p of products) {
    const query = await embedderRef.embed(`${p.brand} ${p.name}`);
    const pTokens = new Set(tokenize(`${p.brand} ${p.name}`));
    for (const hit of await vec.knn(query, K)) {
      if (hit.id === p.id) continue;
      const other = byId.get(hit.id);
      if (!other || other.dedupe_key === p.dedupe_key) continue; // exact pass owns those
      if (other.brand !== p.brand || other.category !== p.category) continue;
      if (numbersIn(other.name) !== numbersIn(p.name)) continue;
      if (jaccard(pTokens, new Set(tokenize(`${other.brand} ${other.name}`))) < JACCARD_MIN) continue;
      clusters.union(p.id, other.id);
    }
  }
}
