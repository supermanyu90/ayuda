import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MapView } from '../components/MapView';
import { OpportunityCard } from '../components/OpportunityCard';
import { Alert, Button, ButtonLink, Card, Chip, PageTitle, Spinner, pretty } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useApp, useSearchLocation } from '../lib/state';
import type { IntentResult, Summary } from '../lib/types';

/** Technical details (model, latency, guards, raw JSON) are for judges/evaluators, so they appear only in Demo Mode. */
function IntentPanel({ intent, text, technical }: { intent: IntentResult; text: string | null; technical: boolean }) {
  const i = intent.intent;
  const chips = [
    i.availability.day && `on ${i.availability.day}`,
    i.availability.time_of_day && `in the ${i.availability.time_of_day}`,
    i.duration_minutes && `${i.duration_minutes} minutes`,
    ...i.skills.map((s) => `skill: ${pretty(s)}`),
    ...i.beneficiaries.map((b) => `helping ${pretty(b)}`),
    i.monetary_donation_preference === 'not_requested' && 'no money',
    ...i.languages.map((l) => `speaks ${l}`),
  ].filter(Boolean) as string[];
  const sourceLabel =
    intent.source === 'gemma'
      ? `Understood by ${intent.model} (open-weight) in ${((intent.latency_ms ?? 0) / 1000).toFixed(1)}s`
      : intent.source === 'quick_filter'
        ? 'Quick filter: no AI needed'
        : `Basic keyword matching (${intent.fallback_reason ?? 'Gemma unavailable'})`;
  return (
    <Card>
      <h2 className="text-lg font-bold text-forest">What Ayuda understood</h2>
      {text && <p className="mt-1 text-muted">“{text}”</p>}
      <p className="mt-3 flex flex-wrap gap-1.5">{chips.length ? chips.map((c) => <Chip key={c}>{c}</Chip>) : <span className="text-muted">Anything nearby</span>}</p>
      {technical && (
        <>
          <p className="mt-3 text-sm text-muted">{sourceLabel}</p>
          {(intent.corrected_fields?.length ?? 0) > 0 && (
            <p className="text-sm text-muted">Checked by rules: {intent.corrected_fields!.map(pretty).join(', ')}</p>
          )}
          {(intent.dropped_fields?.length ?? 0) > 0 && (
            <p className="text-sm text-muted">Ignored (you didn't mention it): {intent.dropped_fields!.map((f) => pretty(f.replace('availability.', ''))).join(', ')}</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer font-bold text-forest">Show structured intent (JSON)</summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-paper p-3 text-sm">{JSON.stringify(i, null, 2)}</pre>
          </details>
        </>
      )}
    </Card>
  );
}

function SpokenSummary({ summaryId }: { summaryId: string }) {
  const { config, settings } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const canSpeak = (config?.voice.available ?? false) && settings.voiceReplies;

  const play = useCallback(() => {
    audio.current?.pause();
    const a = new Audio(api.speechUrl(summaryId));
    audio.current = a;
    setState('loading');
    a.onplaying = () => setState('playing');
    a.onended = () => setState('idle');
    a.onerror = () => setState('error');
    // Autoplay blocked or interrupted is not a voice failure: just offer the Play button.
    a.play().catch(() => setState((s) => (s === 'error' ? s : 'idle')));
  }, [summaryId]);

  // Start the (streamed) speech and the text summary at the same time: both use the same server-side summary.
  useEffect(() => {
    let live = true;
    setSummary(null);
    setFailed(false);
    if (canSpeak) play();
    api.summary(summaryId).then(
      (s) => live && setSummary(s),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
      audio.current?.pause();
    };
  }, [summaryId, canSpeak, play]);

  if (failed) return null;
  return (
    <Card className="border-forest/40 bg-forest-soft">
      {summary ? (
        <p className="text-xl font-bold leading-snug" aria-live="polite">
          {summary.summary}
        </p>
      ) : (
        <Spinner label="Writing a short summary…" />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        {summary && <span>{summary.source === 'gemma' ? 'Summary written by Gemma from the verified facts below' : 'Summary from verified facts'}</span>}
        {canSpeak && (
          <Button
            variant="ghost"
            className="min-h-10 px-2 py-1 text-sm"
            onClick={() => (state === 'playing' ? (audio.current?.pause(), setState('idle')) : play())}
            disabled={state === 'loading'}
          >
            {state === 'playing' ? '⏸ Stop' : state === 'loading' ? 'Loading voice…' : '🔊 Play aloud'}
          </Button>
        )}
        {state === 'error' && <span>Voice unavailable; the text above says it all.</span>}
      </div>
    </Card>
  );
}

export function Results() {
  const { request, results, setResults, radius, setRadius, demo, config } = useApp();
  const where = useSearchLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const searchedFor = useRef<string | null>(null);

  const run = useCallback(async () => {
    if (!request || !where) return;
    setLoading(true);
    setError(null);
    try {
      const loc = { lat: where.lat, lng: where.lng };
      const r =
        request.kind === 'text'
          ? await api.match({ text: request.text, location: loc, radius_km: radius, demo })
          : await api.quick({ location: loc, radius_km: radius, demo, minutes: request.minutes });
      setResults(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [request, where?.lat, where?.lng, radius, demo, setResults]);

  useEffect(() => {
    const key = JSON.stringify([request, where?.lat, where?.lng, radius, demo]);
    if (results && searchedFor.current === null) searchedFor.current = key;
    if (searchedFor.current === key) return;
    searchedFor.current = key;
    void run();
  }, [request, where?.lat, where?.lng, radius, demo, run, results]);

  const select = useCallback((id: string) => navigate(`/opportunity/${id}`), [navigate]);

  if (!request) return <Navigate to="/tell" replace />;
  if (!where) return <Navigate to="/location" replace />;

  return (
    <>
      <PageTitle
        sub={
          <>
            Within {radius} km of {where.label}.{' '}
            {!demo && (
              <Link to="/location" className="font-bold text-forest underline">
                Change location
              </Link>
            )}
          </>
        }
      >
        Ways to help near you
      </PageTitle>

      <fieldset className="mb-5">
        <legend className="mb-2 font-bold">Search radius</legend>
        <div className="flex flex-wrap gap-2">
          {(config?.radii_km ?? [1, 3, 5, 10, 25]).map((r) => (
            <label key={r} className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-4 font-bold ${r === radius ? 'border-forest bg-forest text-white' : 'border-line bg-card'}`}>
              <input type="radio" name="radius" value={r} checked={r === radius} onChange={() => setRadius(r)} className="sr-only" />
              {r} km
            </label>
          ))}
        </div>
      </fieldset>

      {loading && (
        <Card>
          <Spinner label={request.kind === 'text' ? 'Understanding your request with Gemma and searching nearby…' : 'Searching nearby…'} />
        </Card>
      )}
      {error && (
        <div className="flex flex-col gap-3">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => void run()}>
            Try again
          </Button>
        </div>
      )}

      {results && !loading && (
        <div className="flex flex-col gap-4">
          {results.summary_id && <SpokenSummary summaryId={results.summary_id} />}
          <IntentPanel intent={results.intent} text={request.kind === 'text' ? request.text : null} technical={results.demo} />

          {results.intent.understood === false ? (
            <ButtonLink to="/tell">Try saying it another way</ButtonLink>
          ) : results.matches.length === 0 ? (
            <Card>
              <h2 className="text-xl font-bold text-forest">No matching opportunities within {radius} km</h2>
              <p className="mt-2 text-muted">
                {demo
                  ? 'Try a larger radius, a different day, or a broader request.'
                  : 'Ayuda only shows verified organisations, and there may not be any listed near you yet. Try a larger radius, or Demo Mode to see how it works.'}
              </p>
              {results.near_misses.length > 0 && (
                <>
                  <h3 className="mt-4 font-bold">Almost fits</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {results.near_misses.map((n) => (
                      <li key={n.opportunity_id}>
                        <Link to={`/opportunity/${n.opportunity_id}`} className="font-bold text-forest underline">
                          {n.title}
                        </Link>{' '}
                        <span className="text-muted">
                          · {n.organisation_name}, {n.distance_km.toFixed(1)} km. {n.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {radius < 25 && (
                  <Button variant="secondary" onClick={() => setRadius(25)}>
                    Search 25 km
                  </Button>
                )}
                <ButtonLink to="/tell" variant="ghost">
                  Change my request
                </ButtonLink>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {results.matches.length} best {results.matches.length === 1 ? 'match' : 'matches'}
                  <span className="block text-sm font-normal text-muted">
                    from {results.candidates_considered} verified {results.candidates_considered === 1 ? 'opportunity' : 'opportunities'} nearby
                  </span>
                </h2>
                <div role="group" aria-label="View" className="inline-flex rounded-xl border-2 border-forest p-0.5">
                  {(['list', 'map'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                      className={`min-h-10 rounded-lg px-4 font-bold capitalize ${view === v ? 'bg-forest text-white' : 'text-forest'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {view === 'map' && <MapView centre={where} radiusKm={radius} matches={results.matches} onSelect={select} />}
              <ol className="flex flex-col gap-3">
                {results.matches.map((m, i) => (
                  <li key={m.opportunity_id}>
                    <OpportunityCard m={m} rank={i + 1} />
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </>
  );
}
