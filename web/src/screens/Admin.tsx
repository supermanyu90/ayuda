import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, DemoBadge, PageTitle, Spinner, VerificationBadge } from '../components/ui';
import { api, ApiError, type AdminOrganisation } from '../lib/api';

const TOKEN_KEY = 'ayuda.admin';
const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

const input = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3';
const CATEGORIES = ['elderly_care', 'child_support', 'disability_support', 'animal_shelter', 'community_kitchen', 'education_literacy', 'environment', 'community_service'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 font-bold">
      {label}
      <span className="font-normal">{children}</span>
    </label>
  );
}

function VerificationRow({ org, token, onChange }: { org: AdminOrganisation; token: string; onChange: () => void }) {
  const [status, setStatus] = useState(org.verification_status);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.admin.setVerification(token, org.id, status, note);
      setMsg('Saved');
      onChange();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge status={org.verification_status} />
        {org.is_demo && <DemoBadge />}
        <span className="text-sm text-muted">{org.opportunities} opportunities</span>
      </div>
      <h3 className="mt-2 text-lg font-bold">{org.name}</h3>
      <p className="text-muted">
        {org.locality}, {org.city} · {org.category.replace(/_/g, ' ')}
      </p>
      {org.verification_note && <p className="mt-1 text-sm text-muted">Note: {org.verification_note}</p>}
      <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <label className="sr-only" htmlFor={`st-${org.id}`}>
          Verification status
        </label>
        <select id={`st-${org.id}`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={input}>
          <option>VERIFIED</option>
          <option>PENDING</option>
          <option>UNVERIFIED</option>
        </select>
        <label className="sr-only" htmlFor={`note-${org.id}`}>
          Reason / evidence
        </label>
        <input id={`note-${org.id}`} required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / evidence checked" className={input} />
        <Button type="submit" variant="secondary">
          Update
        </Button>
      </form>
      {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}
    </Card>
  );
}

