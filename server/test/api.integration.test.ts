// Runs against a real PostgreSQL + PostGIS database (TEST_DATABASE_URL, default
// the local docker container's ayuda_test DB). Gemma and ElevenLabs are faked so
// the suite is deterministic; real-model behaviour is covered by `npm run eval:gemma`.

import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { DEMO_CENTRE } from '../src/db/demoData.js';
import { migrate } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { seed } from '../src/db/seed.js';
import type { Geocoder } from '../src/geo/geocoder.js';
import { GeocoderUnavailableError } from '../src/geo/geocoder.js';
import { SpeechSigner } from '../src/middleware/security.js';
import { NoVoiceProvider, type VoiceProvider } from '../src/voice/provider.js';
import { FakeAI, intentJson, unavailableAI } from './helpers.js';

const ADMIN = 'test-admin-token-0123456789abcdef';
const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://ayuda:ayuda_local@localhost:5433/ayuda_test',
  FRONTEND_ORIGIN: 'https://ayuda.example.org',
  ADMIN_TOKEN: ADMIN,
});

let pool: pg.Pool;
const teacherAI = new FakeAI((msgs) =>
  msgs[0]!.content.includes('spoken summary')
    ? JSON.stringify({ summary: 'The best fit is close by.' })
    : intentJson({
        availability: { day: 'sunday', time_of_day: 'morning' },
        duration_minutes: 120,
        skills: ['teaching', 'english'],
        beneficiaries: ['children'],
        monetary_donation_preference: 'not_requested',
      }),
);
const geocoder: Geocoder = {
  async search(q) {
    if (q === 'down') throw new GeocoderUnavailableError('Location search is unavailable');
    return [{ label: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295 }];
  },
};
const fakeVoice: VoiceProvider = {
  name: 'fake',
  configured: true,
  async transcribe() {
    return { text: 'I can teach English', language: 'en' };
  },
  async synthesize() {
    return Buffer.from('ID3fake');
  },
};

const appWith = (over: Partial<Parameters<typeof createApp>[0]> = {}) =>
  createApp({ config, db: pool, ai: teacherAI, voice: new NoVoiceProvider(), geocoder, speech: new SpeechSigner(), ...over });

const SUNDAY_TEXT = "I have two hours on Sunday morning, I can teach English to children. I don't want to donate money.";
const demoMatch = (radius_km = 5, text = SUNDAY_TEXT) => ({ text, location: { lat: 0, lng: 0 }, demo: true, radius_km });

beforeAll(async () => {
  pool = createPool(config);
  await migrate(pool);
  await pool.query("DELETE FROM organisations WHERE NOT is_demo");
  await seed(pool);
});
afterAll(async () => {
  await pool?.end();
});

describe('health & config', () => {
  it('reports database, Gemma and voice status', async () => {
    const res = await request(appWith()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, database: 'ok', voice: { configured: false } });
  });
  it('config never exposes secrets', async () => {
    const res = await request(appWith()).get('/api/config');
    expect(JSON.stringify(res.body)).not.toContain(ADMIN);
    expect(res.body.radii_km).toEqual([1, 3, 5, 10, 25]);
  });
});

