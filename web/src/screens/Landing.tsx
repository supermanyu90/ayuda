import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink, Card } from '../components/ui';
import { useApp, useSearchLocation } from '../lib/state';

export function Landing() {
  const { config, configError, demo, setDemo, setRequest, setResults } = useApp();
  const where = useSearchLocation();
  const navigate = useNavigate();

  const quick = () => {
    setRequest({ kind: 'quick', minutes: 30 });
    setResults(null);
    navigate(where ? '/results' : '/location');
  };

  return (
    <>
      <section className="pt-2">
        <p className="mb-3 inline-flex rounded-full bg-marigold-soft px-3 py-1 text-sm font-bold text-[#7a4b00]">No money needed. Just your time.</p>
        <h1 className="text-[2.6rem] font-extrabold leading-[1.02] text-forest sm:text-6xl">
          Give your time.
          <br />
          Find where it matters.
        </h1>
        <p className="mt-4 max-w-xl text-xl text-muted">
          Say what you can offer: an hour, a skill, a cause you care about. Ayuda finds verified places nearby that need exactly that, and then gets out of
          your way.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/tell" variant="primary" className="min-h-16 text-lg" onClick={() => setResults(null)}>
            <span aria-hidden>🎙</span> Tell Ayuda How You Can Help
          </ButtonLink>
          <Button variant="secondary" className="min-h-16 text-lg" onClick={quick}>
            I Have 30 Minutes
          </Button>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label="Service status">
          {configError && <li className="text-danger">Can't reach the Ayuda server.</li>}
          {config && (
            <>
              <li>{config.gemma.available ? `● Gemma (${config.gemma.model}) live` : '○ Gemma offline: using basic keyword matching'}</li>
              <li>{config.voice.available ? '● Voice available' : '○ Voice off: type instead'}</li>
            </>
          )}
        </ul>
      </section>

      <Card className="mt-10">
        <h2 className="text-xl font-bold text-forest">How it works</h2>
        <ol className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            ['Say it', 'Speak or type: "Two hours on Sunday, I can teach English to kids."'],
            ['See what fits', 'Verified places nearby, ranked by distance, time, skills and who you want to help.'],
            ['Go help', 'Directions, contact and what to expect. Then put your phone away.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest font-display font-bold text-white">
                {i + 1}
              </span>
              <span>
                <strong className="block">{t}</strong>
                <span className="text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-forest">Demo Mode</h2>
            <p className="text-muted">
              {demo
                ? 'On: fictional organisations around Bandra, Mumbai, clearly labelled.'
                : 'Off: only real, verified organisations near you.'}
            </p>
          </div>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-3 font-bold">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-forest)]" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Demo Mode
          </label>
        </div>
      </Card>
    </>
  );
}
