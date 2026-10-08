import type { AIProvider, ChatMessage, GenerateOptions } from '../src/ai/provider.js';
import { AIUnavailableError } from '../src/ai/provider.js';

/** Scriptable stand-in for Gemma in unit tests. Records every prompt it receives. */
export class FakeAI implements AIProvider {
  readonly name = 'fake';
  readonly model = 'fake-gemma';
  calls: { messages: ChatMessage[]; opts?: GenerateOptions }[] = [];
  constructor(private readonly reply: (messages: ChatMessage[]) => string | Error) {}
  async generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string> {
    this.calls.push({ messages, opts });
    const r = this.reply(messages);
    if (r instanceof Error) throw r;
    return r;
  }
  async health() {
    return { ok: true };
  }
}

export const unavailableAI = () => new FakeAI(() => new AIUnavailableError('down'));

export const intentJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    is_volunteering_request: true,
    availability: { day: null, time_of_day: null },
    duration_minutes: null,
    skills: [],
    beneficiaries: [],
    assistance_types: [],
    max_distance_km: null,
    monetary_donation_preference: 'unspecified',
    languages: [],
    constraints: [],
    ...over,
  });
