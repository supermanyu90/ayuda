import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../App';
import { compose } from '../components/QuickBuilder';
import { AppProvider } from '../lib/state';
import { QUOTES, quoteFor } from '../lib/quotes';
import type { PublicConfig } from '../lib/types';

const config: PublicConfig = {
  radii_km: [1, 3, 5, 10, 25],
  default_radius_km: 5,
  demo_centre: { lat: 19.06, lng: 72.83, label: 'demo' },
  gemma: { available: true, model: 'gemma3:4b', provider: 'ollama' },
  voice: { available: true, provider: 'elevenlabs' },
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
});
afterEach(() => vi.unstubAllGlobals());

const renderAt = (path: string | { pathname: string; state: unknown }) =>
  render(
    <AppProvider initialConfig={config}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProvider>,
  );

describe('tap-to-build request', () => {
  it('composes natural sentences', () => {
    expect(compose({ duration: '2 hours', day: 'on Sunday', time: 'morning', skills: ['teach'], who: ['children'], noMoney: true })).toBe(
      "I have 2 hours on Sunday morning. I can teach. I'd like to help children. I don't want to donate money.",
    );
    expect(compose({ day: 'today', time: 'evening', skills: ['cook', 'drive', 'teach'], who: [], noMoney: false })).toBe(
      'I have some time this evening. I can cook, drive and teach.',
    );
    expect(compose({ skills: [], who: [], noMoney: false })).toBe('');
  });

  it('chips are toggle buttons that write the request for you', async () => {
    renderAt('/tell');
    await userEvent.click(screen.getByText(/or tap to build it/i));
    const chip = screen.getByRole('button', { name: '1 hour' });
    await userEvent.click(chip);
    await userEvent.click(screen.getByRole('button', { name: /elderly people/i }));
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/your request/i)).toHaveValue("I have an hour. I'd like to help elderly people.");
    await userEvent.click(chip);
    expect(screen.getByLabelText(/your request/i)).toHaveValue("I'd like to help elderly people.");
  });
});

describe('screen time encouragement', () => {
  it('shows the screen-time meter while planning, but not after', () => {
    const { unmount } = renderAt('/tell');
    expect(screen.getByRole('timer')).toHaveAccessibleName(/aims for under 2 minutes/i);
    unmount();
    renderAt('/history');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('promises a plan in under 2 minutes on the landing page, with a quote', () => {
    renderAt('/');
    expect(screen.getByText(/you'll have a plan in under 2 minutes/i)).toBeInTheDocument();
    expect(screen.getAllByRole('figure').length).toBeGreaterThan(0);
  });
});

describe('quotes', () => {
  it('every quote has an author and a source', () => {
    for (const q of QUOTES) {
      expect(q.text.length).toBeGreaterThan(10);
      expect(q.author).toBeTruthy();
      expect(q.source).toBeTruthy();
    }
  });
  it('is stable per context', () => expect(quoteFor('abc')).toBe(quoteFor('abc')));
});

describe('phone down', () => {
  it('opens a calm full-screen dialog and closes with Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              opportunity_id: '11111111-1111-1111-1111-111111111111',
              organisation_name: 'Org (Demo)',
              title: 'Reading',
              activity: 'Read',
              days: ['sunday'],
              times_of_day: ['morning'],
              minutes: { min: 60, max: 120 },
              is_demo: true,
              location: { lat: 19.06, lng: 72.83 },
              contact: { address_text: 'x', contact_phone: null, contact_email: null, website: null, safeguarding_notes: '', description: '' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    renderAt({ pathname: '/go/11111111-1111-1111-1111-111111111111', state: { planned: 120, onScreen: 90 } });
    await userEvent.click(await screen.findByRole('button', { name: /putting my phone down/i }));
    const dialog = screen.getByRole('dialog', { name: /see you out there/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to directions/i })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
