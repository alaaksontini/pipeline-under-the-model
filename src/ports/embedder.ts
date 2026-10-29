/** Boundary where embedding models live. The pipeline depends on this
 *  interface, never on a provider. Default impl is fully deterministic —
 *  see embed/hashing-embedder.ts. Async on purpose: real adapters do IO. */
export interface Embedder {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<Float32Array>;
}
