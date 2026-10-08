import { Link } from 'react-router-dom';
import type { MatchCard } from '../lib/types';
import { Chip, DemoBadge, VerificationBadge, pretty } from './ui';

export function OpportunityCard({ m, rank }: { m: MatchCard; rank: number }) {
  return (
    <article className="relative rounded-3xl border border-line bg-card p-5 transition-colors hover:border-forest">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest font-display font-bold text-white" aria-hidden>
          {rank}
        </span>
        <VerificationBadge status={m.verification_status} />
        {m.is_demo && <DemoBadge />}
        <span className="ml-auto rounded-full bg-marigold-soft px-3 py-0.5 text-sm font-bold text-[#7a4b00]" title="Deterministic match score">
          {m.score}% match
        </span>
      </div>
      <h3 className="mt-3 text-xl font-bold leading-snug">
        <Link to={`/opportunity/${m.opportunity_id}`} className="text-forest underline-offset-4 hover:underline after:absolute after:inset-0 after:rounded-3xl">
          {m.title}
        </Link>
      </h3>
      <p className="text-muted">
        {m.organisation_name} · {m.locality}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.95rem] sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted">Distance</dt>
          <dd className="font-bold">{m.distance_km.toFixed(1)} km</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Time needed</dt>
          <dd className="font-bold">
            {m.minutes.min}–{m.minutes.max} min
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Helps</dt>
          <dd className="font-bold capitalize">{m.beneficiaries.map(pretty).join(', ')}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Money</dt>
          <dd className="font-bold">{m.money_required ? 'Contribution asked' : 'None needed'}</dd>
        </div>
      </dl>
      {m.skills.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">
          {m.skills.map((s) => (
            <Chip key={s}>{pretty(s)}</Chip>
          ))}
        </p>
      )}
      <p className="mt-3 text-[0.95rem]">
        <span className="font-bold">Why: </span>
        {m.reasons.join(' · ')}
      </p>
      {m.missing_requirements.length > 0 && <p className="mt-1 text-[0.95rem] text-[#7a4b00]">Note: {m.missing_requirements.join('; ')}</p>}
    </article>
  );
}
