import { useEffect, useRef } from 'react';
import type { Quote } from '../lib/quotes';

/** A calm, almost-empty screen to end on: the app's last job is to step aside. */
export function PhoneDown({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-down-title"
      className="rise-in fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-8 bg-forest px-6 text-center text-white"
    >
      <span aria-hidden className="text-6xl">🌿</span>
      <h2 id="phone-down-title" className="font-display text-4xl font-extrabold sm:text-5xl">
        See you out there.
      </h2>
      <p className="max-w-md text-lg text-white/85">You can lock your phone now. Ayuda will be here when you're back, and so will your directions.</p>
      <figure className="max-w-lg">
        <blockquote className="font-display text-xl font-bold">“{quote.text}”</blockquote>
        <figcaption className="mt-2 text-sm text-white/75">
          {quote.author}, {quote.source}
        </figcaption>
      </figure>
      <button ref={back} type="button" onClick={onClose} className="min-h-12 rounded-2xl border-2 border-white/60 px-5 font-bold text-white">
        Back to directions
      </button>
    </div>
  );
}
