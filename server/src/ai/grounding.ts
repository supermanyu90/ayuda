// Lexical grounding guard for model-extracted intent. Small models fill
// constrained-decoding slots even when the request never mentioned them
// (e.g. inventing "120 minutes"). A slot is kept only if the request contains
// a word that could plausibly express it. Covers English, Hindi (Devanagari +
// romanised) and Spanish; other languages fall back to keeping skill/beneficiary
// tags while dropping unsupported scalar slots.

import type { VolunteerIntent } from '../domain/schemas.js';
import { fallbackParseIntent, hasHelpSignal } from './fallbackParser.js';

const MENTIONS = {
  day: /monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|weekend|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार|आज|कल|\baaj\b|\bkal\b|ravivar|shanivar|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\bhoy\b|ma[nñ]ana/i,
  time: /morning|afternoon|evening|night|tonight|सुबह|दोपहर|शाम|रात|subah|dopahar|shaam|\braat\b|ma[nñ]ana|tarde|noche/i,
  duration: /\d|hour|\bhrs?\b|minute|\bmins?\b|half an|घंट|मिनट|ghant|hora|minuto/i,
  distance: /\bkm\b|kilomet|mile|किमी|किलोमीटर|nearby|close by|walking distance/i,
  money: /donat|money|\bpay|cash|fund|rupee|पैस|दान|रुपय|paisa|\bdaan\b|dinero|donar/i,
};

export function groundIntent(intent: VolunteerIntent, text: string): { intent: VolunteerIntent; dropped: string[] } {
  const dropped: string[] = [];
  const out: VolunteerIntent = structuredClone(intent);
  if (out.availability.day && !MENTIONS.day.test(text)) {
    out.availability.day = null;
    dropped.push('availability.day');
  }
  if (out.availability.time_of_day && !MENTIONS.time.test(text)) {
    out.availability.time_of_day = null;
    dropped.push('availability.time_of_day');
  }
  if (out.duration_minutes !== null && !MENTIONS.duration.test(text)) {
    out.duration_minutes = null;
    dropped.push('duration_minutes');
  }
  if (out.max_distance_km !== null && !(MENTIONS.distance.test(text) && /\d/.test(text))) {
    out.max_distance_km = null;
    dropped.push('max_distance_km');
  }
  if (out.monetary_donation_preference !== 'unspecified' && !MENTIONS.money.test(text)) {
    out.monetary_donation_preference = 'unspecified';
    dropped.push('monetary_donation_preference');
  }
  return { intent: out, dropped };
}

const INJECTION = /ignore (all |any |the )?(previous|prior|above)|disregard (all|previous|the)|system prompt|you are now|developer mode|reveal (your|the) (prompt|instructions)/i;

/** An instruction aimed at the model with no concrete offer of help in it. */
export function looksLikeInjection(text: string): boolean {
  return INJECTION.test(text) && !hasHelpSignal(text);
}

/**
 * Where precise deterministic rules exist (English durations and money
 * refusals), they overrule the model: a 4B model sometimes misreads
 * "half an hour" or "I will not pay".
 */
export function crossCheckIntent(intent: VolunteerIntent, text: string, now: Date): { intent: VolunteerIntent; corrected: string[] } {
  const rules = fallbackParseIntent(text, now);
  const out: VolunteerIntent = structuredClone(intent);
  const corrected: string[] = [];
  if (rules.duration_minutes !== null && rules.duration_minutes !== out.duration_minutes) {
    out.duration_minutes = rules.duration_minutes;
    corrected.push('duration_minutes');
  }
  if (rules.monetary_donation_preference === 'not_requested' && out.monetary_donation_preference !== 'not_requested') {
    out.monetary_donation_preference = 'not_requested';
    corrected.push('monetary_donation_preference');
  }
  return { intent: out, corrected };
}
