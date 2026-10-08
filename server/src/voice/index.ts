import type { Config } from '../config.js';
import { ElevenLabsVoice } from './elevenlabs.js';
import { NoVoiceProvider, type VoiceProvider } from './provider.js';

export function createVoiceProvider(config: Config): VoiceProvider {
  if (!config.ELEVENLABS_API_KEY) return new NoVoiceProvider();
  return new ElevenLabsVoice({
    apiKey: config.ELEVENLABS_API_KEY,
    sttModel: config.ELEVENLABS_STT_MODEL,
    ttsModel: config.ELEVENLABS_TTS_MODEL,
    voiceId: config.ELEVENLABS_VOICE_ID,
  });
}
