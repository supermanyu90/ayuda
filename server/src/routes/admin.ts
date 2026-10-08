import { Router } from 'express';
import { z } from 'zod';
import { extractOrganisationNeed } from '../ai/services.js';
import { VerificationStatusSchema } from '../domain/schemas.js';
import { ASSISTANCE_TYPES, BENEFICIARIES, CATEGORIES, DAYS, LANGUAGES, SKILLS, TIMES_OF_DAY } from '../domain/taxonomy.js';
import { limiter, requireAdmin } from '../middleware/security.js';
import { createOpportunity, createOrganisation, listOrganisations, setVerification } from '../repo/organisations.js';
import type { Deps } from '../app.js';

const text = (max: number) => z.string().trim().min(1).max(max);

const NewOrganisationSchema = z
  .object({
    name: text(160),
    category: z.enum(CATEGORIES),
    description: z.string().trim().max(4000).default(''),
    address_text: text(300),
    locality: text(120),
    city: text(120),
    pincode: z.string().regex(/^\d{6}$/).nullable().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    contact_phone: z.string().regex(/^[+\d][\d\s-]{6,20}$/).nullable().optional(),
    contact_email: z.email().max(200).nullable().optional(),
    // Only https links, so a malicious listing cannot inject javascript: or http downgrade URLs.
    website: z.url({ protocol: /^https$/ }).max(300).nullable().optional(),
    safeguarding_notes: z.string().trim().max(1000).optional(),
  })
  .strict();

const NewOpportunitySchema = z
  .object({
    title: text(160),
    activity: text(600),
    skills: z.array(z.enum(SKILLS)).max(10),
    beneficiaries: z.array(z.enum(BENEFICIARIES)).max(7),
    assistance_types: z.array(z.enum(ASSISTANCE_TYPES)).max(10),
    languages: z.array(z.enum(LANGUAGES)).max(7),
    days: z.array(z.enum(DAYS)).max(7),
    times_of_day: z.array(z.enum(TIMES_OF_DAY)).max(3),
    min_minutes: z.number().int().min(5).max(1440),
    max_minutes: z.number().int().min(5).max(1440),
    min_age: z.number().int().min(0).max(100).nullable().optional(),
    background_check: z.boolean().optional(),
    need_source: z.enum(['admin', 'gemma_reviewed']).default('admin'),
  })
  .strict()
  .refine((o) => o.max_minutes >= o.min_minutes, { message: 'max_minutes must be >= min_minutes' });

export function adminRoutes({ db, ai, config }: Deps): Router {
  const r = Router();
  r.use(requireAdmin(config.ADMIN_TOKEN));

  r.get('/organisations', async (_req, res) => {
    res.json({ organisations: await listOrganisations(db) });
  });

  r.post('/organisations', async (req, res) => {
    const id = await createOrganisation(db, NewOrganisationSchema.parse(req.body));
    res.status(201).json({ id, verification_status: 'UNVERIFIED' });
  });

  r.patch('/organisations/:id/verification', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const { status, note } = z.object({ status: VerificationStatusSchema, note: text(500) }).strict().parse(req.body);
    const ok = await setVerification(db, id, status, note);
    res.status(ok ? 200 : 404).json(ok ? { ok, status } : { error: 'not_found' });
  });

  r.post('/organisations/:id/opportunities', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const oppId = await createOpportunity(db, id, NewOpportunitySchema.parse(req.body));
    res.status(oppId ? 201 : 404).json(oppId ? { id: oppId } : { error: 'not_found' });
  });

  // Gemma suggestion for an admin to review. Never written to the database directly.
  r.post('/extract-need', limiter(20), async (req, res) => {
    const { description } = z.object({ description: text(2000) }).strict().parse(req.body);
    res.json(await extractOrganisationNeed(ai, description));
  });

  return r;
}
