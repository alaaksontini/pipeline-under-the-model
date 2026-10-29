CREATE TABLE IF NOT EXISTS raw_records (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_id, source_record_id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY,
  raw_id INTEGER NOT NULL REFERENCES raw_records(id),
  source_id TEXT NOT NULL,
  payload TEXT NOT NULL,              -- ProductDraft JSON
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','quarantined')),
  UNIQUE (raw_id)
);

CREATE TABLE IF NOT EXISTS quarantine (
  id INTEGER PRIMARY KEY,
  draft_id INTEGER NOT NULL REFERENCES drafts(id),
  source_id TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  reasons TEXT NOT NULL,              -- JSON: [{rule, field, expected, got}]
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,                -- p-001
  draft_id INTEGER NOT NULL REFERENCES drafts(id),
  dedupe_key TEXT NOT NULL,
  cluster_id TEXT,
  canonical INTEGER NOT NULL DEFAULT 1,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  price_eur_cents INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL
);
