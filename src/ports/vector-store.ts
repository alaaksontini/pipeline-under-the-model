/** Boundary where the vector database lives. Default: sqlite-vec, zero
 *  external services. Optional: pgvector (store/pg-vector-store.ts). */
export interface VectorStore {
  readonly name: string;
  readonly dimensions: number;
  upsert(id: string, vector: Float32Array): Promise<void>;
  /** Return the k nearest ids with their similarity score in [0, 1]. */
  knn(vector: Float32Array, k: number): Promise<Array<{ id: string; score: number }>>;
  delete(id: string): Promise<void>;
  close(): Promise<void>;
}
