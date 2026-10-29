#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { parseArgs } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./store/db";
import { SqliteVecStore } from "./store/sqlite-vec-store";
import { HashingEmbedder } from "./embed/hashing-embedder";
import { runIngest } from "./ingest/ingest";
import { runNormalize } from "./normalize/normalize";
import { runValidate } from "./validate/validate";
import { runDedupe } from "./dedupe/dedupe";
import { buildReport } from "./report/validation-report";
import { orchestrate } from "./orchestrate/orchestrate";
import { HeuristicExtractor } from "./orchestrate/heuristic-extractor";
import { renderAnswer } from "./orchestrate/steps";

const here = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(here, "..", "data", "raw");
const DIMS = 256;
const DEMO_QUESTION = "standing desks under €300";

function stack(dbPath: string) {
  const db = openDb(dbPath);
  const embedder = new HashingEmbedder(DIMS);
  const vecPath = dbPath === ":memory:" ? ":memory:" : `${dbPath}.vec`;
  const vec = new SqliteVecStore(vecPath, DIMS);
  // Real adapters (OpenAIEmbedder, LLMExtractor, PgVectorStore) are opt-in
  // and env-gated; the default path is fully deterministic.
  const extractor = new HeuristicExtractor();
  return { db, embedder, vec, extractor };
}

async function pipeline(dbPath: string, rawDir = RAW_DIR) {
  const s = stack(dbPath);
  const ing = runIngest(s.db, rawDir);
  console.log(`ingest    : ${ing.ingested} new (${Object.entries(ing.perSource).map(([k, v]) => `${k}: ${v}`).join(", ")}), ${ing.skipped} skipped`);
  const n = runNormalize(s.db);
  console.log(`normalize : ${n} draft(s)`);
  const v = await runValidate(s.db, s.embedder, s.vec);
  console.log(`validate  : ${v.accepted} accepted, ${v.quarantined} quarantined`);
  const d = await runDedupe(s.db, s.embedder, s.vec);
  console.log(`dedupe    : ${d.clusters} cluster(s), ${d.merged} merged`);
  return s;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    db: { type: "string", default: "pipeline.db" },
    "against-raw": { type: "boolean", default: false },
    raw: { type: "string" },
    fresh: { type: "boolean", default: false },
  },
});
const [cmd, ...rest] = positionals;
const dbPath = values.db!;
const rawDir = values.raw ?? RAW_DIR;

if (values.fresh && existsSync(dbPath)) {
  rmSync(dbPath); rmSync(`${dbPath}.vec`, { force: true });
  rmSync(`${dbPath}-wal`, { force: true }); rmSync(`${dbPath}-shm`, { force: true });
}

switch (cmd) {
  case "ingest": {
    const s = stack(dbPath);
    const ing = runIngest(s.db, rawDir);
    console.log(`ingested ${ing.ingested} new record(s), skipped ${ing.skipped} existing`);
    break;
  }
  case "validate": {
    const s = stack(dbPath);
    runIngest(s.db, rawDir);
    console.log(`normalized ${runNormalize(s.db)} draft(s)`);
    const v = await runValidate(s.db, s.embedder, s.vec);
    const d = await runDedupe(s.db, s.embedder, s.vec);
    console.log(`validate: ${v.accepted} accepted, ${v.quarantined} quarantined | dedupe: ${d.clusters} cluster(s), ${d.merged} merged`);
    break;
  }
  case "report": {
    const s = stack(dbPath);
    console.log(buildReport(s.db));
    break;
  }
  case "ask": {
    const question = rest.join(" ") || DEMO_QUESTION;
    const s = await pipeline(dbPath, rawDir);
    const { answer: a, trace } = await orchestrate(s.db, s.embedder, s.extractor, question, values["against-raw"]);
    for (const t of trace) console.log(`  ${t.step.padEnd(14)} ${t.detail}`);
    console.log(renderAnswer(a));
    break;
  }
  case "demo": {
    const s = await pipeline(dbPath, rawDir);
    console.log();
    console.log(buildReport(s.db));
    console.log();
    console.log(`── orchestrate: "${DEMO_QUESTION}" ─────────────`);
    const clean = await orchestrate(s.db, s.embedder, s.extractor, DEMO_QUESTION, false);
    for (const t of clean.trace) console.log(`  ${t.step.padEnd(14)} ${t.detail}`);
    console.log(renderAnswer(clean.answer));
    console.log();
    console.log(`── same agent, --against-raw ──────────────────`);
    const raw = await orchestrate(s.db, s.embedder, s.extractor, DEMO_QUESTION, true);
    for (const t of raw.trace) console.log(`  ${t.step.padEnd(14)} ${t.detail}`);
    console.log(renderAnswer(raw.answer));
    console.log();
    console.log(`Same agent. Different data layer.`);
    break;
  }
  default:
    console.log(`usage:
  npm run demo                 full pipeline + Q&A + --against-raw contrast
  npm run ingest               stage 1 only
  npm run validate             normalize + validate + dedupe
  npm run report               validation report from quarantine table
  npm run ask -- "question"    orchestrated Q&A [-- --against-raw] [-- --fresh]

flags: --db <path>  --raw <dir>  --against-raw  --fresh`);
}
