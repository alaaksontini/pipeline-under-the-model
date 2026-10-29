import type { AnswerItem, QueryPlan } from "../types";

/** Boundary where a language model would live. The default implementation is
 *  a deterministic heuristic; a real LLM adapter is env-gated and optional.
 *  Extractors only ever see validated, structured rows — never raw text. */
export interface Extractor {
  readonly name: string;
  /** Parse a free-text question into a structured plan. */
  parsePlan(question: string): QueryPlan;
  /** Turn retrieved rows into cited answer items. */
  extract(rows: AnswerItem[]): AnswerItem[];
}
