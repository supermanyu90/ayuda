import { describe, expect, it } from 'vitest';
import { normaliseIntent, type VolunteerIntent } from '../src/domain/schemas.js';
import { isRelevant, rankCandidates, scoreCandidate } from '../src/matching/matcher.js';
import type { Candidate } from '../src/repo/opportunities.js';

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  opportunity_id: over.opportunity_id ?? 'o1',
  organisation_id: 'org1',
  organisation_name: 'Org',
  category: 'education_literacy',
  locality: 'Bandra',
  city: 'Mumbai',
  verification_status: 'VERIFIED',
  is_demo: true,
  title: 'Reading',
  activity: 'Read',
  skills: ['teaching', 'english'],
  beneficiaries: ['children'],
  assistance_types: ['teaching'],
  languages: ['english'],
  days: ['sunday'],
  times_of_day: ['morning'],
  min_minutes: 60,
  max_minutes: 120,
  min_age: null,
  physical_requirement: null,
  background_check: false,
  money_required: false,
  distance_km: 1,
  org_lat: 0,
  org_lng: 0,
  ...over,
});

const intent = (over: Record<string, unknown> = {}): VolunteerIntent =>
  normaliseIntent({ skills: [], beneficiaries: [], assistance_types: [], languages: [], constraints: [], ...over });

describe('deterministic matcher', () => {
  const sundayTeacher = intent({
    availability: { day: 'sunday', time_of_day: 'morning' },
    duration_minutes: 120,
    skills: ['teaching', 'english'],
    beneficiaries: ['children'],
    assistance_types: ['teaching'],
    monetary_donation_preference: 'not_requested',
  });

  it('a perfect nearby match scores highly with explainable reasons', () => {
    const e = scoreCandidate(cand({ distance_km: 0.5 }), sundayTeacher, 5);
    expect(e.score).toBeGreaterThanOrEqual(90);
    expect(e.reasons).toEqual(expect.arrayContaining(['0.5 km away', 'uses your teaching and english skills', 'helps children']));
  });

  it('closer beats further when everything else is equal', () => {
    const r = rankCandidates([cand({ opportunity_id: 'far', distance_km: 4 }), cand({ opportunity_id: 'near', distance_km: 1 })], sundayTeacher, 5);
    expect(r.matches.map((m) => m.candidate.opportunity_id)).toEqual(['near', 'far']);
  });

  it('excludes opportunities that need more time than offered, as a near miss', () => {
    const r = rankCandidates([cand({ min_minutes: 180, max_minutes: 240 })], sundayTeacher, 5);
    expect(r.matches).toHaveLength(0);
    expect(r.excluded[0]).toMatchObject({ reason: 'needs at least 180 minutes', near_miss: true });
  });

  it('excludes the wrong day and the wrong time of day', () => {
    const r = rankCandidates([cand({ opportunity_id: 'a', days: ['saturday'] }), cand({ opportunity_id: 'b', times_of_day: ['evening'] })], sundayTeacher, 5);
    expect(r.excluded.map((e) => e.reason)).toEqual(['not running on sunday', 'not running in the morning']);
  });

  it('never suggests something that requires money when the user declined to donate', () => {
    const r = rankCandidates([cand({ money_required: true })], sundayTeacher, 5);
    expect(r.matches).toHaveLength(0);
  });

  it('respects radius and a stated max distance', () => {
    expect(rankCandidates([cand({ distance_km: 6 })], sundayTeacher, 5).matches).toHaveLength(0);
    expect(rankCandidates([cand({ distance_km: 2.5 })], { ...sundayTeacher, max_distance_km: 2 }, 5).matches).toHaveLength(0);
  });

  it('filters out irrelevant beneficiaries (not a near miss)', () => {
    const r = rankCandidates([cand({ beneficiaries: ['animals'] })], sundayTeacher, 5);
    expect(r.excluded[0]).toMatchObject({ near_miss: false });
  });

  it('relevance: beneficiary preference dominates; otherwise skills/assistance overlap', () => {
    expect(isRelevant(cand(), intent({ beneficiaries: ['elderly'], skills: ['teaching'] }))).toBe(false);
    expect(isRelevant(cand(), intent({ skills: ['teaching'] }))).toBe(true);
    expect(isRelevant(cand(), intent())).toBe(true);
  });

  it('unverified organisations get a caveat and lower score', () => {
    const v = scoreCandidate(cand(), sundayTeacher, 5);
    const u = scoreCandidate(cand({ verification_status: 'PENDING' }), sundayTeacher, 5);
    expect(u.score).toBeLessThan(v.score);
    expect(u.caveats).toContain('organisation is pending, not verified');
  });

  it('language mismatch is reported as a missing requirement', () => {
    const e = scoreCandidate(cand({ languages: ['marathi'] }), { ...sundayTeacher, languages: ['english'] }, 5);
    expect(e.missing_requirements).toContain('sessions are in marathi');
  });

  it('is deterministic', () => {
    const cs = [cand({ opportunity_id: 'x' }), cand({ opportunity_id: 'y' }), cand({ opportunity_id: 'z', distance_km: 2 })];
    const a = rankCandidates(cs, sundayTeacher, 5).matches.map((m) => m.candidate.opportunity_id);
    const b = rankCandidates([...cs].reverse(), sundayTeacher, 5).matches.map((m) => m.candidate.opportunity_id);
    expect(a).toEqual(b);
  });
});
