import type { VectorStore } from "../ports/vector-store";

/** OPTIONAL pgvector adapter — the production-shaped VectorStore.
 *  Requires: `docker compose up -d` + `npm i pg` + DATABASE_URL set.
 *  Kept behind the port so the demo never depends on it. */
export class PgVectorStore implements VectorStore {
  readonly name = "pgvector";

  private constructor(
    private readonly client: {
      query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
      end: () => Promise<void>;
    },
    readonly dimensions: number,
  ) {}

  static async connect(databaseUrl: string, dimensions: number): Promise<PgVectorStore> {
    const { Client } = await import("pg" as string).catch(() => {
      throw new Error("pgvector adapter needs `npm i pg` and docker-compose postgres running");
    });
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(
      `CREATE TABLE IF NOT EXISTS product_vectors (
         product_id TEXT PRIMARY KEY,
         embedding vector(${dimensions})
       )`,
    );
    return new PgVectorStore(client, dimensions);
  }

  async upsert(id: string, vector: Float32Array): Promise<void> {
    const lit = `[${Array.from(vector).join(",")}]`;
    await this.client.query(
      `INSERT INTO product_vectors(product_id, embedding) VALUES ($1, $2::vector)
       ON CONFLICT (product_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [id, lit],
    );
  }

  async knn(vector: Float32Array, k: number): Promise<Array<{ id: string; score: number }>> {
    const lit = `[${Array.from(vector).join(",")}]`;
    const { rows } = await this.client.query(
      `SELECT product_id AS id, 1 - (embedding <=> $1::vector) AS score
       FROM product_vectors ORDER BY embedding <=> $1::vector LIMIT $2`,
      [lit, k],
    );
    return rows as Array<{ id: string; score: number }>;
  }

  async delete(id: string): Promise<void> {
    await this.client.query("DELETE FROM product_vectors WHERE product_id = $1", [id]);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
