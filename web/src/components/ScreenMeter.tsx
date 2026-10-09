import { useEffect, useState } from 'react';
import { screenSeconds } from '../lib/screenTime';

/** Ayuda's own target: a plan should take less than two minutes of screen time. */
export const TARGET_SECONDS = 120;
export const NUDGE_SECONDS = 300;

export function useScreenSeconds(): number {
  const [s, setS] = useState(screenSeconds);
  useEffect(() => {
    const t = setInterval(() => setS(screenSeconds()), 1000);
    return () => clearInterval(t);
  }, []);
  return s;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function ScreenMeter({ seconds }: { seconds: number }) {
  const over = seconds > TARGET_SECONDS;
  const progress = Math.min(seconds / TARGET_SECONDS, 1);
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Screen time for this plan: ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds. Ayuda aims for under 2 minutes.`}
      title="Ayuda aims to get you planned in under 2 minutes"
      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-bold ${over ? 'bg-marigold-soft text-[#7a4b00]' : 'bg-forest-soft text-forest'}`}
    >
      <svg aria-hidden width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
        <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="tabular-nums">{clock(seconds)}</span>
      <span className="font-normal">{over ? 'on screen' : 'of 2:00'}</span>
    </div>
  );
}
