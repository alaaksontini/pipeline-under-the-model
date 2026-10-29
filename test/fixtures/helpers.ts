import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../../src/store/db";
import { SqliteVecStore } from "../../src/store/sqlite-vec-store";
import { HashingEmbedder } from "../../src/embed/hashing-embedder";
import { runIngest } from "../../src/ingest/ingest";
import { runNormalize } from "../../src/normalize/normalize";
import { runValidate } from "../../src/validate/validate";
import { runDedupe } from "../../src/dedupe/dedupe";
import { HeuristicExtractor } from "../../src/orchestrate/heuristic-extractor";

export const RAW_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");
export const DIMS = 256;

export function stack() {
  const db = openDb(":memory:");
  const embedder = new HashingEmbedder(DIMS);
  const vec = new SqliteVecStore(":memory:", DIMS);
  const extractor = new HeuristicExtractor();
  return { db, embedder, vec, extractor };
}

export async function runPipeline() {
  const s = stack();
  runIngest(s.db, RAW_DIR);
  runNormalize(s.db);
  await runValidate(s.db, s.embedder, s.vec);
  await runDedupe(s.db, s.embedder, s.vec);
  return s;
}
