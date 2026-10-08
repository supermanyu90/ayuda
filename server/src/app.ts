import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError, z } from 'zod';
import type { AIProvider } from './ai/provider.js';
import { extractIntent } from './ai/services.js';
import type { Config } from './config.js';
import { DEMO_CENTRE } from './db/demoData.js';
import type { Db } from './db/pool.js';
import { UserTextSchema } from './domain/schemas.js';
import { DEFAULT_RADIUS_KM, RADII_KM } from './domain/taxonomy.js';
import { GeocoderUnavailableError, type Geocoder } from './geo/geocoder.js';
import { SpeechSigner, limiter } from './middleware/security.js';
import { adminRoutes } from './routes/admin.js';
import { discoveryRoutes } from './routes/discovery.js';
import { voiceRoutes } from './routes/voice.js';
import { volunteerRoutes } from './routes/volunteer.js';
import { VoiceUnavailableError, type VoiceProvider } from './voice/provider.js';

export interface Deps {
  config: Config;
  db: Db;
  ai: AIProvider;
  voice: VoiceProvider;
  geocoder: Geocoder;
  speech: SpeechSigner;
}

export function createApp(deps: Deps) {
  const { config, db, ai, voice, geocoder } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render terminates TLS at one proxy hop.

  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['content-type', 'authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', limiter(120));

  app.get('/api/health', async (_req, res) => {
    const dbOk = await db.query('SELECT 1').then(() => true, () => false);
    const gemma = await ai.health();
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      database: dbOk ? 'ok' : 'unavailable',
      gemma: { provider: ai.name, model: ai.model, ...gemma },
      voice: { provider: voice.name, configured: voice.configured },
    });
  });

  // Public, non-secret capabilities so the UI can be honest about what is live.
  app.get('/api/config', async (_req, res) => {
    const gemma = await ai.health();
    res.json({
      radii_km: RADII_KM,
      default_radius_km: DEFAULT_RADIUS_KM,
      demo_centre: DEMO_CENTRE,
      gemma: { available: gemma.ok, model: ai.model, provider: ai.name },
      voice: { available: voice.configured, provider: voice.name },
    });
  });

  // Exposed separately so the UI can show the structured intent while matching runs.
  app.post('/api/intent', limiter(20), async (req, res) => {
    const { text } = z.object({ text: UserTextSchema }).strict().parse(req.body);
    res.json(await extractIntent(ai, text));
  });

  app.get('/api/geocode', limiter(30), async (req, res) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(120) }).parse(req.query);
    res.json({ places: await geocoder.search(q) });
  });

  app.use('/api', discoveryRoutes(deps));
  app.use('/api/voice', voiceRoutes(deps));
  app.use('/api/volunteer', volunteerRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_request', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
    if (err instanceof VoiceUnavailableError) {
      console.warn('[voice]', err.message); // status code only, never upstream bodies
      res.status(503).json({ error: 'voice_unavailable', message: 'Voice is unavailable right now. Please type instead.' });
      return;
    }
    if (err instanceof GeocoderUnavailableError) {
      res.status(503).json({ error: 'geocoder_unavailable', message: err.message });
      return;
    }
    const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : 500;
    if (status >= 500) console.error('[error]', (err as Error).message); // message only: no request bodies, no coordinates
    const dbDown = (err as { code?: string }).code === 'ECONNREFUSED' || /connect|timeout/i.test((err as Error).message ?? '');
    res.status(dbDown ? 503 : status).json({
      error: dbDown ? 'service_unavailable' : status >= 500 ? 'internal_error' : 'request_error',
      message: dbDown ? 'Ayuda is temporarily unavailable. Please try again shortly.' : undefined,
    });
  });

  return app;
}
