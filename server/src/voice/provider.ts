// Voice is transport only: it converts audio <-> text and contains no business logic.

export interface SpeechToText {
  transcribe(audio: Buffer, mimeType: string): Promise<{ text: string; language: string | null }>;
}

export interface TextToSpeech {
  /** Streams MP3 audio so playback can start on the first chunk. */
  synthesizeStream(text: string): Promise<ReadableStream<Uint8Array>>;
}

export interface VoiceProvider extends SpeechToText, TextToSpeech {
  readonly name: string;
  readonly configured: boolean;
}

export class VoiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoiceUnavailableError';
  }
}

/** Used when no ElevenLabs key is configured. The UI falls back to text input/output. */
export class NoVoiceProvider implements VoiceProvider {
  readonly name = 'none';
  readonly configured = false;
  async transcribe(): Promise<never> {
    throw new VoiceUnavailableError('Voice is not configured (ELEVENLABS_API_KEY missing)');
  }
  async synthesizeStream(): Promise<never> {
    throw new VoiceUnavailableError('Voice is not configured (ELEVENLABS_API_KEY missing)');
  }
}
