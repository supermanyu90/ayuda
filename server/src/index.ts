import { createAIProvider } from './ai/index.js';
import { SummaryStore } from './ai/summaryStore.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { NominatimGeocoder } from './geo/geocoder.js';
import { createVoiceProvider } from './voice/index.js';

const config = loadConfig();
const db = createPool(config);
const ai = createAIProvider(config);
const voice = createVoiceProvider(config);

const app = createApp({
  config,
  db,
  ai,
  voice,
  geocoder: new NominatimGeocoder(config.NOMINATIM_URL, config.GEOCODER_USER_AGENT, config.GEOCODER_COUNTRY_CODES),
  summaries: new SummaryStore(),
});

const server = app.listen(config.PORT, () => {
  console.log(`Ayuda API on :${config.PORT} | gemma=${ai.name}:${ai.model} | voice=${voice.name}`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    server.close(() => void db.end().finally(() => process.exit(0)));
  });
}
