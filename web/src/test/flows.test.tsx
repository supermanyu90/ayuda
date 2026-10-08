import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { AppProvider } from '../lib/state';
import type { MatchResponse, PublicConfig } from '../lib/types';

const config = (over: Partial<PublicConfig> = {}): PublicConfig => ({
  radii_km: [1, 3, 5, 10, 25],
  default_radius_km: 5,
  demo_centre: { lat: 19.0596, lng: 72.8295, label: 'Bandra West, Mumbai (demo location)' },
  gemma: { available: true, model: 'gemma3:4b', provider: 'ollama' },
  voice: { available: true, provider: 'elevenlabs' },
  ...over,
});

const match = (over: Partial<MatchResponse> = {}): MatchResponse => ({
  demo: true,
  search: { radius_km: 5, centre_label: 'demo' },
  intent: {
    intent: {
      availability: { day: 'sunday', time_of_day: 'morning' },
      duration_minutes: 120,
      skills: ['teaching'],
      beneficiaries: ['children'],
      assistance_types: [],
      max_distance_km: null,
      monetary_donation_preference: 'not_requested',
      languages: [],
      constraints: [],
    },
    source: 'gemma',
    model: 'gemma3:4b',
    latency_ms: 4000,
    understood: true,
  },
  candidates_considered: 3,
  excluded: 0,
  matches: [
    {
      opportunity_id: '11111111-1111-1111-1111-111111111111',
      organisation_name: 'Little Lanterns (Demo)',
      category: 'education_literacy',
      locality: 'Bandra West',
      title: 'Sunday spoken-English circle',
      activity: 'Lead a reading session',
      distance_km: 0.68,
      minutes: { min: 60, max: 120 },
      days: ['sunday'],
      times_of_day: ['morning'],
      skills: ['teaching', 'english'],
      beneficiaries: ['children'],
      languages: ['english'],
      verification_status: 'VERIFIED',
      is_demo: true,
      money_required: false,
      location: { lat: 19.06, lng: 72.83 },
      score: 94,
      reasons: ['0.7 km away', 'helps children'],
      missing_requirements: [],
      caveats: [],
    },
  ],
  near_misses: [],
  summary: { summary: 'The best fit is a reading circle 0.7 km away.', source: 'gemma', speech_token: 't' },
  ...over,
});

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let handler: Handler;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  handler = () => json({}, 404);
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(String(url), init))));
  // Autoplay is not available in jsdom.
  vi.stubGlobal('Audio', class { play = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })); pause() {} });
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string, cfg = config()) {
  return render(
    <AppProvider initialConfig={cfg}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProvider>,
  );
}

describe('landing', () => {
  it('has the primary and secondary CTAs and honest service status', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /tell ayuda how you can help/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i have 30 minutes/i })).toBeInTheDocument();
    expect(screen.getByText(/gemma \(gemma3:4b\) live/i)).toBeInTheDocument();
  });
  it('says so when Gemma and voice are offline', () => {
    renderAt('/', config({ gemma: { available: false, model: 'gemma3:4b', provider: 'ollama' }, voice: { available: false, provider: 'none' } }));
    expect(screen.getByText(/gemma offline/i)).toBeInTheDocument();
    expect(screen.getByText(/voice off: type instead/i)).toBeInTheDocument();
  });
  it('has a keyboard skip link to the main content', async () => {
    renderAt('/');
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveFocus();
  });
});

describe('tell (voice + text)', () => {
  it('falls back to text when voice is unavailable', () => {
    renderAt('/tell', config({ voice: { available: false, provider: 'none' } }));
    expect(screen.getByRole('button', { name: /start recording/i })).toBeDisabled();
    expect(screen.getByText(/voice is not available right now/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/or type it here/i)).toBeEnabled();
  });

  it('explains microphone permission denial and moves focus to the text box', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) },
    });
    renderAt('/tell');
    await userEvent.click(screen.getByRole('button', { name: /start recording/i }));
    expect(await screen.findByText(/microphone access was blocked/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/or type it here/i)).toHaveFocus();
  });

  it('asks for input instead of submitting an empty request', async () => {
    renderAt('/tell');
    await userEvent.click(screen.getByRole('button', { name: /find ways to help/i }));
    expect(screen.getByText(/tell ayuda a little about/i)).toBeInTheDocument();
  });

  it('typed request in demo mode goes straight to results with transcript, intent and matches', async () => {
    handler = (url) => (url.includes('/api/match') ? json(match()) : json({}, 404));
    renderAt('/tell');
    await userEvent.type(screen.getByLabelText(/or type it here/i), 'I can teach kids on Sunday');
    await userEvent.click(screen.getByRole('button', { name: /find ways to help/i }));
    expect(await screen.findByRole('heading', { name: /ways to help near you/i })).toBeInTheDocument();
    expect(await screen.findByText(/the best fit is a reading circle/i)).toBeInTheDocument();
    expect(screen.getByText(/understood by gemma3:4b \(open-weight\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sunday spoken-English circle' })).toBeInTheDocument();
    expect(screen.getByText('Demo · fictional')).toBeInTheDocument();
    expect(screen.getByText('✓ Verified')).toBeInTheDocument();
  });
});

describe('location', () => {
  beforeEach(() => localStorage.setItem('ayuda.demo', 'false'));

  it('falls back to manual search when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: (e: object) => void) => fail({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }) },
    });
    renderAt('/location');
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(await screen.findByText(/location permission was declined/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/locality, landmark, pin code or city/i)).toHaveFocus();
  });

  it('reports a geolocation timeout', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: (e: object) => void) => fail({ code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3 }) },
    });
    renderAt('/location');
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(await screen.findByText(/took too long/i)).toBeInTheDocument();
  });

  it('manual PIN search lists places; geocoder failure is shown', async () => {
    handler = (url) => (url.includes('q=400050') ? json({ places: [{ label: '400050, Bandra West, Mumbai', lat: 19.05, lng: 72.83 }] }) : json({ error: 'geocoder_unavailable', message: 'Location search is unavailable' }, 503));
    renderAt('/location');
    const box = screen.getByLabelText(/locality, landmark, pin code or city/i);
    await userEvent.type(box, '400050{Enter}');
    expect(await screen.findByRole('button', { name: /400050, bandra west/i })).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'nowhere{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/location search is unavailable/i);
  });

  it('only sends rounded coordinates when location is granted', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: (p: object) => void) => ok({ coords: { latitude: 19.0596123, longitude: 72.8295987 } }) },
    });
    const bodies: string[] = [];
    handler = (url, init) => {
      if (url.includes('/api/match')) bodies.push(String(init?.body));
      return json(match({ demo: false }));
    };
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: /i have 30 minutes/i }));
    await userEvent.click(await screen.findByRole('button', { name: /use my location/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(JSON.parse(bodies[0]!).location).toEqual({ lat: 19.06, lng: 72.83 });
  });
});

