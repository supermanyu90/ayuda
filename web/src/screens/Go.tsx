import { Link, useLocation, useParams } from 'react-router-dom';
import { formatDuration } from '../lib/screenTime';
import { Alert, Card, DemoBadge, PageTitle, Spinner, buttonStyles } from '../components/ui';
import { useOpportunity } from '../lib/useOpportunity';

/** Screen-exit mode: everything needed to leave the app and go help. No feeds, no loops. */
export function Go() {
  const { id } = useParams();
  const { data: o, error } = useOpportunity(id);
  const plan = useLocation().state as { planned?: number; onScreen?: number } | null;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!o) return <Spinner label="Loading…" />;
  if (!o.contact) return <Alert tone="warn">Contact details are only shared for verified organisations.</Alert>;

  const dest = `${o.location.lat},${o.location.lng}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  const osm = `https://www.openstreetmap.org/directions?to=${encodeURIComponent(dest)}`;
  const tel = o.contact.contact_phone?.replace(/[^\d+]/g, '');

  return (
    <>
      <PageTitle sub="Your next step is outside the app.">You're ready to help.</PageTitle>

      {plan?.planned && plan.onScreen !== undefined && plan.onScreen > 0 && (
        <p className="mb-5 rounded-2xl bg-marigold-soft px-4 py-3 text-lg">
          You spent <strong>{formatDuration(plan.onScreen)}</strong> on your screen to plan <strong>{plan.planned} minutes</strong> out in the world.
          {plan.planned * 60 > plan.onScreen && (
            <>
              {' '}
              That's <strong>{Math.round((plan.planned * 60) / plan.onScreen)}×</strong> more time with people than with your phone.
            </>
          )}
        </p>
      )}

      {o.is_demo && (
        <div className="mb-4">
          <Alert tone="warn">
            <DemoBadge /> This is a fictional demo organisation: the address, phone and email are not real.
          </Alert>
        </div>
      )}

      <Card className="border-forest">
        <h2 className="text-2xl font-bold text-forest">{o.title}</h2>
        <p className="text-lg">{o.organisation_name}</p>
        <dl className="mt-4 grid gap-3">
          <div>
            <dt className="text-sm text-muted">Where</dt>
            <dd className="font-bold">{o.contact.address_text}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">What</dt>
            <dd>{o.activity}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">When</dt>
            <dd className="font-bold">
              <span className="capitalize">{o.days.length === 7 ? 'Any day' : o.days.join(', ')} · {o.times_of_day.join(', ')}</span> · {o.minutes.min}–
              {o.minutes.max} min
            </dd>
          </div>
          {o.contact.safeguarding_notes && (
            <div>
              <dt className="text-sm text-muted">Safeguarding</dt>
              <dd>{o.contact.safeguarding_notes}</dd>
            </div>
          )}
        </dl>
      </Card>

      <div className="mt-5 flex flex-col gap-3">
        <a href={directions} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.accent} min-h-16 text-xl`}>
          🚶 Go Help: get directions
        </a>
        <div className="grid gap-3 sm:grid-cols-2">
          {tel && (
            <a href={`tel:${tel}`} className={buttonStyles.secondary}>
              Call {o.contact.contact_phone}
            </a>
          )}
          {o.contact.contact_email && (
            <a href={`mailto:${o.contact.contact_email}`} className={buttonStyles.secondary}>
              Email the organisation
            </a>
          )}
        </div>
        <a href={osm} target="_blank" rel="noopener noreferrer" className="text-center text-forest underline">
          Directions in OpenStreetMap instead
        </a>
      </div>

      <p className="mt-10 text-center text-lg text-muted">
        That's all. Put your phone away. When you're back, you can{' '}
        <Link to="/history" className="font-bold text-forest underline">
          mark it done
        </Link>
        .
      </p>
    </>
  );
}
