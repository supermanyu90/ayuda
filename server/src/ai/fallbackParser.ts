// Deterministic keyword parser used ONLY when Gemma is unavailable or returns
// invalid output. Results are labelled source="fallback_rules" in the API and
// the UI — this is not presented as AI.

import { normaliseIntent, type VolunteerIntent } from '../domain/schemas.js';
import { DAYS, type Day } from '../domain/taxonomy.js';

const KEYWORDS: { re: RegExp; skills?: string[]; beneficiaries?: string[]; assistance?: string[] }[] = [
  { re: /\b(teach|tutor|teaching|tutoring|homework|lesson|पढ़ा|सिखा|padha|sikha)/, skills: ['teaching'], assistance: ['teaching'] },
  { re: /\benglish\b/, skills: ['english'] },
  { re: /\bmentor/, assistance: ['mentoring'] },
  { re: /\b(smart ?phones?|whatsapp|digital|video[- ]?call|स्मार्टफोन|फ़ोन|फोन|mobile)/, skills: ['digital_literacy'], assistance: ['technology_help'] },
  { re: /\b(computers?|tech|technology|coding|laptop)/, skills: ['technology'], assistance: ['technology_help'] },
  { re: /\b(accounting|accounts|bookkeeping|tax|finance|bank paperwork)/, skills: ['accounting'], assistance: ['administration'] },
  { re: /\b(cook|cooking|kitchen|meals?|food|खाना|khana)/, skills: ['cooking'], assistance: ['food_preparation'] },
  { re: /\b(garden|gardening|plant|planting|trees?)/, skills: ['gardening'], assistance: ['outdoor_work'] },
  { re: /\b(drive|driving|car)\b/, skills: ['driving'], assistance: ['transportation'] },
  { re: /\b(translat|interpret)/, skills: ['translation'] },
  { re: /\b(photo|photography|camera)/, skills: ['photography'] },
  { re: /\b(admin|paperwork|forms?|data entry)/, skills: ['administration'], assistance: ['administration'] },
  { re: /\b(talk|chat|company|companionship|visit|listen)/, skills: ['companionship'], assistance: ['companionship'] },
  { re: /\b(lift|lifting|physical|manual|clean|cleaning|clean-?up)/, skills: ['physical_work'], assistance: ['cleaning'] },
  { re: /\b(events?|organis|organiz)/, skills: ['event_support'], assistance: ['event_support'] },
  { re: /\b(children|child|kids?|students?|youth|teen|teenagers?|bachche|bacchon)|बच्च/, beneficiaries: ['children'] },
  { re: /\b(elderly|seniors?|old people|old age|aged|grandparents|buzurg)|बुज़ुर्ग|बुजुर्ग|वृद्ध/, beneficiaries: ['elderly'] },
  { re: /\b(disab|special needs|wheelchair)/, beneficiaries: ['persons_with_disabilities'] },
  { re: /\b(animals?|dogs?|cats?|pets?|shelter|strays?)|जानवर|कुत्त|बिल्ली/, beneficiaries: ['animals'], assistance: ['animal_care'] },
  { re: /\b(environment|river|beach|mangrove|nature|climate)/, beneficiaries: ['environment'], assistance: ['outdoor_work'] },
  { re: /\b(homeless|street people|shelterless)/, beneficiaries: ['homeless'] },
];

/** True when the deterministic keyword rules find any concrete way to help in the text. */
export function hasHelpSignal(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some((k) => (k.skills?.length || k.beneficiaries?.length || k.assistance?.length) && k.re.test(t));
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5,
  ek: 1, do: 2, teen: 3,
};

function parseDuration(t: string): number | null {
  if (/\bhalf an hour\b|\bhalf hour\b/.test(t)) return 30;
  const m = t.match(/\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|ek|do|teen)\s*(?:-|\s)?(hours?|hrs?|ghante?|minutes?|mins?)\b/);
  if (!m) return null;
  const n = NUMBER_WORDS[m[1]!] ?? Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(/^(min)/.test(m[2]!) ? n : n * 60);
}

function parseDay(t: string, now: Date): Day | null {
  const named = DAYS.find((d) => t.includes(d));
  if (named) return named;
  // JS getDay(): 0 = Sunday. DAYS starts at Monday.
  const idx = (d: Date) => DAYS[(d.getDay() + 6) % 7]!;
  if (/\btoday\b|\baaj\b/.test(t)) return idx(now);
  if (/\btomorrow\b|\bkal\b/.test(t)) return idx(new Date(now.getTime() + 86_400_000));
  return null;
}

export function fallbackParseIntent(text: string, now: Date = new Date()): VolunteerIntent {
  const t = text.toLowerCase();
  const skills: string[] = [];
  const beneficiaries: string[] = [];
  const assistance: string[] = [];
  for (const k of KEYWORDS) {
    if (!k.re.test(t)) continue;
    skills.push(...(k.skills ?? []));
    beneficiaries.push(...(k.beneficiaries ?? []));
    assistance.push(...(k.assistance ?? []));
  }
  const time_of_day = /\bmorning|subah\b/.test(t)
    ? 'morning'
    : /\bafternoon|dopahar\b/.test(t)
      ? 'afternoon'
      : /\bevening|tonight|night|shaam\b/.test(t)
        ? 'evening'
        : null;
  const noMoney =
    /\b(don'?t|do not|not|no|without|never|can'?t|cannot)\b[^.]{0,30}\b(donat\w*|money|pay\w*|cash|funds?)/.test(t) ||
    /\bno (money|donation)/.test(t);
  const offersMoney = !noMoney && /\b(donate|money|pay)\b/.test(t);
  const km = t.match(/\b(?:within|under|less than)\s*(\d+(?:\.\d+)?)\s*(?:km|kilomet)/);
  const languages = ['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'bengali', 'spanish'].filter((l) =>
    new RegExp(`\\b(speak|in|know|fluent)\\b[^.]{0,20}\\b${l}\\b`).test(t),
  );

  return normaliseIntent({
    availability: { day: parseDay(t, now), time_of_day },
    duration_minutes: parseDuration(t),
    skills,
    beneficiaries,
    assistance_types: assistance,
    max_distance_km: km ? Number(km[1]) : null,
    monetary_donation_preference: noMoney ? 'not_requested' : offersMoney ? 'open' : 'unspecified',
    languages,
    constraints: [],
  });
}
