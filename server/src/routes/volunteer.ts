import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { hashToken, limiter, newVolunteerToken, volunteerToken } from '../middleware/security.js';
import { createAction, createProfile, deleteProfile, findProfile, listActions, updateActionStatus } from '../repo/volunteers.js';
import type { Deps } from '../app.js';

export function volunteerRoutes({ db }: Deps): Router {
  const r = Router();

  async function profileOf(req: Request, res: Response): Promise<string | null> {
    const token = volunteerToken(req);
    const id = token ? await findProfile(db, hashToken(token)) : null;
    if (!id) res.status(401).json({ error: 'unauthorised', message: 'Volunteer session missing or expired.' });
    return id;
  }

  // Anonymous session: a random token only this device holds. No name, email or location.
  r.post('/session', limiter(10), async (_req, res) => {
    const token = newVolunteerToken();
    await createProfile(db, hashToken(token));
    res.status(201).json({ token });
  });

  r.get('/actions', async (req, res) => {
    const profile = await profileOf(req, res);
    if (!profile) return;
    const actions = await listActions(db, profile);
    const completed = actions.filter((a) => a.status === 'completed');
    const minutes = completed.reduce((s, a) => s + a.planned_minutes, 0);
    // Success metric from the product brief: real-world minutes per minute on screen.
    const timed = completed.filter((a) => a.screen_seconds !== null);
    const screenMinutes = timed.reduce((s, a) => s + a.screen_seconds!, 0) / 60;
    const timedMinutes = timed.reduce((s, a) => s + a.planned_minutes, 0);
    res.json({
      actions,
      completed_minutes: minutes,
      screen_minutes: Math.round(screenMinutes * 10) / 10,
      world_minutes_per_screen_minute: screenMinutes > 0 ? Math.round(timedMinutes / screenMinutes) : null,
    });
  });

  r.post('/actions', limiter(30), async (req, res) => {
    const profile = await profileOf(req, res);
    if (!profile) return;
    const body = z
      .object({
        opportunity_id: z.uuid(),
        planned_minutes: z.number().int().min(1).max(1440),
        screen_seconds: z.number().int().min(0).max(86400).optional(),
      })
      .strict()
      .parse(req.body);
    const id = await createAction(db, profile, body.opportunity_id, body.planned_minutes, body.screen_seconds ?? null);
    if (!id) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(201).json({ id });
  });

  r.patch('/actions/:id', async (req, res) => {
    const profile = await profileOf(req, res);
    if (!profile) return;
    const id = z.uuid().parse(req.params.id);
    const { status } = z.object({ status: z.enum(['completed', 'cancelled']) }).strict().parse(req.body);
    const ok = await updateActionStatus(db, profile, id, status);
    res.status(ok ? 200 : 404).json(ok ? { ok } : { error: 'not_found' });
  });

  // Right to erasure: removes the anonymous profile and all history.
  r.delete('/me', async (req, res) => {
    const profile = await profileOf(req, res);
    if (!profile) return;
    await deleteProfile(db, profile);
    res.status(204).end();
  });

  return r;
}
