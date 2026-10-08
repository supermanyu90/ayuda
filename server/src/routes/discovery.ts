import { Router } from 'express';
import { z } from 'zod';
import { extractIntent, type ExplanationFact, type IntentResult } from '../ai/services.js';
import { DEMO_CENTRE } from '../db/demoData.js';
import { LatLngSchema, MatchRequestSchema, RadiusSchema, normaliseIntent, type VolunteerIntent } from '../domain/schemas.js';
import { DEFAULT_RADIUS_KM } from '../domain/taxonomy.js';
import { approximate } from '../geo/location.js';
import { rankCandidates, type ScoredCandidate } from '../matching/matcher.js';
import { limiter } from '../middleware/security.js';
import { findNearby, getContact, getOpportunity, type Candidate } from '../repo/opportunities.js';
import type { Deps } from '../app.js';

/** Public card shape. Contact details are deliberately not included here. */
export function toCard({ candidate: c, explanation }: ScoredCandidate) {
  return {
    opportunity_id: c.opportunity_id,
    organisation_name: c.organisation_name,
    category: c.category,
    locality: c.locality,
    title: c.title,
    activity: c.activity,
    distance_km: c.distance_km,
    minutes: { min: c.min_minutes, max: c.max_minutes },
    days: c.days,
    times_of_day: c.times_of_day,
    skills: c.skills,
    beneficiaries: c.beneficiaries,
    languages: c.languages,
    verification_status: c.verification_status,
    is_demo: c.is_demo,
    money_required: c.money_required,
    location: { lat: c.org_lat, lng: c.org_lng },
    ...explanation,
  };
}

function toFact(m: ScoredCandidate): ExplanationFact {
  return {
    organisation: m.candidate.organisation_name,
    title: m.candidate.title,
    distance_km: m.candidate.distance_km,
    minutes: `${m.candidate.min_minutes}-${m.candidate.max_minutes}`,
    reasons: m.explanation.reasons,
    demo: m.candidate.is_demo,
  };
}

export function discoveryRoutes({ db, ai, summaries }: Deps): Router {
  const r = Router();

  async function discover(intent: VolunteerIntent, where: { lat: number; lng: number }, radiusKm: number, demo: boolean, includeUnverified: boolean) {
    const candidates: Candidate[] = await findNearby(db, { ...where, radiusKm, demo, includeUnverified, limit: 50 });
    const ranked = rankCandidates(candidates, intent, radiusKm, 5);
    return { candidates: candidates.length, ranked };
  }

  // Main flow: text (typed or transcribed) + location -> Gemma intent -> PostGIS -> deterministic match.
  // The Gemma summary is fetched separately (GET /summary/:id) so results show without waiting for it.
  r.post('/match', limiter(20), async (req, res) => {
    const body = MatchRequestSchema.parse(req.body);
    const demo = body.demo === true;
    // Demo mode always uses the fixed demo centre; real mode uses the (rounded) user location.
    const where = demo ? { lat: DEMO_CENTRE.lat, lng: DEMO_CENTRE.lng } : approximate(body.location);
    const radiusKm = body.radius_km ?? DEFAULT_RADIUS_KM;

    const intentResult: IntentResult = await extractIntent(ai, body.text);
    if (!intentResult.understood) {
      const text = "I couldn't tell how you'd like to help. Try something like: 'I have an hour on Saturday and can teach English.'";
      res.json({
        demo,
        search: { radius_km: radiusKm, centre_label: demo ? DEMO_CENTRE.label : 'Your approximate location' },
        intent: intentResult,
        candidates_considered: 0,
        excluded: 0,
        matches: [],
        near_misses: [],
        summary_id: summaries.create([], { summary: text, source: 'fallback_rules', fallback_reason: 'request not understood' }),
      });
      return;
    }
    const { candidates, ranked } = await discover(intentResult.intent, where, radiusKm, demo, body.include_unverified === true);

    res.json({
      demo,
      search: { radius_km: radiusKm, centre_label: demo ? DEMO_CENTRE.label : 'Your approximate location' },
      intent: intentResult,
      candidates_considered: candidates,
      excluded: ranked.excluded.length,
      matches: ranked.matches.map(toCard),
      near_misses: ranked.excluded.filter((e) => e.near_miss).slice(0, 3),
      summary_id: summaries.create(ranked.matches.map(toFact)),
    });
  });

  // "I Have 30 Minutes": no AI needed at all.
  r.post('/match/quick', limiter(30), async (req, res) => {
    const body = z
      .object({
        location: LatLngSchema,
        radius_km: RadiusSchema.optional(),
        minutes: z.number().int().min(15).max(240).default(30),
        demo: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const demo = body.demo === true;
    const where = demo ? { lat: DEMO_CENTRE.lat, lng: DEMO_CENTRE.lng } : approximate(body.location);
    const radiusKm = body.radius_km ?? DEFAULT_RADIUS_KM;
    const intent = normaliseIntent({
      duration_minutes: body.minutes,
      skills: [],
      beneficiaries: [],
      assistance_types: [],
      languages: [],
      constraints: [],
    });
    const { candidates, ranked } = await discover(intent, where, radiusKm, demo, false);
    res.json({
      demo,
      search: { radius_km: radiusKm, centre_label: demo ? DEMO_CENTRE.label : 'Your approximate location' },
      intent: { intent, source: 'quick_filter', model: null },
      candidates_considered: candidates,
      excluded: ranked.excluded.length,
      matches: ranked.matches.map(toCard),
      near_misses: [],
    });
  });

  r.get('/summary/:id', limiter(30), async (req, res) => {
    const pending = summaries.get(z.uuid().parse(req.params.id), ai);
    if (!pending) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(await pending);
  });

  r.get('/opportunities/:id', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const q = z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }).parse(req.query);
    const from = q.lat !== undefined && q.lng !== undefined ? approximate(LatLngSchema.parse(q)) : undefined;
    const opp = await getOpportunity(db, id, from);
    if (!opp) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    // Contact only for verified organisations.
    const contact = await getContact(db, id);
    res.json({
      opportunity_id: opp.opportunity_id,
      organisation_name: opp.organisation_name,
      category: opp.category,
      locality: opp.locality,
      city: opp.city,
      title: opp.title,
      activity: opp.activity,
      distance_km: opp.distance_km,
      minutes: { min: opp.min_minutes, max: opp.max_minutes },
      days: opp.days,
      times_of_day: opp.times_of_day,
      skills: opp.skills,
      beneficiaries: opp.beneficiaries,
      languages: opp.languages,
      min_age: opp.min_age,
      physical_requirement: opp.physical_requirement,
      background_check: opp.background_check,
      money_required: opp.money_required,
      verification_status: opp.verification_status,
      is_demo: opp.is_demo,
      location: { lat: opp.org_lat, lng: opp.org_lng },
      contact,
    });
  });

  return r;
}
