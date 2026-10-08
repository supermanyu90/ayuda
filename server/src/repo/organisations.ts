import type { Db } from '../db/pool.js';
import type { VerificationStatus } from '../domain/taxonomy.js';

export interface OrganisationRow {
  id: string;
  name: string;
  category: string;
  description: string;
  locality: string;
  city: string;
  verification_status: VerificationStatus;
  verification_note: string | null;
  is_demo: boolean;
  opportunities: number;
  created_at: string;
}

export async function listOrganisations(db: Db): Promise<OrganisationRow[]> {
  const { rows } = await db.query<OrganisationRow>(
    `SELECT org.id, org.name, org.category, org.description, org.locality, org.city, org.verification_status,
            org.verification_note, org.is_demo, org.created_at,
            (SELECT count(*)::int FROM volunteer_opportunities o WHERE o.organisation_id = org.id) AS opportunities
       FROM organisations org
      ORDER BY org.is_demo, org.verification_status, org.name`,
  );
  return rows;
}

export interface NewOrganisation {
  name: string;
  category: string;
  description: string;
  address_text: string;
  locality: string;
  city: string;
  pincode?: string | null;
  lat: number;
  lng: number;
  contact_phone?: string | null;
  contact_email?: string | null;
  website?: string | null;
  safeguarding_notes?: string;
}

/** New organisations always start UNVERIFIED; verification is a separate, explicit admin action. */
export async function createOrganisation(db: Db, o: NewOrganisation): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO organisations (name, category, description, address_text, locality, city, pincode, location,
                                contact_phone, contact_email, website, safeguarding_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7, ST_SetSRID(ST_MakePoint($8,$9),4326)::geography, $10,$11,$12,$13)
     RETURNING id`,
    [
      o.name, o.category, o.description, o.address_text, o.locality, o.city, o.pincode ?? null,
      o.lng, o.lat, o.contact_phone ?? null, o.contact_email ?? null, o.website ?? null, o.safeguarding_notes ?? '',
    ],
  );
  return rows[0]!.id;
}

export async function setVerification(db: Db, id: string, status: VerificationStatus, note: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE organisations
        SET verification_status = $2::verification_status, verification_note = $3, updated_at = now(),
            verified_at = CASE WHEN $2::verification_status = 'VERIFIED' THEN now() ELSE NULL END
      WHERE id = $1`,
    [id, status, note],
  );
  return (rowCount ?? 0) > 0;
}

export interface NewOpportunity {
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
  min_age?: number | null;
  background_check?: boolean;
  need_source: 'admin' | 'gemma_reviewed';
}

export async function createOpportunity(db: Db, orgId: string, o: NewOpportunity): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO volunteer_opportunities (organisation_id, title, activity, skills, beneficiaries, assistance_types,
            languages, days, times_of_day, min_minutes, max_minutes, min_age, background_check, need_source)
     SELECT id, $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14 FROM organisations WHERE id = $1
     RETURNING id`,
    [
      orgId, o.title, o.activity, o.skills, o.beneficiaries, o.assistance_types, o.languages, o.days,
      o.times_of_day, o.min_minutes, o.max_minutes, o.min_age ?? null, o.background_check ?? false, o.need_source,
    ],
  );
  return rows[0]?.id ?? null;
}
