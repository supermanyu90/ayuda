import { AIUnavailableError, type AIProvider, type ChatMessage, type GenerateOptions } from './provider.js';

/**
 * Gemma 3 4B served by any OpenAI-compatible endpoint (vLLM, llama.cpp server,
 * Ollama /v1, or a hosted open-weight provider). Used for Render deployments
 * where Ollama cannot run in the web service itself.
 */
export class OpenAICompatibleGemmaProvider implements AIProvider {
  readonly name = 'openai-compatible';
  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(messages: ChatMessage[], opts: GenerateOptions = {}): Promise<string> {
    const signal = AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(opts.signal ? [opts.signal] : [])]);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: opts.temperature ?? 0,
          max_tokens: opts.maxTokens ?? 400,
          ...(opts.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
    } catch (err) {
      throw new AIUnavailableError(`Gemma endpoint unreachable: ${(err as Error).name}`);
    }
    if (!res.ok) throw new AIUnavailableError(`Gemma endpoint HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AIUnavailableError('Gemma endpoint returned no content');
    return content;
  }

  async health() {
    try {
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/models`, {
        headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(3000),
      });
      return res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` };
    } catch {
      return { ok: false, detail: 'unreachable' };
    }
  }
}
