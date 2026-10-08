import type { Db } from '../db/pool.js';
import type { VerificationStatus } from '../domain/taxonomy.js';

export interface Candidate {
  opportunity_id: string;
  organisation_id: string;
  organisation_name: string;
  category: string;
  locality: string;
  city: string;
  verification_status: VerificationStatus;
  is_demo: boolean;
  title: string;
  activity: string;
  skills: string[];
  beneficiaries: string[];
  assistance_types: string[];
  languages: string[];
  days: string[];
  times_of_day: string[];
  min_minutes: number;
  max_minutes: number;
  min_age: number | null;
  physical_requirement: string | null;
  background_check: boolean;
  money_required: boolean;
  distance_km: number;
  /** Organisation coordinates (public, needed for the map and directions). */
  org_lat: number;
  org_lng: number;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm: number;
  /** Demo mode sees only fictional rows; real mode never sees them. */
  demo: boolean;
  includeUnverified?: boolean;
  limit?: number;
}

const CANDIDATE_COLUMNS = `
  o.id AS opportunity_id, org.id AS organisation_id, org.name AS organisation_name, org.category,
  org.locality, org.city, org.verification_status, org.is_demo,
  o.title, o.activity, o.skills, o.beneficiaries, o.assistance_types, o.languages, o.days, o.times_of_day,
  o.min_minutes, o.max_minutes, o.min_age, o.physical_requirement, o.background_check, o.money_required,
  ST_Y(org.location::geometry) AS org_lat, ST_X(org.location::geometry) AS org_lng`;

/**
 * Geospatial filtering and distance happen in PostGIS (ST_DWithin on geography
 * uses the GIST index; ST_Distance returns metres on the spheroid).
 */
export async function findNearby(db: Db, q: NearbyQuery): Promise<Candidate[]> {
  const { rows } = await db.query(
    `WITH me AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
     SELECT ${CANDIDATE_COLUMNS},
            ROUND((ST_Distance(org.location, me.g) / 1000.0)::numeric, 2)::float8 AS distance_km
       FROM volunteer_opportunities o
       JOIN organisations org ON org.id = o.organisation_id
       CROSS JOIN me
      WHERE o.active
        AND ST_DWithin(org.location, me.g, $3 * 1000.0)
        AND ($4::boolean OR org.verification_status = 'VERIFIED')
        AND org.is_demo = $6
      ORDER BY distance_km ASC
      LIMIT $5`,
    [q.lng, q.lat, q.radiusKm, q.includeUnverified ?? false, q.limit ?? 50, q.demo],
  );
  return rows as Candidate[];
}

export async function getOpportunity(db: Db, id: string, from?: { lat: number; lng: number }): Promise<Candidate | null> {
  const { rows } = await db.query(
    `SELECT ${CANDIDATE_COLUMNS},
            CASE WHEN $2::float8 IS NULL THEN NULL ELSE
              ROUND((ST_Distance(org.location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography) / 1000.0)::numeric, 2)::float8
            END AS distance_km
       FROM volunteer_opportunities o
       JOIN organisations org ON org.id = o.organisation_id
      WHERE o.id = $1 AND o.active`,
    [id, from?.lat ?? null, from?.lng ?? null],
  );
  return (rows[0] as Candidate | undefined) ?? null;
}

export interface OpportunityContact {
  address_text: string;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  safeguarding_notes: string;
  description: string;
}

/** Contact details are only released for VERIFIED organisations (or clearly-labelled demo rows). */
export async function getContact(db: Db, opportunityId: string): Promise<OpportunityContact | null> {
  const { rows } = await db.query(
    `SELECT org.address_text, org.contact_phone, org.contact_email, org.website, org.safeguarding_notes, org.description
       FROM volunteer_opportunities o JOIN organisations org ON org.id = o.organisation_id
      WHERE o.id = $1 AND o.active AND org.verification_status = 'VERIFIED'`,
    [opportunityId],
  );
  return (rows[0] as OpportunityContact | undefined) ?? null;
}