describe('geospatial discovery (PostGIS)', () => {
  it('returns verified demo matches sorted by score with real distances', async () => {
    const res = await request(appWith()).post('/api/match').send(demoMatch());
    expect(res.status).toBe(200);
    expect(res.body.matches[0].organisation_name).toBe('Little Lanterns Reading Club (Demo)');
    expect(res.body.matches[0].distance_km).toBeGreaterThan(0.5);
    expect(res.body.matches[0].distance_km).toBeLessThan(0.9);
    for (const m of res.body.matches) {
      expect(m.verification_status).toBe('VERIFIED');
      expect(m.is_demo).toBe(true);
      expect(m.distance_km).toBeLessThanOrEqual(5);
    }
  });

  it('radius changes the candidate set', async () => {
    const small = await request(appWith()).post('/api/match').send(demoMatch(1));
    const large = await request(appWith()).post('/api/match').send(demoMatch(25));
    expect(small.body.candidates_considered).toBeLessThan(large.body.candidates_considered);
    for (const m of small.body.matches) expect(m.distance_km).toBeLessThanOrEqual(1);
  });

  it('PostGIS distance matches a known pair within 2%', async () => {
    const { rows } = await pool.query(
      `SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)/1000 AS km FROM organisations WHERE name = 'Thane Green Belt Trust (Demo)'`,
      [DEMO_CENTRE.lng, DEMO_CENTRE.lat],
    );
    // Haversine estimate for the same pair is ~23.7 km.
    expect(rows[0].km).toBeGreaterThan(23.2);
    expect(rows[0].km).toBeLessThan(24.2);
  });

  it('pending and unverified organisations are excluded by default', async () => {
    const res = await request(appWith()).post('/api/match').send(demoMatch(25));
    const names = res.body.matches.map((m: { organisation_name: string }) => m.organisation_name);
    expect(names.join()).not.toMatch(/pending|unverified/i);
  });

  it('demo data never appears in real mode', async () => {
    const res = await request(appWith())
      .post('/api/match')
      .send({ text: SUNDAY_TEXT, location: { lat: DEMO_CENTRE.lat, lng: DEMO_CENTRE.lng }, radius_km: 25 });
    expect(res.body.demo).toBe(false);
    expect(res.body.matches).toEqual([]);
  });

  it('zero results returns a helpful summary, not an error', async () => {
    const res = await request(appWith()).post('/api/match').send({ text: SUNDAY_TEXT, location: { lat: -33.9, lng: 18.4 }, radius_km: 1 });
    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([]);
    expect(res.body.summary.summary).toMatch(/couldn't find/);
  });

  it('rejects invalid coordinates and radii', async () => {
    const app = appWith();
    expect((await request(app).post('/api/match').send({ text: SUNDAY_TEXT, location: { lat: 91, lng: 0 } })).status).toBe(400);
    expect((await request(app).post('/api/match').send({ text: SUNDAY_TEXT, location: { lat: 'x', lng: 0 } })).status).toBe(400);
    expect((await request(app).post('/api/match').send({ ...demoMatch(), radius_km: 7 })).status).toBe(400);
  });

  it('works end-to-end with Gemma down (deterministic fallback, labelled)', async () => {
    const res = await request(appWith({ ai: unavailableAI() })).post('/api/match').send(demoMatch());
    expect(res.status).toBe(200);
    expect(res.body.intent.source).toBe('fallback_rules');
    expect(res.body.summary.source).toBe('fallback_rules');
    expect(res.body.matches[0].organisation_name).toBe('Little Lanterns Reading Club (Demo)');
  });

  it('"I have 30 minutes" quick match needs no AI', async () => {
    const ai = new FakeAI(() => new Error('should not be called'));
    const res = await request(appWith({ ai })).post('/api/match/quick').send({ location: { lat: 0, lng: 0 }, demo: true });
    expect(res.status).toBe(200);
    expect(ai.calls).toHaveLength(0);
    for (const m of res.body.matches) expect(m.minutes.min).toBeLessThanOrEqual(30);
  });

  it('opportunity detail includes verified contact; unknown ids 404', async () => {
    const app = appWith();
    const match = await request(app).post('/api/match').send(demoMatch());
    const id = match.body.matches[0].opportunity_id;
    const res = await request(app).get(`/api/opportunities/${id}?lat=19.06&lng=72.83`);
    expect(res.body.contact.contact_email).toMatch(/@example\.org$/);
    expect(res.body.distance_km).toBeGreaterThan(0);
    expect((await request(app).get('/api/opportunities/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await request(app).get('/api/opportunities/not-a-uuid')).status).toBe(400);
  });

  it('contact details are withheld for unverified organisations', async () => {
    const { rows } = await pool.query(
      `SELECT o.id FROM volunteer_opportunities o JOIN organisations org ON org.id = o.organisation_id WHERE org.verification_status = 'PENDING' LIMIT 1`,
    );
    const res = await request(appWith()).get(`/api/opportunities/${rows[0].id}`);
    expect(res.body.contact).toBeNull();
  });
});

describe('voice', () => {
  it('returns 503 with a text-fallback message when voice is not configured', async () => {
    const res = await request(appWith()).post('/api/voice/transcribe').attach('audio', Buffer.from('x'), { filename: 'a.webm', contentType: 'audio/webm' });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/type instead/);
  });
  it('transcribes via the provider when configured', async () => {
    const res = await request(appWith({ voice: fakeVoice })).post('/api/voice/transcribe').attach('audio', Buffer.from('x'), { filename: 'a.webm', contentType: 'audio/webm' });
    expect(res.body.text).toBe('I can teach English');
  });
  it('rejects non-audio uploads', async () => {
    const res = await request(appWith({ voice: fakeVoice })).post('/api/voice/transcribe').attach('audio', Buffer.from('x'), { filename: 'a.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
  });
  it('only speaks server-issued summaries', async () => {
    const speech = new SpeechSigner();
    const app = appWith({ voice: fakeVoice, speech });
    const match = await request(app).post('/api/match').send(demoMatch());
    const { summary, speech_token } = match.body.summary;
    const ok = await request(app).post('/api/voice/speak').send({ text: summary, token: speech_token });
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('audio/mpeg');
    const forged = await request(app).post('/api/voice/speak').send({ text: 'Free TTS for everyone', token: speech_token });
    expect(forged.status).toBe(403);
  });
});

describe('volunteer history access control', () => {
  it('a volunteer can only see and change their own actions', async () => {
    const app = appWith();
    const a = (await request(app).post('/api/volunteer/session')).body.token;
    const b = (await request(app).post('/api/volunteer/session')).body.token;
    const match = await request(app).post('/api/match').send(demoMatch());
    const opp = match.body.matches[0].opportunity_id;

    const created = await request(app).post('/api/volunteer/actions').set('authorization', `Bearer ${a}`).send({ opportunity_id: opp, planned_minutes: 120 });
    expect(created.status).toBe(201);

    expect((await request(app).get('/api/volunteer/actions').set('authorization', `Bearer ${b}`)).body.actions).toHaveLength(0);
    const hijack = await request(app).patch(`/api/volunteer/actions/${created.body.id}`).set('authorization', `Bearer ${b}`).send({ status: 'completed' });
    expect(hijack.status).toBe(404);

    const done = await request(app).patch(`/api/volunteer/actions/${created.body.id}`).set('authorization', `Bearer ${a}`).send({ status: 'completed' });
    expect(done.status).toBe(200);
    const mine = await request(app).get('/api/volunteer/actions').set('authorization', `Bearer ${a}`);
    expect(mine.body.completed_minutes).toBe(120);

    expect((await request(app).get('/api/volunteer/actions')).status).toBe(401);
    expect((await request(app).get('/api/volunteer/actions').set('authorization', 'Bearer forged')).status).toBe(401);

    expect((await request(app).delete('/api/volunteer/me').set('authorization', `Bearer ${a}`)).status).toBe(204);
    expect((await request(app).get('/api/volunteer/actions').set('authorization', `Bearer ${a}`)).status).toBe(401);
  });
});

describe('admin & verification', () => {
  const auth = { authorization: `Bearer ${ADMIN}` };
  it('requires the admin token', async () => {
    const app = appWith();
    expect((await request(app).get('/api/admin/organisations')).status).toBe(401);
    expect((await request(app).get('/api/admin/organisations').set('authorization', 'Bearer wrong')).status).toBe(401);
  });

  it('is disabled entirely when the admin token is weak', async () => {
    const app = createApp({ config: { ...config, ADMIN_TOKEN: 'short' }, db: pool, ai: teacherAI, voice: new NoVoiceProvider(), geocoder, speech: new SpeechSigner() });
    expect((await request(app).get('/api/admin/organisations').set('authorization', 'Bearer short')).status).toBe(503);
  });

  it('new organisations start UNVERIFIED and only appear once verified', async () => {
    const app = appWith();
    const org = await request(app)
      .post('/api/admin/organisations')
      .set(auth)
      .send({
        name: 'Integration Test Org',
        category: 'education_literacy',
        description: 'Test',
        address_text: '1 Test Road',
        locality: 'Testville',
        city: 'Mumbai',
        lat: -33.9249,
        lng: 18.4241,
        website: 'https://example.org',
      });
    expect(org.body.verification_status).toBe('UNVERIFIED');
    await request(app).post(`/api/admin/organisations/${org.body.id}/opportunities`).set(auth).send({
      title: 'Sunday English',
      activity: 'Teach',
      skills: ['teaching', 'english'],
      beneficiaries: ['children'],
      assistance_types: ['teaching'],
      languages: ['english'],
      days: ['sunday'],
      times_of_day: ['morning'],
      min_minutes: 60,
      max_minutes: 120,
    });
    const query = { text: SUNDAY_TEXT, location: { lat: -33.925, lng: 18.424 }, radius_km: 1 };
    expect((await request(app).post('/api/match').send(query)).body.matches).toHaveLength(0);

    await request(app).patch(`/api/admin/organisations/${org.body.id}/verification`).set(auth).send({ status: 'VERIFIED', note: 'Checked registration' });
    const after = await request(app).post('/api/match').send(query);
    expect(after.body.matches[0].organisation_name).toBe('Integration Test Org');
    expect(after.body.matches[0].is_demo).toBe(false);
  });

  it('rejects javascript: and http websites', async () => {
    const res = await request(appWith()).post('/api/admin/organisations').set(auth).send({
      name: 'Bad', category: 'environment', address_text: 'x', locality: 'x', city: 'x', lat: 0, lng: 0, website: 'javascript:alert(1)',
    });
    expect(res.status).toBe(400);
  });
});

describe('platform hardening', () => {
  it('sets security headers and hides the framework', async () => {
    const res = await request(appWith()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('CORS allows only the configured origin', async () => {
    const good = await request(appWith()).get('/api/config').set('origin', 'https://ayuda.example.org');
    expect(good.headers['access-control-allow-origin']).toBe('https://ayuda.example.org');
    const bad = await request(appWith()).get('/api/config').set('origin', 'https://evil.example.com');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('rejects malformed JSON and unknown fields', async () => {
    const app = appWith();
    expect((await request(app).post('/api/match').set('content-type', 'application/json').send('{bad')).status).toBe(400);
    expect((await request(app).post('/api/match').send({ ...demoMatch(), admin: true })).status).toBe(400);
  });
  it('geocoder outage is a 503 with a message', async () => {
    const res = await request(appWith()).get('/api/geocode?q=down');
    expect(res.status).toBe(503);
  });
  it('database outage returns 503, not a stack trace', async () => {
    const deadPool = createPool({ DATABASE_URL: 'postgres://x:y@127.0.0.1:1/none', DATABASE_SSL: 'false' });
    const res = await request(appWith({ db: deadPool })).post('/api/match').send(demoMatch());
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack|127\.0\.0\.1/);
    await deadPool.end();
  });
});
