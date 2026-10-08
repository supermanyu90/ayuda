// Provider-agnostic interface for the open-weight model. Business logic only
// depends on this, so swapping Ollama for MLX, vLLM, llama.cpp or a
// LoRA-fine-tuned Gemma checkpoint is a configuration change, not a rewrite.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  /** JSON Schema hint. Providers that support constrained decoding use it; others rely on the prompt. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Returns the raw model text. Callers must validate it; it is never trusted. */
  generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

/** Used when GEMMA_PROVIDER=off: always unavailable, so callers fall back deterministically. */
export class DisabledProvider implements AIProvider {
  readonly name = 'disabled';
  readonly model = 'none';
  async generate(): Promise<string> {
    throw new AIUnavailableError('Gemma is disabled (GEMMA_PROVIDER=off)');
  }
  async health() {
    return { ok: false, detail: 'disabled' };
  }
}
