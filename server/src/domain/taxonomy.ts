// Closed vocabularies. Everything the model emits is normalised onto these
// lists; anything outside them is dropped, never stored.

export const BENEFICIARIES = [
  'elderly',
  'children',
  'persons_with_disabilities',
  'animals',
  'environment',
  'homeless',
  'general_community',
] as const;

export const SKILLS = [
  'teaching',
  'english',
  'digital_literacy',
  'technology',
  'accounting',
  'cooking',
  'gardening',
  'driving',
  'translation',
  'photography',
  'administration',
  'companionship',
  'physical_work',
  'event_support',
] as const;

export const ASSISTANCE_TYPES = [
  'teaching',
  'mentoring',
  'companionship',
  'food_preparation',
  'cleaning',
  'technology_help',
  'transportation',
  'administration',
  'outdoor_work',
  'event_support',
  'animal_care',
] as const;

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'] as const;
export const LANGUAGES = ['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'bengali', 'spanish'] as const;
export const CATEGORIES = [
  'elderly_care',
  'child_support',
  'disability_support',
  'animal_shelter',
  'community_kitchen',
  'education_literacy',
  'environment',
  'community_service',
] as const;
export const VERIFICATION_STATES = ['VERIFIED', 'PENDING', 'UNVERIFIED'] as const;
export const RADII_KM = [1, 3, 5, 10, 25] as const;
export const DEFAULT_RADIUS_KM = 5;

export type Beneficiary = (typeof BENEFICIARIES)[number];
export type Skill = (typeof SKILLS)[number];
export type AssistanceType = (typeof ASSISTANCE_TYPES)[number];
export type Day = (typeof DAYS)[number];
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];
export type Language = (typeof LANGUAGES)[number];
export type Category = (typeof CATEGORIES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATES)[number];

// Common synonyms the model (or the fallback parser) may produce.
const SYNONYMS: Record<string, string> = {
  kids: 'children',
  child: 'children',
  youth: 'children',
  students: 'children',
  seniors: 'elderly',
  senior_citizens: 'elderly',
  old_people: 'elderly',
  elders: 'elderly',
  disabled: 'persons_with_disabilities',
  disability: 'persons_with_disabilities',
  pets: 'animals',
  dogs: 'animals',
  cats: 'animals',
  nature: 'environment',
  homeless_people: 'homeless',
  community: 'general_community',
  tutoring: 'teaching',
  tutor: 'teaching',
  education: 'teaching',
  smartphones: 'digital_literacy',
  smartphone_help: 'digital_literacy',
  computers: 'technology',
  tech: 'technology',
  it: 'technology',
  bookkeeping: 'accounting',
  finance: 'accounting',
  cook: 'cooking',
  food: 'food_preparation',
  cooking_meals: 'food_preparation',
  serving_food: 'food_preparation',
  translating: 'translation',
  interpreter: 'translation',
  admin: 'administration',
  paperwork: 'administration',
  manual_labour: 'physical_work',
  manual_labor: 'physical_work',
  lifting: 'physical_work',
  events: 'event_support',
  tech_support: 'technology_help',
  driving_help: 'transportation',
  cleanup: 'cleaning',
  tree_planting: 'outdoor_work',
  planting: 'outdoor_work',
  walking_dogs: 'animal_care',
  pet_care: 'animal_care',
  en: 'english',
  hi: 'hindi',
  mr: 'marathi',
};

export function normaliseToken(raw: string): string {
  const t = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_');
  return SYNONYMS[t] ?? t;
}

/** Keep only values in `allowed`, normalising synonyms; de-duplicated, order preserved. */
export function normaliseList<T extends string>(values: readonly unknown[], allowed: readonly T[]): T[] {
  const out: T[] = [];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const n = normaliseToken(v) as T;
    if (allowed.includes(n) && !out.includes(n)) out.push(n);
  }
  return out;
}
