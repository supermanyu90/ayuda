import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Chip, DemoBadge, PageTitle, Spinner, VerificationBadge, pretty } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { useApp } from '../lib/state';
import { resetScreenTimer, screenSeconds } from '../lib/screenTime';
import { useOpportunity } from '../lib/useOpportunity';

export function Opportunity() {
  const { id } = useParams();
  const { results, request, volunteerToken } = useApp();
  const navigate = useNavigate();
  const { data: o, error } = useOpportunity(id);
  const match = results?.matches.find((m) => m.opportunity_id === id);
  const offered = results?.intent.intent.duration_minutes ?? (request?.kind === 'quick' ? request.minutes : null);
  const [confirming, setConfirming] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!o) return <Spinner label="Loading details…" />;

  const planned = minutes ?? Math.min(Math.max(offered ?? o.minutes.min, o.minutes.min), o.minutes.max);
  const trusted = o.verification_status === 'VERIFIED';

  async function commit() {
    setSaving(true);
    setSaveError(null);
    const onScreen = screenSeconds();
    try {
      await api.commit(await volunteerToken(), o!.opportunity_id, planned, onScreen);
    } catch (err) {
      // History is a convenience: never block someone from going to help.
      setSaveError(err instanceof ApiError ? err.message : null);
    } finally {
      setSaving(false);
      resetScreenTimer();
      navigate(`/go/${o!.opportunity_id}`, { state: { planned, onScreen } });
    }
  }

  return (
    <>
      <p className="mb-4">
        <Link to={results ? '/results' : '/'} className="font-bold text-forest underline">
          ← Back {results ? 'to results' : 'home'}
        </Link>
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <VerificationBadge status={o.verification_status} />
        {o.is_demo && <DemoBadge />}
      </div>
      <PageTitle sub={`${o.organisation_name} · ${o.locality}, ${o.city}${o.distance_km !== null ? ` · ${o.distance_km.toFixed(1)} km away` : ''}`}>{o.title}</PageTitle>

      {!trusted && (
        <Alert tone="warn">This organisation is not verified yet. Ayuda does not share contact details until it is.</Alert>
      )}

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-lg font-bold text-forest">What you'll do</h2>
          <p className="mt-1 text-lg">{o.activity}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Time needed</dt>
              <dd className="font-bold">
                {o.minutes.min}–{o.minutes.max} minutes
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">When</dt>
              <dd className="font-bold capitalize">
                {o.days.length === 7 ? 'Any day' : o.days.join(', ')} · {o.times_of_day.join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Money</dt>
              <dd className="font-bold">{o.money_required ? 'Contribution asked' : 'None needed'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Helps</dt>
              <dd className="font-bold capitalize">{o.beneficiaries.map(pretty).join(', ')}</dd>
            </div>
            {o.languages.length > 0 && (
              <div>
                <dt className="text-sm text-muted">Languages</dt>
                <dd className="font-bold capitalize">{o.languages.join(', ')}</dd>
              </div>
            )}
            {o.min_age && (
              <div>
                <dt className="text-sm text-muted">Minimum age</dt>
                <dd className="font-bold">{o.min_age}</dd>
              </div>
            )}
          </dl>
          {o.skills.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-1.5">
              {o.skills.map((s) => (
                <Chip key={s}>{pretty(s)}</Chip>
              ))}
            </p>
          )}
        </Card>

        {match && (
          <Card>
            <h2 className="text-lg font-bold text-forest">Why it matches you ({match.score}%)</h2>
            <ul className="mt-2 list-disc pl-5">
              {match.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {match.missing_requirements.length > 0 && <p className="mt-2 text-[#7a4b00]">Note: {match.missing_requirements.join('; ')}</p>}
          </Card>
        )}

        {(o.background_check || o.physical_requirement || o.contact?.safeguarding_notes) && (
          <Card>
            <h2 className="text-lg font-bold text-forest">Before you go</h2>
            <ul className="mt-2 list-disc pl-5">
              {o.background_check && <li>A background check is needed before working with this group.</li>}
              {o.physical_requirement && <li>{o.physical_requirement}</li>}
              {o.contact?.safeguarding_notes && <li>{o.contact.safeguarding_notes}</li>}
            </ul>
          </Card>
        )}

        {trusted &&
          (confirming ? (
            <Card className="border-forest">
              <h2 className="text-lg font-bold text-forest">Confirm your plan</h2>
              <label htmlFor="minutes" className="mt-3 block font-bold">
                How long will you help?
              </label>
              <select
                id="minutes"
                value={planned}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="mt-1 min-h-12 rounded-xl border-2 border-line bg-card px-3 text-lg"
              >
                {Array.from(new Set([o.minutes.min, 60, 90, 120, 180, o.minutes.max]))
                  .filter((m) => m >= o.minutes.min && m <= o.minutes.max)
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
              </select>
              <p className="mt-2 text-sm text-muted">Saved anonymously on this device's history. No name, phone number or location is stored.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={commit} disabled={saving} variant="accent" className="min-h-14 text-lg">
                  I'm going to help
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
              {saveError && <Alert tone="warn">{saveError}</Alert>}
            </Card>
          ) : (
            <Button variant="accent" className="min-h-16 w-full text-lg" onClick={() => setConfirming(true)}>
              I'll do this
            </Button>
          ))}
      </div>
    </>
  );
}
