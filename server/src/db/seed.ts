import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { loadConfig } from '../config.js';
import { ASSISTANCE_TYPES, BENEFICIARIES, SKILLS } from '../domain/taxonomy.js';
import { DEMO_ORGANISATIONS } from './demoData.js';
import { createPool } from './pool.js';

const label = (code: string) => code.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Seeds the lookup vocabularies and (re)creates the fictional demo dataset.
 * Only rows with is_demo = true are ever deleted; real organisations are untouched.
 */
export async function seed(pool: pg.Pool): Promise<{ organisations: number; opportunities: number }> {
  const client = await pool.connect();
  let orgs = 0;
  let opps = 0;
  try {
    await client.query('BEGIN');
    for (const [table, codes] of [
      ['skills', SKILLS],
      ['assistance_types', ASSISTANCE_TYPES],
      ['beneficiary_types', BENEFICIARIES],
    ] as const) {
      for (const code of codes) {
        await client.query(`INSERT INTO ${table} (code, label) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [
          code,
          label(code),
        ]);
      }
    }

    await client.query('DELETE FROM organisations WHERE is_demo = TRUE');
    for (const [i, o] of DEMO_ORGANISATIONS.entries()) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO organisations
           (name, category, description, address_text, locality, city, pincode, location,
            contact_phone, contact_email, safeguarding_notes, verification_status, verified_at,
            verification_note, is_demo)
         VALUES ($1, $2, $3, $4, $5, 'Mumbai', NULL, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
                 $8, $9, $10, $11::verification_status, CASE WHEN $11::verification_status = 'VERIFIED' THEN now() END, $12, TRUE)
         RETURNING id`,
        [
          o.name,
          o.category,
          o.description,
          `Fictional address, ${o.locality}`,
          o.locality,
          o.lng,
          o.lat,
          `+91 555 010 ${String(i).padStart(4, '0')}`,
          `demo-${i}@example.org`,
          o.safeguarding_notes,
          o.verification_status,
          'Demo data: fictional organisation, not a real verification.',
        ],
      );
      orgs++;
      for (const p of o.opportunities) {
        await client.query(
          `INSERT INTO volunteer_opportunities
             (organisation_id, title, activity, skills, beneficiaries, assistance_types, languages,
              days, times_of_day, min_minutes, max_minutes, min_age, eligibility, physical_requirement,
              background_check)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            rows[0]!.id,
            p.title,
            p.activity,
            p.skills,
            p.beneficiaries,
            p.assistance_types,
            p.languages,
            p.days,
            p.times_of_day,
            p.min_minutes,
            p.max_minutes,
            p.min_age ?? null,
            p.eligibility ?? [],
            p.physical_requirement ?? null,
            p.background_check ?? false,
          ],
        );
        opps++;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { organisations: orgs, opportunities: opps };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(loadConfig());
  seed(pool)
    .then((r) => console.log(`Seeded demo dataset: ${r.organisations} fictional organisations, ${r.opportunities} opportunities`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
