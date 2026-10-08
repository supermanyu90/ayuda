import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, ButtonLink, Card, DemoBadge, PageTitle, Spinner } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { readJSON } from '../lib/storage';
import type { VolunteerAction } from '../lib/types';

export function History() {
  const [token] = useState(() => readJSON<string | null>('ayuda.volunteer', null));
  const [data, setData] = useState<{ actions: VolunteerAction[]; completed_minutes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    api.actions(token).then(setData, (e) => setError(e instanceof ApiError && e.status === 401 ? null : (e as Error).message));
  };
  useEffect(load, [token]);

  async function mark(id: string, status: 'completed' | 'cancelled') {
    try {
      await api.setActionStatus(token!, id, status);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle sub="Stored anonymously, only for this device. No name, phone number or location.">My volunteering</PageTitle>
      {error && <Alert tone="error">{error}</Alert>}
      {!token || (data && data.actions.length === 0) ? (
        <Card>
          <p className="text-lg">Nothing here yet. When you choose an opportunity and confirm, it will appear here.</p>
          <ButtonLink to="/tell" className="mt-4">
            Find a way to help
          </ButtonLink>
        </Card>
      ) : !data ? (
        <Spinner label="Loading…" />
      ) : (
        <>
          <Card className="mb-4 border-forest bg-forest-soft">
            <p className="text-sm font-bold text-muted">Time given in the real world</p>
            <p className="font-display text-5xl font-extrabold text-forest">
              {data.completed_minutes} <span className="text-2xl">minutes</span>
            </p>
          </Card>
          <ul className="flex flex-col gap-3">
            {data.actions.map((a) => (
              <li key={a.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${a.status === 'completed' ? 'bg-forest text-white' : a.status === 'cancelled' ? 'bg-line text-muted' : 'bg-marigold-soft text-[#7a4b00]'}`}>
                      {a.status === 'committed' ? 'Planned' : a.status === 'completed' ? 'Done' : 'Cancelled'}
                    </span>
                    {a.is_demo && <DemoBadge />}
                    <span className="text-sm text-muted">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold">
                    <Link to={`/opportunity/${a.opportunity_id}`} className="text-forest underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                  </h2>
                  <p className="text-muted">
                    {a.organisation_name} · {a.planned_minutes} minutes
                  </p>
                  {a.status === 'committed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => mark(a.id, 'completed')}>I did it</Button>
                      <Button variant="ghost" onClick={() => mark(a.id, 'cancelled')}>
                        Couldn't make it
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
