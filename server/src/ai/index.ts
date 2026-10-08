import type { Config } from '../config.js';
import { OllamaGemmaProvider } from './gemmaOllama.js';
import { OpenAICompatibleGemmaProvider } from './gemmaOpenAI.js';
import { DisabledProvider, type AIProvider } from './provider.js';

export function createAIProvider(config: Config): AIProvider {
  switch (config.GEMMA_PROVIDER) {
    case 'ollama':
      return new OllamaGemmaProvider(config.GEMMA_BASE_URL, config.GEMMA_MODEL, config.GEMMA_TIMEOUT_MS);
    case 'openai':
      return new OpenAICompatibleGemmaProvider(config.GEMMA_BASE_URL, config.GEMMA_MODEL, config.GEMMA_API_KEY, config.GEMMA_TIMEOUT_MS);
    case 'off':
      return new DisabledProvider();
  }
}
