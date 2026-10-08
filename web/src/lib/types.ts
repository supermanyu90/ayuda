export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'UNVERIFIED';

export interface VolunteerIntent {
  availability: { day: string | null; time_of_day: string | null };
  duration_minutes: number | null;
  skills: string[];
  beneficiaries: string[];
  assistance_types: string[];
  max_distance_km: number | null;
  monetary_donation_preference: 'not_requested' | 'open' | 'unspecified';
  languages: string[];
  constraints: string[];
}

export interface IntentResult {
  intent: VolunteerIntent;
  source: 'gemma' | 'fallback_rules' | 'quick_filter';
  model: string | null;
  latency_ms?: number;
  understood?: boolean;
  dropped_fields?: string[];
  corrected_fields?: string[];
  fallback_reason?: string;
}

export interface MatchCard {
  opportunity_id: string;
  organisation_name: string;
  category: string;
  locality: string;
  title: string;
  activity: string;
  distance_km: number;
  minutes: { min: number; max: number };
  days: string[];
  times_of_day: string[];
  skills: string[];
  beneficiaries: string[];
  languages: string[];
  verification_status: VerificationStatus;
  is_demo: boolean;
  money_required: boolean;
  location: { lat: number; lng: number };
  score: number;
  reasons: string[];
  missing_requirements: string[];
  caveats: string[];
}

export interface NearMiss {
  opportunity_id: string;
  title: string;
  organisation_name: string;
  distance_km: number;
  reason: string;
}

export interface MatchResponse {
  demo: boolean;
  search: { radius_km: number; centre_label: string };
  intent: IntentResult;
  candidates_considered: number;
  excluded: number;
  matches: MatchCard[];
  near_misses: NearMiss[];
  /** Fetch with api.summary(); absent for the quick "30 minutes" search. */
  summary_id?: string;
}

export interface Summary {
  summary: string;
  source: 'gemma' | 'fallback_rules';
  fallback_reason?: string;
}

export interface OpportunityDetail extends Omit<MatchCard, 'score' | 'reasons' | 'missing_requirements' | 'caveats' | 'distance_km'> {
  city: string;
  distance_km: number | null;
  min_age: number | null;
  physical_requirement: string | null;
  background_check: boolean;
  contact: {
    address_text: string;
    contact_phone: string | null;
    contact_email: string | null;
    website: string | null;
    safeguarding_notes: string;
    description: string;
  } | null;
}

export interface PublicConfig {
  radii_km: number[];
  default_radius_km: number;
  demo_centre: { lat: number; lng: number; label: string };
  gemma: { available: boolean; model: string; provider: string };
  voice: { available: boolean; provider: string };
}

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface VolunteerAction {
  id: string;
  opportunity_id: string;
  title: string;
  organisation_name: string;
  is_demo: boolean;
  status: 'committed' | 'completed' | 'cancelled';
  planned_minutes: number;
  created_at: string;
  completed_at: string | null;
}
