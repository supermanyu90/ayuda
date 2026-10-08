import { describe, expect, it, vi } from 'vitest';
import { SpeechSigner } from '../src/middleware/security.js';
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
    await expect(v.synthesize('hi')).rejects.toThrow(new VoiceUnavailableError('ElevenLabs HTTP 401'));
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

describe('speech tokens', () => {
  const s = new SpeechSigner(Buffer.alloc(32, 1), 1000);
  it('verifies server-issued text only', () => {
    const t = s.sign('hello', 0);
    expect(s.verify('hello', t, 500)).toBe(true);
    expect(s.verify('hello!', t, 500)).toBe(false);
  });
  it('expires', () => expect(s.verify('hello', s.sign('hello', 0), 2000)).toBe(false));
  it('rejects garbage', () => expect(s.verify('hello', 'nope')).toBe(false));
});

describe('location privacy', () => {
  it('rounds coordinates to ~110 m', () => {
    expect(approximate({ lat: 19.0596123, lng: 72.8295987 })).toEqual({ lat: 19.06, lng: 72.83 });
  });
});
