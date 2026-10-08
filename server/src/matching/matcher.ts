import type { MatchExplanation, VolunteerIntent } from '../domain/schemas.js';
import type { Candidate } from '../repo/opportunities.js';

export interface ScoredCandidate {
  candidate: Candidate;
  explanation: MatchExplanation;
}

export interface Exclusion {
  opportunity_id: string;
  title: string;
  organisation_name: string;
  distance_km: number;
  reason: string;
  /** True if it matches what the user asked for but failed a practical constraint (time, day...). */
  near_miss: boolean;
}

export interface MatchResult {
  matches: ScoredCandidate[];
  excluded: Exclusion[];
}

const pretty = (s: string) => s.replace(/_/g, ' ');
const overlap = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x));

/** Weights sum to 100. Kept here so the scoring is explainable and testable. */
export const WEIGHTS = {
  distance: 25,
  availability: 20,
  skills: 20,
  beneficiary: 15,
  assistance: 10,
  language: 5,
  verification: 5,
} as const;

/**
 * Does the candidate match what the user asked for? A stated beneficiary is the
 * strongest preference; otherwise any skill or assistance-type overlap counts.
 */
export function isRelevant(c: Candidate, intent: VolunteerIntent): boolean {
  if (intent.beneficiaries.length) return overlap(intent.beneficiaries, c.beneficiaries).length > 0;
  if (intent.skills.length || intent.assistance_types.length) {
    return overlap(intent.skills, c.skills).length > 0 || overlap(intent.assistance_types, c.assistance_types).length > 0;
  }
  return true;
}

/** Returns a reason the candidate cannot work at all, or null. */
function hardExclusion(c: Candidate, intent: VolunteerIntent, radiusKm: number): string | null {
  if (c.money_required && intent.monetary_donation_preference === 'not_requested') return 'requires a monetary contribution';
  if (c.distance_km > radiusKm) return 'outside the search radius';
  if (intent.max_distance_km !== null && c.distance_km > intent.max_distance_km) return 'further than you want to travel';
  if (intent.duration_minutes !== null && intent.duration_minutes < c.min_minutes) {
    return `needs at least ${c.min_minutes} minutes`;
  }
  if (intent.availability.day && c.days.length > 0 && !c.days.includes(intent.availability.day)) {
    return `not running on ${intent.availability.day}`;
  }
  if (intent.availability.time_of_day && c.times_of_day.length > 0 && !c.times_of_day.includes(intent.availability.time_of_day)) {
    return `not running in the ${intent.availability.time_of_day}`;
  }
  return null;
}

export function scoreCandidate(c: Candidate, intent: VolunteerIntent, radiusKm: number): MatchExplanation {
  const reasons: string[] = [];
  const missing: string[] = [];
  const caveats: string[] = [];
  let score = 0;

  // Distance: linear decay across the search radius.
  const distanceFactor = Math.max(0, 1 - c.distance_km / Math.max(radiusKm, 0.1));
  score += WEIGHTS.distance * distanceFactor;
  reasons.push(`${c.distance_km.toFixed(1)} km away`);

  // Availability: exact match on a stated preference scores full; unstated scores half.
  const { day, time_of_day } = intent.availability;
  const half = WEIGHTS.availability / 2;
  score += day ? half : half / 2;
  score += time_of_day ? half : half / 2;
  if (day || time_of_day) reasons.push(`runs ${[day, time_of_day].filter(Boolean).join(' ')}`);
  if (intent.duration_minutes !== null) {
    reasons.push(`fits your ${intent.duration_minutes} minutes (needs ${c.min_minutes}–${c.max_minutes})`);
  }

  // Skills.
  const skillHits = overlap(intent.skills, c.skills);
  if (intent.skills.length === 0) score += WEIGHTS.skills / 2;
  else score += (WEIGHTS.skills * skillHits.length) / intent.skills.length;
  if (skillHits.length) reasons.push(`uses your ${skillHits.map(pretty).join(' and ')} skills`);
  const unusedNeeded = c.skills.filter((s) => !(intent.skills as string[]).includes(s));
  if (intent.skills.length && skillHits.length === 0) missing.push(`looks for ${unusedNeeded.map(pretty).join(', ')}`);

  // Beneficiaries.
  const benHits = overlap(intent.beneficiaries, c.beneficiaries);
  if (intent.beneficiaries.length === 0) score += WEIGHTS.beneficiary / 2;
  else if (benHits.length) score += WEIGHTS.beneficiary;
  if (benHits.length) reasons.push(`helps ${benHits.map(pretty).join(' and ')}`);
  else if (intent.beneficiaries.length) missing.push(`serves ${c.beneficiaries.map(pretty).join(', ')} rather than ${intent.beneficiaries.map(pretty).join(', ')}`);

  // Assistance type.
  const asstHits = overlap(intent.assistance_types, c.assistance_types);
  if (intent.assistance_types.length === 0) score += WEIGHTS.assistance / 2;
  else if (asstHits.length) score += WEIGHTS.assistance;

  // Language.
  if (c.languages.length === 0 || intent.languages.length === 0) score += WEIGHTS.language / 2;
  else if (overlap(intent.languages, c.languages).length) score += WEIGHTS.language;
  else missing.push(`sessions are in ${c.languages.map(pretty).join(', ')}`);

  // Verification.
  if (c.verification_status === 'VERIFIED') {
    score += WEIGHTS.verification;
  } else {
    caveats.push(`organisation is ${c.verification_status.toLowerCase()}, not verified`);
  }

  if (c.min_age) caveats.push(`minimum age ${c.min_age}`);
  if (c.background_check) caveats.push('background check needed before working with this group');
  if (c.physical_requirement) caveats.push(c.physical_requirement);
  if (c.is_demo) caveats.push('fictional demo organisation');

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    reasons,
    missing_requirements: missing,
    caveats,
  };
}

/** Deterministic: same intent + candidates always yields the same ranking. */
export function rankCandidates(candidates: Candidate[], intent: VolunteerIntent, radiusKm: number, top = 5): MatchResult {
  const excluded: MatchResult['excluded'] = [];
  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const base = { opportunity_id: c.opportunity_id, title: c.title, organisation_name: c.organisation_name, distance_km: c.distance_km };
    const relevant = isRelevant(c, intent);
    const why = hardExclusion(c, intent, radiusKm);
    if (why || !relevant) {
      excluded.push({ ...base, reason: why ?? "doesn't match what you asked for", near_miss: relevant });
      continue;
    }
    scored.push({ candidate: c, explanation: scoreCandidate(c, intent, radiusKm) });
  }
  scored.sort(
    (a, b) =>
      b.explanation.score - a.explanation.score ||
      a.candidate.distance_km - b.candidate.distance_km ||
      a.candidate.opportunity_id.localeCompare(b.candidate.opportunity_id),
  );
  return { matches: scored.slice(0, top), excluded };
}
