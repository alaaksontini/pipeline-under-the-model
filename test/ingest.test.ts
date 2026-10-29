import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readCsvSource } from "../src/ingest/sources/csv-source";
import { runIngest } from "../src/ingest/ingest";
import { RAW_DIR, stack } from "./fixtures/helpers";

describe("ingest", () => {
  it("loads all 120 raw records with per-source counts", () => {
    const { db } = stack();
    const c = runIngest(db, RAW_DIR);
    expect(c.ingested).toBe(120);
    expect(c.perSource).toEqual({ "supplier-a": 41, "supplier-b": 30, "supplier-c": 49 });
  });

  it("is idempotent — a second run ingests nothing", () => {
    const { db } = stack();
    runIngest(db, RAW_DIR);
    const second = runIngest(db, RAW_DIR);
    expect(second.ingested).toBe(0);
    expect(second.skipped).toBe(120);
  });

  it("reads CRLF CSV without carriage returns leaking into keys or values", () => {
    const path = join(mkdtempSync(join(tmpdir(), "csv-")), "x.csv");
    writeFileSync(path, "a,b\r\n1,2\r\n");
    expect([...readCsvSource(path)]).toEqual([{ sourceRecordId: "a-1", payload: { a: "1", b: "2" } }]);
  });
});
