import { readFileSync } from "node:fs";
import type { SourceRecord } from "./csv-source";

/** supplier-b: JSON array, nested product/pricing structure. */
export function* readJsonSource(path: string): Generator<SourceRecord> {
  const rows = JSON.parse(readFileSync(path, "utf8")) as Array<Record<string, unknown>>;
  for (let i = 0; i < rows.length; i++) {
    const rid: unknown = rows[i].id;
    yield { sourceRecordId: typeof rid === "string" ? rid : `b-${i}`, payload: rows[i] };
  }
}
