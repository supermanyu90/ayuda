// Measures how long Ayuda is actually on screen (visible tab only) between the
// start of a plan and committing to go. This is the product's success metric:
// real-world minutes generated per minute spent in Ayuda. Measured on-device;
// only the final number of seconds is sent with the commitment.

const KEY = 'ayuda.screenMs';
let visibleSince: number | null = null;
let accumulated = 0;

function load() {
  try {
    accumulated = Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    accumulated = 0;
  }
}

function save() {
  try {
    sessionStorage.setItem(KEY, String(accumulated));
  } catch {
    /* session storage unavailable: keep in memory */
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    visibleSince = performance.now();
  } else if (visibleSince !== null) {
    accumulated += performance.now() - visibleSince;
    visibleSince = null;
    save();
  }
}

let started = false;
export function startScreenTimer() {
  if (started) return;
  started = true;
  load();
  if (document.visibilityState === 'visible') visibleSince = performance.now();
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', () => {
    onVisibility();
    save();
  });
}

export function screenSeconds(): number {
  const live = visibleSince !== null ? performance.now() - visibleSince : 0;
  return Math.round((accumulated + live) / 1000);
}

/** Called after a commitment: the next plan starts from zero. */
export function resetScreenTimer() {
  accumulated = 0;
  visibleSince = document.visibilityState === 'visible' ? performance.now() : null;
  save();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
