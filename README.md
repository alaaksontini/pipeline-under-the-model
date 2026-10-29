# pipeline-under-the-model

**Most LLM features don't fail on the model — they fail on the data.**
This is a small, runnable demo of the deterministic layer underneath: ingest →
normalize → validate → dedupe → store, then a thin orchestration layer on top.

No API keys. No external services. `npm install && npm run demo` — done.

```bash
npm install
npm run demo                              # full pipeline + one agent Q&A (~5s)
npm run ask -- "standing desks under €300" -- --against-raw   # watch it fail
```

## What you're looking at

Three fake suppliers send the same office-furniture catalog in three
different formats (CSV, JSON, JSONL) with realistic defects: missing fields,
prices in the wrong currency or unit, HTML in descriptions, wrong types, and
duplicates across suppliers.

The pipeline cleans it deterministically — schemas and rules in code — and
*then* an agent answers questions on top. The `--against-raw` flag runs the
exact same agent against the unvalidated data so you can watch the
difference. Same agent. Different data layer.

On the seeded dataset: **120 raw records → 89 accepted → 54 canonical
products** after dedupe (31 quarantined, 25 duplicate clusters merged).

## Architecture

```
INGEST ──→ NORMALIZE ──→ VALIDATE ──→ DEDUPE ──→ STORE ──→ ORCHESTRATE
csv/json    per-source    field        exact +     products    plan →
/jsonl →    mappers →     rules →      vector      + vectors   retrieve →
raw_records canonical     → quarantine fuzzy                  extract →
(idempotent)              + reasons                           answer
```

The interesting boundaries are interfaces:

| Port | Default (this demo) | Production equivalent |
|---|---|---|
| `Embedder` | deterministic hashing embedder (no keys) | real embedding model |
| `Extractor` | heuristic parser (no keys) | LLM call |
| `VectorStore` | `sqlite-vec` | `pgvector` — `docker compose up -d`, `npm i pg`, `DATABASE_URL` |

That's the whole point: **the non-determinism lives behind a port, so the
pipeline is testable end-to-end without a model.**

## Honest limitations

- The default embedder is a hashed bag-of-shingles — a teaching stand-in, not
  semantic search. Swap in a real model via `Embedder`.
- The default extractor handles templated questions. It's demonstrating the
  harness, not NLP.
- The orchestrator is a hand-rolled step-runner on purpose — the control flow
  is the exhibit. In production this is where LangGraph/Mastra would sit.
- USD→EUR conversion uses a fixed demo rate. Real pipelines read rates from
  somewhere deterministic and versioned.

## Validation is data, not logs

Rejected records go to a quarantine table with structured reasons — rule,
field, expected, actual. `npm run report` prints what was rejected and why:
31 of 120 records in the seeded dataset, each with the rule that caught it.

## Tests

`npm test` — golden-dataset validation, dedupe precision on seeded clusters,
idempotent re-ingest, orchestration traces. Everything deterministic; CI runs
the same (`.github/workflows/ci.yml`).

## Why this exists

Companion to my positioning: I build the deterministic data pipelines that
make LLM features work in production — the layer under the model, built this
way in a production system that replaced paid SaaS middleware.

## Layout

```
data/seeds/generate.ts   deterministic generator for data/raw/
src/ports/               Embedder · Extractor · VectorStore interfaces
src/ingest/              csv / json / jsonl source readers → raw_records
src/normalize/           per-source mappers → canonical ProductDraft
src/validate/            field requirements + business rules → products/quarantine
src/dedupe/              exact keys + vector ANN recall + deterministic re-rank
src/orchestrate/         plan → retrieve → extract → answer (+ --against-raw)
src/store/               sqlite-vec (default) · pgvector (optional)
test/                    vitest — golden datasets, no snapshots of vibes
```
