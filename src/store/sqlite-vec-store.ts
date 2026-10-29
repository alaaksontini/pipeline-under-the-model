import Database from "better-sqlite3";
import { load as loadVecExtension } from "sqlite-vec";
import type { VectorStore } from "../ports/vector-store";

/** Default VectorStore: sqlite-vec, zero external services.
 *  Uses a vec0 ANN index for candidate generation, then deterministic
 *  re-rank happens in the caller (dedupe applies its own rules). Async
 *  signatures match the port — this adapter just resolves immediately. */
export class SqliteVecStore implements VectorStore {
  readonly name = "sqlite-vec";
  private readonly db: Database.Database;
  private readonly table = "product_vectors";

  constructor(path: string, readonly dimensions: number) {
    this.db = new Database(path);
    loadVecExtension(this.db);
    this.db
      .prepare(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${this.table} USING vec0(
           product_id TEXT PRIMARY KEY,
           embedding float[${dimensions}]
         )`,
      )
      .run();
  }

  async upsert(id: string, vector: Float32Array): Promise<void> {
    this.db
      .prepare(`INSERT OR REPLACE INTO ${this.table}(product_id, embedding) VALUES (?, ?)`)
      .run(id, Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength));
  }

  async knn(vector: Float32Array, k: number): Promise<Array<{ id: string; score: number }>> {
    const rows = this.db
      .prepare(
        `SELECT product_id AS id, distance
         FROM ${this.table}
         WHERE embedding MATCH ? AND k = ?
         ORDER BY distance`,
      )
      .all(Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength), k) as Array<{
      id: string;
      distance: number;
    }>;
    // vec0 returns L2 distance on normalized vectors; convert to cosine
    // similarity: cos = 1 - d²/2 for unit vectors.
    return rows.map((r) => ({ id: r.id, score: 1 - (r.distance * r.distance) / 2 }));
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${this.table} WHERE product_id = ?`).run(id);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
