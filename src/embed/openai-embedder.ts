import type { Embedder } from "../ports/embedder";

/** OPTIONAL real-model adapter. Never constructed unless OPENAI_API_KEY is
 *  set — the default demo path is the deterministic HashingEmbedder. */
export class OpenAIEmbedder implements Embedder {
  readonly name = "openai:text-embedding-3-small";

  constructor(
    private readonly apiKey: string,
    readonly dimensions: number = 1536,
    private readonly model = "text-embedding-3-small",
  ) {}

  static fromEnv(): OpenAIEmbedder {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set — use the default HashingEmbedder instead");
    return new OpenAIEmbedder(key);
  }

  async embed(text: string): Promise<Float32Array> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: text, dimensions: this.dimensions }),
    });
    if (!res.ok) throw new Error(`embeddings request failed: ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return Float32Array.from(json.data[0].embedding);
  }
}
