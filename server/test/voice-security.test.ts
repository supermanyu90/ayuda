import { describe, expect, it, vi } from 'vitest';
import { SummaryStore } from '../src/ai/summaryStore.js';
import { FakeAI } from './helpers.js';
import { approximate } from '../src/geo/location.js';
import { ElevenLabsVoice } from '../src/voice/elevenlabs.js';
import { NoVoiceProvider, VoiceUnavailableError } from '../src/voice/provider.js';

const opts = { apiKey: 'k', sttModel: 'scribe_v1', ttsModel: 'flash', voiceId: 'v' };

describe('ElevenLabs voice provider', () => {
  it('sends the key only as a server-side header and returns the transcript', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>)['xi-api-key']).toBe('k');
      return new Response(JSON.stringify({ text: ' hello ', language_code: 'en' }), { status: 200 });
    });
    const v = new ElevenLabsVoice({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await v.transcribe(Buffer.from('x'), 'audio/webm')).toEqual({ text: 'hello', language: 'en' });
  });

  it('maps upstream failures to VoiceUnavailableError without leaking the body', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"detail":"account secret info"}', { status: 401 }));
    const v = new ElevenLabsVoice({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(v.synthesizeStream('hi')).rejects.toThrow(new VoiceUnavailableError('ElevenLabs HTTP 401'));
  });

  it('network errors are VoiceUnavailableError', async () => {
    const v = new ElevenLabsVoice({ ...opts, fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch });
    await expect(v.transcribe(Buffer.from('x'), 'audio/webm')).rejects.toBeInstanceOf(VoiceUnavailableError);
  });

  it('without an API key the app runs with NoVoiceProvider', async () => {
    const v = new NoVoiceProvider();
    expect(v.configured).toBe(false);
    await expect(v.transcribe()).rejects.toBeInstanceOf(VoiceUnavailableError);
  });
});

describe('summary store', () => {
  const facts = [{ organisation: 'A', title: 'T', distance_km: 1, minutes: '60-120', reasons: [], demo: true }];
  it('computes once and shares the result', async () => {
    const ai = new FakeAI(() => JSON.stringify({ summary: 'T at A is close by.' }));
    const store = new SummaryStore();
    const id = store.create(facts);
    const [a, b] = await Promise.all([store.get(id, ai), store.get(id, ai)]);
    expect(a).toEqual(b);
    expect(ai.calls).toHaveLength(1);
  });
  it('returns presets without calling the model, and null for unknown or expired ids', async () => {
    const ai = new FakeAI(() => new Error('no'));
    const store = new SummaryStore(0);
    const id = store.create([], { summary: 'x', source: 'fallback_rules' });
    await new Promise((r) => setTimeout(r, 2));
    expect(store.get(id, ai)).toBeNull();
    expect(new SummaryStore().get('nope', ai)).toBeNull();
    const live = new SummaryStore();
    expect(await live.get(live.create([], { summary: 'x', source: 'fallback_rules' }), ai)).toEqual({ summary: 'x', source: 'fallback_rules' });
    expect(ai.calls).toHaveLength(0);
  });
});

describe('location privacy', () => {
  it('rounds coordinates to ~110 m', () => {
    expect(approximate({ lat: 19.0596123, lng: 72.8295987 })).toEqual({ lat: 19.06, lng: 72.83 });
  });
});