describe('results states', () => {
  async function search(response: MatchResponse) {
    handler = (url) => (url.includes('/api/match') ? json(response) : json({}, 404));
    renderAt('/tell');
    await userEvent.type(screen.getByLabelText(/or type it here/i), 'I can help on Sunday');
    await userEvent.click(screen.getByRole('button', { name: /find ways to help/i }));
  }

  it('zero results shows near misses and a wider-radius action', async () => {
    await search(match({ matches: [], near_misses: [{ opportunity_id: 'x', title: 'Weekend homework helper', organisation_name: 'Khar Hub (Demo)', distance_km: 1.5, reason: 'needs at least 90 minutes' }] }));
    expect(await screen.findByText(/no matching opportunities within 5 km/i)).toBeInTheDocument();
    expect(screen.getByText(/needs at least 90 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search 25 km/i })).toBeInTheDocument();
  });

  it('labels the deterministic fallback honestly when Gemma is unavailable', async () => {
    const r = match();
    await search({ ...r, intent: { ...r.intent, source: 'fallback_rules', model: null, fallback_reason: 'Gemma is unavailable' } });
    expect(await screen.findByText(/basic keyword matching \(gemma is unavailable\)/i)).toBeInTheDocument();
  });

  it('asks to rephrase when the request was not understood', async () => {
    const r = match();
    await search({ ...r, matches: [], intent: { ...r.intent, understood: false } });
    expect(await screen.findByRole('link', { name: /try saying it another way/i })).toBeInTheDocument();
  });

  it('radius is a keyboard-operable radio group that re-runs the search', async () => {
    let calls = 0;
    handler = (url, init) => {
      if (!url.includes('/api/match')) return json({}, 404);
      calls++;
      return json(match({ search: { radius_km: JSON.parse(String(init?.body)).radius_km, centre_label: 'demo' } }));
    };
    renderAt('/tell');
    await userEvent.type(screen.getByLabelText(/or type it here/i), 'I can help');
    await userEvent.click(screen.getByRole('button', { name: /find ways to help/i }));
    await screen.findByText(/the best fit/i);
    await userEvent.click(screen.getByRole('radio', { name: '10 km' }));
    await waitFor(() => expect(calls).toBe(2));
    expect(screen.getByRole('radio', { name: '10 km' })).toBeChecked();
  });

  it('shows an error with retry when the server is down', async () => {
    handler = () => json({ error: 'service_unavailable', message: 'Ayuda is temporarily unavailable. Please try again shortly.' }, 503);
    renderAt('/tell');
    await userEvent.type(screen.getByLabelText(/or type it here/i), 'I can help');
    await userEvent.click(screen.getByRole('button', { name: /find ways to help/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('screen exit mode', () => {
  it('shows directions, contact and the demo warning; no contact for unverified', async () => {
    const detail = {
      ...match().matches[0],
      city: 'Mumbai',
      min_age: null,
      physical_requirement: null,
      background_check: false,
      contact: { address_text: 'Fictional address, Bandra West', contact_phone: '+91 555 010 0000', contact_email: 'demo-0@example.org', website: null, safeguarding_notes: 'Work in pairs.', description: '' },
    };
    handler = () => json(detail);
    renderAt('/go/11111111-1111-1111-1111-111111111111');
    expect(await screen.findByRole('heading', { name: /you're ready to help/i })).toBeInTheDocument();
    expect(screen.getByText(/your next step is outside the app/i)).toBeInTheDocument();
    const go = screen.getByRole('link', { name: /go help: get directions/i });
    expect(go).toHaveAttribute('href', expect.stringContaining('destination=19.06%2C72.83'));
    expect(go).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /call/i })).toHaveAttribute('href', 'tel:+915550100000');
    expect(screen.getByText(/fictional demo organisation/i)).toBeInTheDocument();
  });
});
