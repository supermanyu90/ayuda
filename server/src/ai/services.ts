import {
  RawOrganisationNeedSchema,
  RawVolunteerIntentSchema,
  normaliseIntent,
  normaliseNeed,
  type OrganisationNeed,
  type VolunteerIntent,
} from '../domain/schemas.js';
import { fallbackParseIntent, hasHelpSignal } from './fallbackParser.js';
import { crossCheckIntent, groundIntent, looksLikeInjection } from './grounding.js';
import {
  EXPLAIN_JSON_SCHEMA,
  EXPLAIN_SYSTEM,
  INTENT_JSON_SCHEMA,
  INTENT_SYSTEM,
  NEED_JSON_SCHEMA,
  NEED_SYSTEM,
  PROMPT_VERSION,
} from './prompts.js';
import type { AIProvider } from './provider.js';
import { cleanUntrusted, fence, parseModelJson } from './untrusted.js';

export type AISource = 'gemma' | 'fallback_rules';

export interface IntentResult {
  intent: VolunteerIntent;
  source: AISource;
  model: string | null;
  prompt_version: string;
  latency_ms: number;
  /** False when Gemma judged the text is not an offer of help (e.g. an injection attempt). */
  understood: boolean;
  /** Model-filled fields removed because the request never mentioned them. */
  dropped_fields: string[];
  /** Fields where precise deterministic rules overruled the model. */
  corrected_fields: string[];
  /** Why the fallback was used, if it was. Safe to show to the user. */
  fallback_reason?: string;
}

const EMPTY_INTENT = () => normaliseIntent({ skills: [], beneficiaries: [], assistance_types: [], languages: [], constraints: [] });

