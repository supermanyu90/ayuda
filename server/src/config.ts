import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgres://ayuda:ayuda_local@localhost:5433/ayuda'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),

  GEMMA_PROVIDER: z.enum(['ollama', 'openai', 'off']).default('ollama'),
  GEMMA_BASE_URL: z.string().default('http://localhost:11434'),
  GEMMA_MODEL: z.string().default('gemma3:4b'),
  GEMMA_API_KEY: z.string().default(''),
  GEMMA_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  ELEVENLABS_API_KEY: z.string().default(''),
  ELEVENLABS_STT_MODEL: z.string().default('scribe_v1'),
  ELEVENLABS_TTS_MODEL: z.string().default('eleven_flash_v2_5'),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvAqDcQVLR'),

  NOMINATIM_URL: z.string().default('https://nominatim.openstreetmap.org'),
  GEOCODER_USER_AGENT: z.string().default('Ayuda/0.1 (volunteering app)'),
  // ISO country codes to restrict manual search to (comma-separated); empty = worldwide.
  GEOCODER_COUNTRY_CODES: z.string().default('in'),

  ADMIN_TOKEN: z.string().default(''),
});

export type Config = z.infer<typeof EnvSchema> & { allowedOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  if (parsed.NODE_ENV === 'production' && parsed.ADMIN_TOKEN.length < 24) {
    // Admin routes stay disabled rather than running with a weak token.
    console.warn('[config] ADMIN_TOKEN missing or shorter than 24 chars: admin routes disabled');
  }
  return {
    ...parsed,
    allowedOrigins: parsed.FRONTEND_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
