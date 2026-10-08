import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, PageTitle, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { GEO_MESSAGES, getPosition, type GeoError } from '../lib/geolocation';
import { approximate, useApp } from '../lib/state';
import type { Place } from '../lib/types';

export function LocationScreen() {
  const { setLocation, request, demo, setDemo } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'gps' | 'search' | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const next = () => navigate(request ? '/results' : '/tell', { replace: true });

  async function useGps() {
    setBusy('gps');
    setGeoError(null);
    try {
      const p = approximate(await getPosition());
      setLocation({ ...p, label: 'Your current area (approximate)', source: 'gps' });
      next();
    } catch (err) {
      setGeoError(GEO_MESSAGES[(typeof err === 'string' ? err : 'unavailable') as GeoError]);
      document.getElementById('place')?.focus();
    } finally {
      setBusy(null);
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy('search');
    setSearchError(null);
    try {
      setPlaces((await api.geocode(query.trim())).places);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Location search failed.');
    } finally {
      setBusy(null);
    }
  }

  function choose(p: Place) {
    setLocation({ ...approximate(p), label: p.label.split(',').slice(0, 3).join(','), source: 'manual' });
    next();
  }

  return (
    <>
      <PageTitle sub="Ayuda uses your location only to find places near you. It is rounded to about 100 m, never stored, and never shared with organisations or the AI model.">
        Where are you?
      </PageTitle>

      {demo && (
        <Alert>
          You are in Demo Mode, which always uses a fictional Bandra, Mumbai location.{' '}
          <button type="button" className="font-bold underline" onClick={next}>
            Continue with the demo
          </button>{' '}
          or{' '}
          <button type="button" className="font-bold underline" onClick={() => setDemo(false)}>
            switch to real mode
          </button>
          .
        </Alert>
      )}

      <Card className="mt-4">
        <h2 className="text-xl font-bold text-forest">Use my current location</h2>
        <p className="mt-1 text-muted">Your browser will ask for permission.</p>
        <Button className="mt-4 w-full sm:w-auto" onClick={useGps} disabled={busy !== null}>
          <span aria-hidden>📍</span> Use my location
        </Button>
        {busy === 'gps' && (
          <div className="mt-3">
            <Spinner label="Finding your area…" />
          </div>
        )}
        {geoError && (
          <div className="mt-3">
            <Alert tone="warn">{geoError}</Alert>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-xl font-bold text-forest">Or search for an area</h2>
        <form onSubmit={search} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="place" className="sr-only">
            Locality, landmark, PIN code or city
          </label>
          <input
            id="place"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Locality, landmark, PIN code or city"
            className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-card px-4 text-lg focus:border-forest"
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" disabled={busy !== null || query.trim().length < 2}>
            Search
          </Button>
        </form>
        {busy === 'search' && (
          <div className="mt-3">
            <Spinner label="Searching…" />
          </div>
        )}
        {searchError && (
          <div className="mt-3">
            <Alert tone="error">{searchError}</Alert>
          </div>
        )}
        {places && (
          <div className="mt-3" aria-live="polite">
            {places.length === 0 ? (
              <p className="text-muted">No places found. Try a nearby landmark or your PIN code.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {places.map((p) => (
                  <li key={`${p.lat},${p.lng}`}>
                    <button type="button" onClick={() => choose(p)} className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:border-forest">
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
