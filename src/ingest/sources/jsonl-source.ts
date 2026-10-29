import { readFileSync } from "node:fs";
import type { SourceRecord } from "./csv-source";

/** supplier-c: JSONL with inconsistent keys per line. */
export function* readJsonlSource(path: string): Generator<SourceRecord> {
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    let payload: unknown;
    try {
      payload = JSON.parse(lines[i]);
    } catch {
      payload = { _unparseable_line: lines[i] };
    }
    const p = payload as Record<string, unknown>;
    yield { sourceRecordId: typeof p.id === "string" ? p.id : `c-${i}`, payload };
  }
}
