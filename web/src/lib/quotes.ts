// Short quotes about helping, limited to ones with well-documented sources
// (kindness quotes are very often misattributed online).

export interface Quote {
  text: string;
  author: string;
  source: string;
}

export const QUOTES: Quote[] = [
  {
    text: 'Everybody can be great, because everybody can serve.',
    author: 'Martin Luther King Jr.',
    source: '“The Drum Major Instinct”, 1968',
  },
  {
    text: "Life's most persistent and urgent question is, 'What are you doing for others?'",
    author: 'Martin Luther King Jr.',
    source: 'Montgomery, Alabama, 1957',
  },
  {
    text: 'How wonderful it is that nobody need wait a single moment before starting to improve the world.',
    author: 'Anne Frank',
    source: '“Give!”, 1944',
  },
  {
    text: 'Alone we can do so little; together we can do so much.',
    author: 'Helen Keller',
    source: 'as quoted by Joseph P. Lash, 1980',
  },
  {
    text: 'They alone live who live for others.',
    author: 'Swami Vivekananda',
    source: 'Letters of Swami Vivekananda',
  },
  {
    text: 'Many hands make light work.',
    author: 'English proverb',
    source: 'recorded by John Heywood, 1546',
  },
];

/** A stable quote per context, so the screen doesn't change under the reader. */
export function quoteFor(context: string): Quote {
  let h = 0;
  for (const ch of context) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return QUOTES[h % QUOTES.length]!;
}
