import type Database from "better-sqlite3";
import type { Embedder } from "../ports/embedder";
import type { Extractor } from "../ports/extractor";
import type { Answer, AnswerItem, QueryPlan } from "../types";
import { cosine } from "../embed/hashing-embedder";

/** The orchestration trace — every step's output is inspectable. In
 *  production this hand-rolled runner is where LangGraph/Mastra would sit;
 *  here the control flow itself is the exhibit. */
export interface Trace {
  step: string;
  detail: string;
}

export function plan(extractor: Extractor, question: string, trace: Trace[]): QueryPlan {
  const p = extractor.parsePlan(question);
  trace.push({ step: "plan", detail: JSON.stringify(p) });
  return p;
}

export async function retrieve(
  db: Database.Database,
  embedder: Embedder,
  p: QueryPlan,
  question: string,
  trace: Trace[],
): Promise<AnswerItem[]> {
  const where = ["canonical = 1"];
  const args: unknown[] = [];
  if (p.category) { where.push("category = ?"); args.push(p.category); }
  if (p.maxPriceEurCents !== null) { where.push("price_eur_cents <= ?"); args.push(p.maxPriceEurCents); }
  if (p.brand) { where.push("brand = ?"); args.push(p.brand); }
  const rows = db
    .prepare(`SELECT id, name, brand, price_eur_cents, description FROM products WHERE ${where.join(" AND ")}`)
    .all(...args) as Array<{ id: string; name: string; brand: string; price_eur_cents: number; description: string }>;

  const qv = await embedder.embed(question);
  const scored: AnswerItem[] = [];
  for (const r of rows) {
    scored.push({
      ref: r.id, name: r.name, brand: r.brand, priceEurCents: r.price_eur_cents,
      score: cosine(qv, await embedder.embed(`${r.brand} ${r.name} ${r.description}`)),
    });
  }
  const ranked = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
  trace.push({ step: "retrieve", detail: `${ranked.length} canonical product(s) matched (of ${rows.length} candidates)` });
  return ranked;
}

/** Same steps, run against raw_records — the "--against-raw" contrast.
 *  Naive LIKE matching + naive price regex on unvalidated JSON blobs.
 *  Produces a believably wrong answer: duplicates counted, currencies
 *  unconverted, prices in cents misread as units. */
export function retrieveRaw(db: Database.Database, p: QueryPlan, trace: Trace[]): AnswerItem[] {
  const raws = db
    .prepare(`SELECT id, payload FROM raw_records`)
    .all() as Array<{ id: number; payload: string }>;
  const catTokens = (p.category ?? "").split(" ");
  const items: AnswerItem[] = [];
  for (const r of raws) {
    const text = r.payload.toLowerCase();
    if (p.category && !catTokens.every((t) => text.includes(t))) continue;
    if (p.brand && !text.includes(p.brand.toLowerCase())) continue;
    // what a naive scraper does: first number after a price-looking key,
    // treated as EUR. Catches "cost_usd" too — wrong currency, no conversion.
    const priceish = text.match(/"(?:[a-z_]*price[a-z_]*|cost[a-z_]*|amount)"\s*:\s*"?([\d]+[.,]?\d*)/);
    const naiveCents = priceish ? Math.round(Number(priceish[1].replace(",", ".")) * 100) : null;
    if (p.maxPriceEurCents !== null && naiveCents !== null && naiveCents > p.maxPriceEurCents) continue;
    let name = "???";
    try {
      const obj = JSON.parse(r.payload) as Record<string, unknown>;
      const prod = (obj.product ?? {}) as Record<string, unknown>;
      name = String(obj.name ?? obj.title ?? obj.item_name ?? prod.title ?? "???");
    } catch { /* leave name */ }
    items.push({ ref: `raw-${r.id}`, name, priceEurCents: naiveCents });
    if (items.length >= 10) break;
  }
  trace.push({ step: "retrieve(raw)", detail: `${items.length} raw blob(s) matched by LIKE + regex` });
  return items;
}

export function answer(
  extractor: Extractor,
  question: string,
  p: QueryPlan,
  items: AnswerItem[],
  againstRaw: boolean,
  trace: Trace[],
): Answer {
  const a: Answer = { question, plan: p, items: extractor.extract(items), againstRaw };
  trace.push({ step: "answer", detail: `${a.items.length} item(s) cited` });
  return a;
}

export function renderAnswer(a: Answer): string {
  const eur = (c: number | null) => (c === null ? "price unknown" : `€${(c / 100).toFixed(2)}`);
  const cat = a.plan.category
    ? a.plan.category + (a.items.length === 1 ? "" : "s")
    : "products";
  const scope = [
    cat,
    a.plan.maxPriceEurCents !== null ? `under ${eur(a.plan.maxPriceEurCents)}` : null,
    a.plan.brand ? `by ${a.plan.brand}` : null,
  ].filter(Boolean).join(" ");
  const lines = [`Found ${a.items.length} ${scope}:`];
  for (const it of a.items) {
    lines.push(`  [${it.ref}] ${it.name}${it.brand ? ` — ${it.brand}` : ""} — ${eur(it.priceEurCents)}`);
  }
  return lines.join("\n");
}
