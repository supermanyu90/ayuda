import { z } from 'zod';
import {
  ASSISTANCE_TYPES,
  BENEFICIARIES,
  DAYS,
  LANGUAGES,
  RADII_KM,
  SKILLS,
  TIMES_OF_DAY,
  VERIFICATION_STATES,
  normaliseList,
  normaliseToken,
} from './taxonomy.js';

const shortText = z.string().trim().max(120);

// ---------------------------------------------------------------------------
// Raw model output. Types are checked strictly (wrong type => reject), but
// vocabulary is checked after normalisation so "kids" can become "children".
// ---------------------------------------------------------------------------
export const RawVolunteerIntentSchema = z
  .object({
    is_volunteering_request: z.boolean().optional(),
    availability: z
      .object({
        day: z.string().max(40).nullable().optional(),
        time_of_day: z.string().max(40).nullable().optional(),
      })
      .nullable()
      .optional(),
    duration_minutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    skills: z.array(z.string().max(60)).max(20).default([]),
    beneficiaries: z.array(z.string().max(60)).max(20).default([]),
    assistance_types: z.array(z.string().max(60)).max(20).default([]),
    max_distance_km: z.number().min(0).max(500).nullable().optional(),
    monetary_donation_preference: z.string().max(40).nullable().optional(),
    languages: z.array(z.string().max(40)).max(10).default([]),
    constraints: z.array(z.string().max(160)).max(10).default([]),
  })
  .strict();

export const MONEY_PREFS = ['not_requested', 'open', 'unspecified'] as const;

export const VolunteerIntentSchema = z
  .object({
    availability: z.object({
      day: z.enum(DAYS).nullable(),
      time_of_day: z.enum(TIMES_OF_DAY).nullable(),
    }),
    duration_minutes: z.number().int().min(1).max(24 * 60).nullable(),
    skills: z.array(z.enum(SKILLS)),
    beneficiaries: z.array(z.enum(BENEFICIARIES)),
    assistance_types: z.array(z.enum(ASSISTANCE_TYPES)),
    max_distance_km: z.number().min(0.5).max(50).nullable(),
    monetary_donation_preference: z.enum(MONEY_PREFS),
    languages: z.array(z.enum(LANGUAGES)),
    constraints: z.array(shortText).max(10),
  })
  .strict();
export type VolunteerIntent = z.infer<typeof VolunteerIntentSchema>;

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  if (typeof v !== 'string') return null;
  const n = normaliseToken(v) as T;
  return allowed.includes(n) ? n : null;
}

/** Raw (already type-checked) model output -> strict, vocabulary-closed intent. */
export function normaliseIntent(raw: z.infer<typeof RawVolunteerIntentSchema>): VolunteerIntent {
  const money = oneOf(raw.monetary_donation_preference ?? '', MONEY_PREFS) ?? 'unspecified';
  const duration = raw.duration_minutes && raw.duration_minutes > 0 ? raw.duration_minutes : null;
  const dist = raw.max_distance_km && raw.max_distance_km > 0 ? Math.min(Math.max(raw.max_distance_km, 0.5), 50) : null;
  return VolunteerIntentSchema.parse({
    availability: {
      day: oneOf(raw.availability?.day, DAYS),
      time_of_day: oneOf(raw.availability?.time_of_day, TIMES_OF_DAY),
    },
    duration_minutes: duration,
    skills: normaliseList(raw.skills, SKILLS),
    beneficiaries: normaliseList(raw.beneficiaries, BENEFICIARIES),
    assistance_types: normaliseList(raw.assistance_types, ASSISTANCE_TYPES),
    max_distance_km: dist,
    monetary_donation_preference: money,
    languages: normaliseList(raw.languages, LANGUAGES),
    // Free-text constraints are shown back to the user only; strip markup.
    constraints: raw.constraints.map((c) => c.replace(/[<>`]/g, '').trim()).filter(Boolean).slice(0, 10),
  });
}

// ---------------------------------------------------------------------------
// Organisation need (extracted from an organisation's free-text description by
// Gemma, reviewed by an admin before it is trusted).
// ---------------------------------------------------------------------------
export const RawOrganisationNeedSchema = z
  .object({
    skills: z.array(z.string().max(60)).max(20).default([]),
    beneficiaries: z.array(z.string().max(60)).max(20).default([]),
    assistance_types: z.array(z.string().max(60)).max(20).default([]),
    duration: z
      .object({
        min_minutes: z.number().int().min(0).max(1440).nullable().optional(),
        max_minutes: z.number().int().min(0).max(1440).nullable().optional(),
      })
      .nullable()
      .optional(),
    languages: z.array(z.string().max(40)).max(10).default([]),
    eligibility: z.array(z.string().max(160)).max(10).default([]),
    constraints: z.array(z.string().max(160)).max(10).default([]),
  })
  .strict();

export const OrganisationNeedSchema = z
  .object({
    skills: z.array(z.enum(SKILLS)),
    beneficiaries: z.array(z.enum(BENEFICIARIES)),
    assistance_types: z.array(z.enum(ASSISTANCE_TYPES)),
    duration: z.object({ min_minutes: z.number().int().nullable(), max_minutes: z.number().int().nullable() }),
    languages: z.array(z.enum(LANGUAGES)),
    eligibility: z.array(shortText),
    constraints: z.array(shortText),
  })
  .strict();
export type OrganisationNeed = z.infer<typeof OrganisationNeedSchema>;

export function normaliseNeed(raw: z.infer<typeof RawOrganisationNeedSchema>): OrganisationNeed {
  const clean = (xs: string[]) => xs.map((c) => c.replace(/[<>`]/g, '').trim().slice(0, 120)).filter(Boolean);
  return OrganisationNeedSchema.parse({
    skills: normaliseList(raw.skills, SKILLS),
    beneficiaries: normaliseList(raw.beneficiaries, BENEFICIARIES),
    assistance_types: normaliseList(raw.assistance_types, ASSISTANCE_TYPES),
    duration: { min_minutes: raw.duration?.min_minutes ?? null, max_minutes: raw.duration?.max_minutes ?? null },
    languages: normaliseList(raw.languages, LANGUAGES),
    eligibility: clean(raw.eligibility),
    constraints: clean(raw.constraints),
  });
}

// ---------------------------------------------------------------------------
// Match explanation. Score/reasons are computed deterministically; only the
// one-paragraph summary is model-written and is grounding-checked.
// ---------------------------------------------------------------------------
export const MatchExplanationSchema = z.object({
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  caveats: z.array(z.string()),
});
export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;

// ---------------------------------------------------------------------------
// API inputs
// ---------------------------------------------------------------------------
export const LatLngSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const RadiusSchema = z.coerce
  .number()
  .refine((r) => (RADII_KM as readonly number[]).includes(r), { message: `radius must be one of ${RADII_KM.join(', ')}` });

export const UserTextSchema = z.string().trim().min(3).max(600);

export const MatchRequestSchema = z
  .object({
    text: UserTextSchema,
    location: LatLngSchema,
    radius_km: RadiusSchema.optional(),
    include_unverified: z.boolean().optional(),
    demo: z.boolean().optional(),
  })
  .strict();

export const VerificationStatusSchema = z.enum(VERIFICATION_STATES);