/** Nothing actionable was extracted: no skill, beneficiary, activity, time or duration. */
export function isEmptyIntent(i: VolunteerIntent): boolean {
  return (
    !i.skills.length &&
    !i.beneficiaries.length &&
    !i.assistance_types.length &&
    !i.availability.day &&
    !i.availability.time_of_day &&
    i.duration_minutes === null
  );
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function why(err: unknown): string {
  if (err instanceof SyntaxError) return 'Gemma returned malformed JSON';
  if (err instanceof Error && err.name === 'ZodError') return 'Gemma output failed schema validation';
  if (err instanceof Error && err.name === 'AIUnavailableError') return 'Gemma is unavailable';
  return 'Gemma request failed';
}

/** Gemma 3 4B intent extraction, strictly validated; deterministic fallback on any failure. */
export async function extractIntent(ai: AIProvider, text: string, now = new Date()): Promise<IntentResult> {
  const started = Date.now();
  const cleaned = cleanUntrusted(text);
  try {
    const raw = await ai.generate(
      [
        { role: 'system', content: INTENT_SYSTEM },
        // The model needs the weekday to resolve "today"/"tomorrow"; nothing else about the user.
        {
          role: 'user',
          content: `(If the request says "today" use ${DAY_NAMES[now.getDay()]}; "tomorrow" = ${DAY_NAMES[(now.getDay() + 1) % 7]}.)\n${fence('REQUEST', cleaned)}`,
        },
      ],
      { jsonSchema: INTENT_JSON_SCHEMA as unknown as Record<string, unknown>, maxTokens: 300 },
    );
    const parsed = RawVolunteerIntentSchema.parse(parseModelJson(raw));
    // A "not a volunteering request" verdict is overruled when the deterministic
    // keyword rules see a concrete offer of help (guards small-model false negatives).
    const grounded = groundIntent(normaliseIntent(parsed), cleaned);
    const checked = crossCheckIntent(grounded.intent, cleaned, now);
    const understood =
      !looksLikeInjection(cleaned) &&
      ((parsed.is_volunteering_request !== false && !isEmptyIntent(checked.intent)) || hasHelpSignal(cleaned));
    const intent = understood ? checked.intent : EMPTY_INTENT();
    return {
      intent,
      source: 'gemma',
      model: ai.model,
      prompt_version: PROMPT_VERSION,
      latency_ms: Date.now() - started,
      understood,
      dropped_fields: understood ? grounded.dropped : [],
      corrected_fields: understood ? checked.corrected : [],
    };
  } catch (err) {
    return {
      intent: fallbackParseIntent(cleaned, now),
      source: 'fallback_rules',
      model: null,
      prompt_version: PROMPT_VERSION,
      latency_ms: Date.now() - started,
      understood: !looksLikeInjection(cleaned),
      dropped_fields: [],
      corrected_fields: [],
      fallback_reason: why(err),
    };
  }
}

export interface NeedResult {
  need: OrganisationNeed | null;
  source: AISource | 'none';
  error?: string;
}

/**
 * Extracts structured needs from an organisation's (untrusted) description.
 * Output is a *suggestion* for an admin to review; it is never published automatically.
 */
export async function extractOrganisationNeed(ai: AIProvider, description: string): Promise<NeedResult> {
  try {
    const raw = await ai.generate(
      [
        { role: 'system', content: NEED_SYSTEM },
        { role: 'user', content: fence('DESCRIPTION', description, 2000) },
      ],
      { jsonSchema: NEED_JSON_SCHEMA as unknown as Record<string, unknown>, maxTokens: 300 },
    );
    return { need: normaliseNeed(RawOrganisationNeedSchema.parse(parseModelJson(raw))), source: 'gemma' };
  } catch (err) {
    return { need: null, source: 'none', error: why(err) };
  }
}

/** Facts given to the explainer. Deliberately has no coordinates and no user data. */
export interface ExplanationFact {
  organisation: string;
  title: string;
  distance_km: number;
  minutes: string;
  reasons: string[];
  demo: boolean;
}

export interface SummaryResult {
  summary: string;
  source: AISource;
  fallback_reason?: string;
}

const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

// Claims the facts can never support (we have no travel-time data).
const UNSUPPORTED_CLAIMS = /\b(drive|driving|ride|commute|bus|train|walk(?:ing)? distance|an? hour'?s?|minutes? away|hours? away)\b/i;

/** Every number the summary states must exist in the facts (numerals or number words); no travel-time claims. */
export function isGrounded(summary: string, facts: ExplanationFact[]): boolean {
  if (UNSUPPORTED_CLAIMS.test(summary)) return false;
  const factText = JSON.stringify(facts).toLowerCase();
  const allowed = new Set(factText.match(/\d+(?:\.\d+)?/g) ?? []);
  allowed.add(String(facts.length));
  const lower = summary.toLowerCase();
  const nums = [
    ...(lower.match(/\d+(?:\.\d+)?/g) ?? []),
    ...Object.entries(NUMBER_WORDS)
      .filter(([w]) => new RegExp(`\\b${w}\\b`).test(lower))
      .map(([, n]) => n),
  ];
  return nums.every((n) => allowed.has(n) || allowed.has(String(Number(n))));
}

export function templateSummary(facts: ExplanationFact[]): string {
  if (facts.length === 0) return "I couldn't find a verified opportunity that fits. Try a larger radius or a different time.";
  const top = facts[0]!;
  const many = facts.length === 1 ? 'one option' : `${facts.length} options`;
  return `I found ${many} near you. The best fit is ${top.title} at ${top.organisation}, ${top.distance_km.toFixed(1)} km away, needing ${top.minutes} minutes.`;
}

export async function summariseMatches(ai: AIProvider, facts: ExplanationFact[]): Promise<SummaryResult> {
  if (facts.length === 0) return { summary: templateSummary(facts), source: 'fallback_rules', fallback_reason: 'no matches' };
  // Only the top 3, compactly: no point paying tokens for the long tail.
  const top = facts.slice(0, 3);
  try {
    const raw = await ai.generate(
      [
        { role: 'system', content: EXPLAIN_SYSTEM },
        { role: 'user', content: `<<FACTS>>\n${JSON.stringify(top)}\n<</FACTS>>` },
      ],
      { jsonSchema: EXPLAIN_JSON_SCHEMA as unknown as Record<string, unknown>, maxTokens: 120, temperature: 0.2 },
    );
    const parsed = parseModelJson(raw) as { summary?: unknown };
    const summary = typeof parsed.summary === 'string' ? cleanUntrusted(parsed.summary, 400) : '';
    if (summary.length < 10) throw new SyntaxError('empty summary');
    if (!isGrounded(summary, top)) {
      return { summary: templateSummary(top), source: 'fallback_rules', fallback_reason: 'Gemma summary mentioned an unsupported number' };
    }
    return { summary, source: 'gemma' };
  } catch (err) {
    return { summary: templateSummary(top), source: 'fallback_rules', fallback_reason: why(err) };
  }
}
