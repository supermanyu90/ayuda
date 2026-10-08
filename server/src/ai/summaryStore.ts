import { randomUUID } from 'node:crypto';
import type { AIProvider } from './provider.js';
import { summariseMatches, type ExplanationFact, type SummaryResult } from './services.js';

/**
 * Holds the verified facts behind each search for a few minutes so the summary
 * (Gemma) and its speech (ElevenLabs) can be fetched after the results are
 * already on screen. Ids are random and only ever refer to server-built facts,
 * so the speech endpoint cannot be used to voice arbitrary text.
 */
export class SummaryStore {
  private readonly entries = new Map<string, { at: number; facts: ExplanationFact[]; result?: Promise<SummaryResult> }>();

  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly max = 2000,
  ) {}

  /** `preset` skips the model (e.g. the "not understood" message). */
  create(facts: ExplanationFact[], preset?: SummaryResult): string {
    this.prune();
    const id = randomUUID();
    this.entries.set(id, { at: Date.now(), facts, result: preset ? Promise.resolve(preset) : undefined });
    return id;
  }

  /** Computes the summary once (concurrent callers share the same promise); null if unknown or expired. */
  get(id: string, ai: AIProvider): Promise<SummaryResult> | null {
    const e = this.entries.get(id);
    if (!e || Date.now() - e.at > this.ttlMs) return null;
    e.result ??= summariseMatches(ai, e.facts);
    return e.result;
  }

  private prune() {
    const now = Date.now();
    for (const [id, e] of this.entries) if (now - e.at > this.ttlMs) this.entries.delete(id);
    while (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value!);
  }
}
