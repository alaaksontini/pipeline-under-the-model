import { readFileSync } from "node:fs";

export interface SourceRecord {
  sourceRecordId: string;
  payload: unknown;
}

/** supplier-a: flat CSV. No csv library — the feed has no quoted commas,
 *  which is itself part of the demo's "messy but parseable" story. */
export function* readCsvSource(path: string): Generator<SourceRecord> {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",");
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    header.forEach((h, j) => (row[h] = cells[j] ?? ""));
    yield { sourceRecordId: `a-${i}`, payload: row };
  }
}
