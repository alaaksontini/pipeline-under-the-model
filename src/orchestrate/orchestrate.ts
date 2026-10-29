import type Database from "better-sqlite3";
import type { Embedder } from "../ports/embedder";
import type { Extractor } from "../ports/extractor";
import type { Answer } from "../types";
import { answer, plan, retrieve, retrieveRaw, type Trace } from "./steps";

/** Stage 5 — ORCHESTRATE. plan → retrieve → extract → answer, over the
 *  validated product set — or, with --against-raw, over raw blobs to show
 *  what the same agent does without the pipeline. */
export async function orchestrate(
  db: Database.Database,
  embedder: Embedder,
  extractor: Extractor,
  question: string,
  againstRaw = false,
): Promise<{ answer: Answer; trace: Trace[] }> {
  const trace: Trace[] = [];
  const p = plan(extractor, question, trace);
  const items = againstRaw
    ? retrieveRaw(db, p, trace)
    : await retrieve(db, embedder, p, question, trace);
  const a = answer(extractor, question, p, items, againstRaw, trace);
  return { answer: a, trace };
}