function NewOrganisation({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    try {
      await api.admin.createOrganisation(token, {
        name: s('name'),
        category: s('category'),
        description: s('description'),
        address_text: s('address_text'),
        locality: s('locality'),
        city: s('city'),
        pincode: s('pincode') || null,
        lat: Number(s('lat')),
        lng: Number(s('lng')),
        contact_phone: s('contact_phone') || null,
        contact_email: s('contact_email') || null,
        website: s('website') || null,
        safeguarding_notes: s('safeguarding_notes'),
      });
      setMsg('Created as UNVERIFIED. Verify it below once checked.');
      e.currentTarget.reset();
      onCreated();
    } catch (err) {
      setMsg(err instanceof ApiError ? `${err.message} (check the fields)` : 'Failed');
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Name"><input name="name" required className={input} /></Field>
      <Field label="Category">
        <select name="category" className={input}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
      </Field>
      <Field label="Address"><input name="address_text" required className={input} /></Field>
      <Field label="Locality"><input name="locality" required className={input} /></Field>
      <Field label="City"><input name="city" required className={input} /></Field>
      <Field label="PIN code"><input name="pincode" inputMode="numeric" pattern="\d{6}" className={input} /></Field>
      <Field label="Latitude"><input name="lat" required inputMode="decimal" className={input} /></Field>
      <Field label="Longitude"><input name="lng" required inputMode="decimal" className={input} /></Field>
      <Field label="Phone"><input name="contact_phone" className={input} /></Field>
      <Field label="Email"><input name="contact_email" type="email" className={input} /></Field>
      <Field label="Website (https only)"><input name="website" type="url" pattern="https://.*" className={input} /></Field>
      <Field label="Safeguarding notes"><input name="safeguarding_notes" className={input} /></Field>
      <div className="sm:col-span-2">
        <Field label="Description"><textarea name="description" rows={3} className={`${input} py-2`} /></Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">Add organisation (unverified)</Button>
        {msg && <p className="mt-2" role="status">{msg}</p>}
      </div>
    </form>
  );
}

function NeedExtractor({ token, orgs }: { token: string; orgs: AdminOrganisation[] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [orgId, setOrgId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function extract() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.admin.extractNeed(token, text);
      if (!r.need) {
        setMsg(`Gemma could not extract needs (${r.error}). Fill the form manually.`);
        return;
      }
      const n = r.need as { skills: string[]; beneficiaries: string[]; assistance_types: string[]; languages: string[]; duration: { min_minutes: number | null; max_minutes: number | null } };
      setDraft(
        JSON.stringify(
          {
            title: '',
            activity: text.slice(0, 600),
            skills: n.skills,
            beneficiaries: n.beneficiaries,
            assistance_types: n.assistance_types,
            languages: n.languages,
            days: [],
            times_of_day: [],
            min_minutes: n.duration.min_minutes ?? 60,
            max_minutes: n.duration.max_minutes ?? 120,
            need_source: 'gemma_reviewed',
          },
          null,
          2,
        ),
      );
      setMsg('Gemma suggestion below. Review every field, add a title, days and times, then publish.');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    try {
      await api.admin.createOpportunity(token, orgId, JSON.parse(draft));
      setMsg('Opportunity published.');
      setDraft('');
    } catch (err) {
      setMsg(err instanceof SyntaxError ? 'The draft is not valid JSON.' : (err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Organisation's own description of what they need">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className={`${input} py-2`} />
      </Field>
      <div>
        <Button variant="secondary" onClick={extract} disabled={busy || text.trim().length < 10}>
          Suggest structure with Gemma
        </Button>
      </div>
      {busy && <Spinner label="Gemma is reading the description…" />}
      {msg && <Alert>{msg}</Alert>}
      {draft && (
        <>
          <Field label="Opportunity (review and edit)">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} className={`${input} py-2 font-mono text-sm`} />
          </Field>
          <Field label="Organisation">
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={input}>
              <option value="">Choose…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <div>
            <Button onClick={publish} disabled={!orgId}>Publish reviewed opportunity</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function Admin() {
  const [token, setToken] = useState(getToken);
  const [entry, setEntry] = useState('');
  const [orgs, setOrgs] = useState<AdminOrganisation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api.admin.organisations(token).then(
      (r) => {
        setOrgs(r.organisations);
        setError(null);
      },
      (e: ApiError) => {
        setError(e.status === 401 ? 'That admin token was not accepted.' : e.message);
        if (e.status === 401) {
          setToken('');
          try {
            sessionStorage.removeItem(TOKEN_KEY);
          } catch {
            /* ignore */
          }
        }
      },
    );
  }, [token]);
  useEffect(load, [load]);

  function signIn(e: FormEvent) {
    e.preventDefault();
    try {
      sessionStorage.setItem(TOKEN_KEY, entry);
    } catch {
      /* session only */
    }
    setToken(entry);
    setEntry('');
  }

  if (!token) {
    return (
      <>
        <PageTitle sub="For Ayuda staff who add and verify organisations.">Organisation admin</PageTitle>
        {error && <Alert tone="error">{error}</Alert>}
        <form onSubmit={signIn} className="mt-4 flex max-w-md flex-col gap-3">
          <Field label="Admin token">
            <input type="password" value={entry} onChange={(e) => setEntry(e.target.value)} required autoComplete="off" className={input} />
          </Field>
          <Button type="submit">Sign in</Button>
        </form>
      </>
    );
  }

  return (
    <>
      <PageTitle sub="New organisations start unverified. Only verified ones are shown to volunteers.">Organisations & verification</PageTitle>
      {error && <Alert tone="error">{error}</Alert>}
      <details className="mb-4 rounded-3xl border border-line bg-card p-5">
        <summary className="cursor-pointer text-lg font-bold text-forest">Add an organisation</summary>
        <div className="mt-4">
          <NewOrganisation token={token} onCreated={load} />
        </div>
      </details>
      <details className="mb-6 rounded-3xl border border-line bg-card p-5">
        <summary className="cursor-pointer text-lg font-bold text-forest">Add an opportunity from a description (Gemma-assisted)</summary>
        <div className="mt-4">{orgs && <NeedExtractor token={token} orgs={orgs} />}</div>
      </details>
      <h2 className="mb-3 text-xl font-bold">Verification management</h2>
      {!orgs ? (
        <Spinner label="Loading organisations…" />
      ) : (
        <ul className="flex flex-col gap-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <VerificationRow org={o} token={token} onChange={load} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
