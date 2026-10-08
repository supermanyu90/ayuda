import { describe, expect, it, vi } from 'vitest';
import { formatDuration, resetScreenTimer, screenSeconds, startScreenTimer } from '../lib/screenTime';

describe('screen time', () => {
  it('counts only visible time and resets after a commitment', () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(0);
    startScreenTimer();
    resetScreenTimer();
    now.mockReturnValue(30_000);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    now.mockReturnValue(300_000); // 4.5 minutes in the background: not counted
    expect(screenSeconds()).toBe(30);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    now.mockReturnValue(310_000);
    expect(screenSeconds()).toBe(40);
    resetScreenTimer();
    expect(screenSeconds()).toBe(0);
    now.mockRestore();
    vi.useRealTimers();
  });

  it('formats durations for people', () => {
    expect(formatDuration(45)).toBe('45 seconds');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(112)).toBe('1 min 52 s');
  });
});
