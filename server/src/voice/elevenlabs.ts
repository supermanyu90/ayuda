import { VoiceUnavailableError, type VoiceProvider } from './provider.js';

const API = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsOptions {
  apiKey: string;
  sttModel: string;
  ttsModel: string;
  voiceId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Server-side ElevenLabs client. The API key never leaves the server, and audio
 * is streamed through memory only: nothing is written to disk or the database.
 */
export class ElevenLabsVoice implements VoiceProvider {
  readonly name = 'elevenlabs';
  readonly configured = true;
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: ElevenLabsOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<{ text: string; language: string | null }> {
    const form = new FormData();
    form.append('model_id', this.opts.sttModel);
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'request.webm');
    form.append('tag_audio_events', 'false');
    const res = await this.call(`${API}/speech-to-text`, { method: 'POST', body: form });
    const data = (await res.json()) as { text?: unknown; language_code?: unknown };
    if (typeof data.text !== 'string') throw new VoiceUnavailableError('ElevenLabs returned no transcript');
    return { text: data.text.trim(), language: typeof data.language_code === 'string' ? data.language_code : null };
  }

  async synthesizeStream(text: string): Promise<ReadableStream<Uint8Array>> {
    const res = await this.call(`${API}/text-to-speech/${encodeURIComponent(this.opts.voiceId)}/stream?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: this.opts.ttsModel }),
    });
    if (!res.body) throw new VoiceUnavailableError('ElevenLabs returned no audio');
    return res.body;
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), 'xi-api-key': this.opts.apiKey },
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000),
      });
    } catch (err) {
      throw new VoiceUnavailableError(`ElevenLabs unreachable: ${(err as Error).name}`);
    }
    if (!res.ok) {
      // Never echo the upstream body: it can contain account details.
      throw new VoiceUnavailableError(`ElevenLabs HTTP ${res.status}`);
    }
    return res;
  }
}
