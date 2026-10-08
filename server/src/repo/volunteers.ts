import type { Db } from '../db/pool.js';

export async function createProfile(db: Db, tokenHash: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('INSERT INTO volunteer_profiles (token_hash) VALUES ($1) RETURNING id', [tokenHash]);
  return rows[0]!.id;
}

export async function findProfile(db: Db, tokenHash: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>('SELECT id FROM volunteer_profiles WHERE token_hash = $1', [tokenHash]);
  return rows[0]?.id ?? null;
}

export async function deleteProfile(db: Db, profileId: string): Promise<void> {
  await db.query('DELETE FROM volunteer_profiles WHERE id = $1', [profileId]);
}

export interface VolunteerActionRow {
  id: string;
  opportunity_id: string;
  title: string;
  organisation_name: string;
  is_demo: boolean;
  status: 'committed' | 'completed' | 'cancelled';
  planned_minutes: number;
  screen_seconds: number | null;
  created_at: string;
  completed_at: string | null;
}

export async function createAction(
  db: Db,
  profileId: string,
  opportunityId: string,
  minutes: number,
  screenSeconds: number | null = null,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO volunteer_actions (profile_id, opportunity_id, planned_minutes, screen_seconds)
     SELECT $1, o.id, $3, $4 FROM volunteer_opportunities o WHERE o.id = $2 AND o.active
     RETURNING id`,
    [profileId, opportunityId, minutes, screenSeconds],
  );
  return rows[0]?.id ?? null;
}

export async function listActions(db: Db, profileId: string): Promise<VolunteerActionRow[]> {
  const { rows } = await db.query<VolunteerActionRow>(
    `SELECT a.id, a.opportunity_id, o.title, org.name AS organisation_name, org.is_demo, a.status,
            a.planned_minutes, a.screen_seconds, a.created_at, a.completed_at
       FROM volunteer_actions a
       JOIN volunteer_opportunities o ON o.id = a.opportunity_id
       JOIN organisations org ON org.id = o.organisation_id
      WHERE a.profile_id = $1
      ORDER BY a.created_at DESC
      LIMIT 100`,
    [profileId],
  );
  return rows;
}

/** Scoped by profile_id so one volunteer can never modify another's history. */
export async function updateActionStatus(db: Db, profileId: string, actionId: string, status: 'completed' | 'cancelled'): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE volunteer_actions
        SET status = $3, completed_at = CASE WHEN $3 = 'completed' THEN now() ELSE NULL END
      WHERE id = $1 AND profile_id = $2 AND status = 'committed'`,
    [actionId, profileId, status],
  );
  return (rowCount ?? 0) > 0;
}
