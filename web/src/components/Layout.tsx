import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../lib/state';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/history', label: 'My volunteering' },
  { to: '/settings', label: 'Settings & privacy' },
];

export function Layout() {
  const { demo, setDemo } = useApp();
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:font-bold">
        Skip to content
      </a>
      {demo && (
        <div className="bg-demo px-4 py-2 text-center text-sm font-bold text-white">
          Demo Mode: fictional organisations around Bandra, Mumbai.{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => setDemo(false)}>
            Switch to real mode
          </button>
        </div>
      )}
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-display text-2xl font-extrabold text-forest" aria-label="Ayuda home">
            <svg aria-hidden width="30" height="30" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="15" fill="var(--color-forest)" />
              <path d="M9 17c3 4 11 4 14 0" stroke="var(--color-marigold)" strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx="16" cy="10" r="3" fill="var(--color-marigold)" />
            </svg>
            Ayuda
          </NavLink>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-1 text-[0.95rem]">
              {nav.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end
                    className={({ isActive }) =>
                      `inline-flex min-h-11 items-center rounded-xl px-3 font-bold ${isActive ? 'bg-forest-soft text-forest' : 'text-muted hover:text-forest'}`
                    }
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" key={pathname} className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-sm text-muted">
        Ayuda never asks for money. Language understanding by Gemma 3 4B (open-weight). Voice by ElevenLabs. Maps © OpenStreetMap contributors.{' '}
        <NavLink to="/admin" className="underline">
          Organisation admin
        </NavLink>
      </footer>
    </div>
  );
}
