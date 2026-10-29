/** A raw record as it arrived from a source. `payload` is untouched source data. */
export interface RawRecord {
  id: number;
  sourceId: string;
  sourceRecordId: string;
  contentHash: string;
  payload: unknown;
}

/** Best-effort canonical shape produced by a per-source normalizer.
 *  Nulls are allowed here — validation is what decides whether the record
 *  is usable. `*Raw` fields keep the original value for rejection reasons. */
export interface ProductDraft {
  rawId: number;
  sourceId: string;
  sourceRecordId: string;
  name: string | null;
  nameRaw: unknown;
  brand: string | null;
  priceEurCents: number | null;
  priceRaw: unknown;
  currencyRaw: unknown;
  stock: number | null;
  stockRaw: unknown;
  category: string | null;
  description: string | null;
}

export interface Product {
  id: string;
  dedupeKey: string;
  clusterId: string | null;
  canonical: boolean;
  sourceId: string;
  name: string;
  brand: string;
  priceEurCents: number;
  stock: number;
  category: string;
  description: string;
}

export interface Rejection {
  rule: string;
  field: string;
  expected: string;
  got: unknown;
}

export interface StageCounts {
  ingested: number;
  skipped: number;
  perSource: Record<string, number>;
}

export interface Answer {
  question: string;
  plan: QueryPlan;
  items: AnswerItem[];
  againstRaw: boolean;
}

export interface AnswerItem {
  ref: string;
  name: string;
  brand?: string;
  priceEurCents: number | null;
  score?: number;
}

export interface QueryPlan {
  category: string | null;
  maxPriceEurCents: number | null;
  brand: string | null;
}
