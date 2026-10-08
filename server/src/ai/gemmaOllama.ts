import { AIUnavailableError, type AIProvider, type ChatMessage, type GenerateOptions } from './provider.js';

/** Gemma 3 4B through Ollama's native API, using JSON-schema constrained decoding when a schema is given. */
export class OllamaGemmaProvider implements AIProvider {
  readonly name = 'ollama';
  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(messages: ChatMessage[], opts: GenerateOptions = {}): Promise<string> {
    const signal = AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(opts.signal ? [opts.signal] : [])]);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          keep_alive: '30m',
          ...(opts.jsonSchema ? { format: opts.jsonSchema } : {}),
          options: { temperature: opts.temperature ?? 0, num_predict: opts.maxTokens ?? 400 },
        }),
      });
    } catch (err) {
      throw new AIUnavailableError(`Gemma (Ollama) unreachable: ${(err as Error).name}`);
    }
    if (!res.ok) throw new AIUnavailableError(`Gemma (Ollama) HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: unknown } };
    if (typeof data.message?.content !== 'string') throw new AIUnavailableError('Gemma (Ollama) returned no content');
    return data.message.content;
  }

  async health() {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
      const { models = [] } = (await res.json()) as { models?: { name: string }[] };
      const present = models.some((m) => m.name === this.model || m.name === `${this.model}:latest`);
      return present ? { ok: true } : { ok: false, detail: `model ${this.model} not pulled` };
    } catch {
      return { ok: false, detail: 'unreachable' };
    }
  }
}
