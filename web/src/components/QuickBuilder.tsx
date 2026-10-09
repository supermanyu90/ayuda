import { useState } from 'react';

// Tap-to-build: a request in four or five taps instead of typing. The output is a
// plain sentence, so it goes through exactly the same Gemma pipeline as speech.

const DURATIONS = [
  ['30 minutes', '30 minutes'],
  ['1 hour', 'an hour'],
  ['2 hours', '2 hours'],
  ['Half a day', '4 hours'],
] as const;
const DAYS = [
  ['Today', 'today'],
  ['Tomorrow', 'tomorrow'],
  ['Saturday', 'on Saturday'],
  ['Sunday', 'on Sunday'],
] as const;
const TIMES = [
  ['Morning', 'morning'],
  ['Afternoon', 'afternoon'],
  ['Evening', 'evening'],
] as const;
const WHO = [
  ['🧒 Children', 'children'],
  ['🧓 Elderly people', 'elderly people'],
  ['🐾 Animals', 'animals'],
  ['🌳 The environment', 'the environment'],
  ['🏠 Homeless people', 'homeless people'],
  ['♿ People with disabilities', 'people with disabilities'],
] as const;
const SKILLS = [
  ['📚 Teach', 'teach'],
  ['🍲 Cook', 'cook'],
  ['📱 Help with phones & computers', 'help with phones and computers'],
  ['💪 Physical work', 'do physical work'],
  ['💬 Keep someone company', 'keep someone company'],
  ['🚗 Drive', 'drive'],
] as const;

export interface Picks {
  duration?: string;
  day?: string;
  time?: string;
  who: string[];
  skills: string[];
  noMoney: boolean;
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

function when(day?: string, time?: string): string {
  if (day && time) return day === 'today' ? `this ${time}` : `${day} ${time}`;
  if (day) return day;
  if (time) return `in the ${time}`;
  return '';
}

export function compose(p: Picks): string {
  const parts: string[] = [];
  const w = when(p.day, p.time);
  if (p.duration || w) parts.push(`I have ${p.duration ?? 'some time'}${w ? ` ${w}` : ''}.`);
  if (p.skills.length) parts.push(`I can ${list(p.skills)}.`);
  if (p.who.length) parts.push(`I'd like to help ${list(p.who)}.`);
  if (p.noMoney) parts.push("I don't want to donate money.");
  return parts.join(' ');
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-bold text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border-2 px-4 font-bold ${on ? 'border-forest bg-forest text-white' : 'border-line bg-card text-ink hover:border-forest'}`}
    >
      {children}
    </button>
  );
}

export function QuickBuilder({ onChange }: { onChange: (sentence: string) => void }) {
  const [p, setP] = useState<Picks>({ who: [], skills: [], noMoney: false });
  const update = (next: Picks) => {
    setP(next);
    onChange(compose(next));
  };
  const one = (key: 'duration' | 'day' | 'time', value: string) => update({ ...p, [key]: p[key] === value ? undefined : value });
  const many = (key: 'who' | 'skills', value: string) =>
    update({ ...p, [key]: p[key].includes(value) ? p[key].filter((x) => x !== value) : [...p[key], value] });

  return (
    <div className="flex flex-col gap-4">
      <Group label="How long?">
        {DURATIONS.map(([label, v]) => (
          <Chip key={v} on={p.duration === v} onClick={() => one('duration', v)}>
            {label}
          </Chip>
        ))}
      </Group>
      <Group label="When?">
        {DAYS.map(([label, v]) => (
          <Chip key={v} on={p.day === v} onClick={() => one('day', v)}>
            {label}
          </Chip>
        ))}
        {TIMES.map(([label, v]) => (
          <Chip key={v} on={p.time === v} onClick={() => one('time', v)}>
            {label}
          </Chip>
        ))}
      </Group>
      <Group label="Who would you like to help?">
        {WHO.map(([label, v]) => (
          <Chip key={v} on={p.who.includes(v)} onClick={() => many('who', v)}>
            {label}
          </Chip>
        ))}
      </Group>
      <Group label="What can you do?">
        {SKILLS.map(([label, v]) => (
          <Chip key={v} on={p.skills.includes(v)} onClick={() => many('skills', v)}>
            {label}
          </Chip>
        ))}
      </Group>
      <Group label="Money">
        <Chip on={p.noMoney} onClick={() => update({ ...p, noMoney: !p.noMoney })}>
          🙅 No donations, just my time
        </Chip>
      </Group>
    </div>
  );
}
