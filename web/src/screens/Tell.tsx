import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuickBuilder } from '../components/QuickBuilder';
import { Alert, Button, PageTitle } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { MIC_MESSAGES, startRecording, type MicError, type Recording } from '../lib/recorder';
import { useApp, useSearchLocation } from '../lib/state';

type Phase = 'idle' | 'recording' | 'transcribing';

export function Tell() {
  const { config, setRequest, setResults, request } = useApp();
  const where = useSearchLocation();
  const navigate = useNavigate();
  const [text, setText] = useState(request?.kind === 'text' ? request.text : '');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcribed, setTranscribed] = useState(false);
  const recording = useRef<Recording | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const voiceAvailable = config?.voice.available ?? false;

  useEffect(() => () => recording.current?.cancel(), []);

  async function stop() {
    const rec = recording.current;
    recording.current = null;
    if (!rec) return;
    setPhase('transcribing');
    try {
      const audio = await rec.stop();
      const { text: heard } = await api.transcribe(audio);
      setText(heard);
      setTranscribed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "I couldn't transcribe that. Please type instead.");
      textRef.current?.focus();
    } finally {
      setPhase('idle');
    }
  }

  async function toggleMic() {
    setError(null);
    if (phase === 'recording') return stop();
    try {
      recording.current = await startRecording(() => void stop());
      setPhase('recording');
    } catch (err) {
      setError(MIC_MESSAGES[(typeof err === 'string' ? err : 'failed') as MicError]);
      textRef.current?.focus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 3) {
      setError('Tell Ayuda a little about your time or skills first.');
      textRef.current?.focus();
      return;
    }
    setRequest({ kind: 'text', text: t });
    setResults(null);
    navigate(where ? '/results' : '/location');
  }

  return (
    <>
      <PageTitle sub="Your time, your skills, who you'd like to help. Speak naturally or type.">Tell Ayuda How You Can Help</PageTitle>

      <div className="flex flex-col items-center gap-3 py-4">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!voiceAvailable || phase === 'transcribing'}
          aria-pressed={phase === 'recording'}
          aria-describedby="mic-hint"
          className={`flex h-36 w-36 items-center justify-center rounded-full text-6xl shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            phase === 'recording' ? 'recording bg-marigold text-ink' : 'bg-forest text-white hover:bg-[#0f2c22]'
          }`}
        >
          <span aria-hidden>{phase === 'recording' ? '■' : '🎙'}</span>
          <span className="sr-only">{phase === 'recording' ? 'Stop recording' : 'Start recording'}</span>
        </button>
        <p id="mic-hint" className="text-center text-muted" aria-live="polite">
          {!voiceAvailable
            ? 'Voice is not available right now. Type below instead.'
            : phase === 'recording'
              ? 'Listening… tap again when you are done (30 seconds max).'
              : phase === 'transcribing'
                ? 'Transcribing with ElevenLabs…'
                : 'Tap the microphone and speak. Audio is not stored.'}
        </p>
      </div>

      {error && <Alert tone="warn">{error}</Alert>}

      <details className="mt-2 rounded-3xl border border-line bg-card p-5" open={!voiceAvailable}>
        <summary className="cursor-pointer text-lg font-bold text-forest">Or tap to build it (no typing)</summary>
        <div className="mt-4">
          <QuickBuilder
            onChange={(sentence) => {
              setText(sentence);
              setTranscribed(false);
            }}
          />
        </div>
      </details>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label htmlFor="request" className="text-lg font-bold">
          {transcribed ? 'Here is what I heard. Edit it if anything is wrong:' : 'Your request (type or edit)'}
        </label>
        <textarea
          id="request"
          ref={textRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTranscribed(false);
          }}
          rows={4}
          maxLength={600}
          placeholder="e.g. I have an hour on Saturday morning and can help with cooking."
          className="w-full rounded-2xl border-2 border-line bg-card p-4 text-lg focus:border-forest"
        />
        <Button type="submit" variant="primary" className="min-h-14 text-lg" disabled={phase !== 'idle'}>
          Find ways to help nearby
        </Button>
      </form>

    </>
  );
}
