import { createHash } from "node:crypto";
import type { Embedder } from "../ports/embedder";

/** Deterministic local embedder: hashed bag of word unigrams + bigrams
 *  ("feature hashing"), L2-normalized. No API key, no model download,
 *  byte-identical vectors on every run.
 *
 *  Honest label: this is a teaching stand-in, not semantic search. It
 *  captures token overlap, which is all the seeded demo data needs.
 *  Swap in a real model by implementing the Embedder port. */
export class HashingEmbedder implements Embedder {
  readonly name = "hashing-embedder";

  constructor(readonly dimensions: number = 256) {}

  async embed(text: string): Promise<Float32Array> {
    const v = new Float32Array(this.dimensions);
    const tokens = tokenize(text);
    const features = [...tokens, ...bigrams(tokens)];
    for (const f of features) {
      const { bucket, sign } = hashToBucket(f, this.dimensions);
      v[bucket] += sign;
    }
    normalize(v);
    return v;
  }
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    // keep model numbers: "3", "140cm" are exactly what dedupe needs to
    // distinguish variants of the same product line.
    .filter((t) => t.length > 1 || /\d/.test(t));
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) out.push(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}

function hashToBucket(feature: string, dims: number): { bucket: number; sign: number } {
  const h = createHash("sha256").update(feature).digest();
  return { bucket: h.readUInt32BE(0) % dims, sign: h[4] % 2 === 0 ? 1 : -1 };
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
