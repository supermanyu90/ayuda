import type { Quote } from '../lib/quotes';

export function QuoteCard({ quote, tone = 'paper' }: { quote: Quote; tone?: 'paper' | 'forest' }) {
  const dark = tone === 'forest';
  return (
    <figure className={`rise-in rounded-3xl px-6 py-5 ${dark ? 'bg-forest text-white' : 'border border-line bg-card'}`}>
      <blockquote className={`font-display text-xl font-bold leading-snug ${dark ? 'text-white' : 'text-forest'}`}>
        <span aria-hidden className="mr-1 text-marigold">“</span>
        {quote.text}
        <span aria-hidden className="ml-0.5 text-marigold">”</span>
      </blockquote>
      <figcaption className={`mt-2 text-sm ${dark ? 'text-white/80' : 'text-muted'}`}>
        <span className="font-bold">{quote.author}</span>, {quote.source}
      </figcaption>
    </figure>
  );
}
