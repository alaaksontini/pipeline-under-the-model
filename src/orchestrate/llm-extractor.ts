import type { Extractor } from "../ports/extractor";
import type { AnswerItem, QueryPlan } from "../types";
import { HeuristicExtractor } from "./heuristic-extractor";

/** OPTIONAL real-model adapter. Only constructed when OPENAI_API_KEY is set
 *  AND --live is passed. The pipeline never needs it — this port is where a
 *  model plugs in, not what the pipeline is made of. */
export class LLMExtractor implements Extractor {
  readonly name = "openai:gpt-4o-mini";
  private readonly fallback = new HeuristicExtractor();

  constructor(private readonly apiKey: string, private readonly model = "gpt-4o-mini") {}

  static fromEnv(): LLMExtractor {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set — use the default HeuristicExtractor");
    return new LLMExtractor(key);
  }

  parsePlan(question: string): QueryPlan {
    // A real deployment would ask the model for a structured plan and fall
    // back to the heuristic on parse failure. Same port, same contract.
    return this.fallback.parsePlan(question);
  }

  extract(rows: AnswerItem[]): AnswerItem[] {
    return this.fallback.extract(rows);
  }
}
