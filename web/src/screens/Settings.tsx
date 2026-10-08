import { useState } from 'react';
import { Alert, Button, Card, PageTitle } from '../components/ui';
import { api } from '../lib/api';
import { useApp, type Settings as S } from '../lib/state';
import { readJSON } from '../lib/storage';

const TOGGLES: { key: keyof S; label: string; hint: string }[] = [
  { key: 'voiceReplies', label: 'Spoken replies', hint: 'Read the summary aloud after a search (ElevenLabs). Text is always shown too.' },
  { key: 'highContrast', label: 'High contrast', hint: 'Stronger colours and borders.' },
  { key: 'largeText', label: 'Larger text', hint: 'Increase text size across Ayuda.' },
  { key: 'reduceMotion', label: 'Reduce motion', hint: 'Turn off animations. Your system setting is respected automatically.' },
];

export function Settings() {
  const { settings, updateSettings, demo, setDemo, forgetVolunteer, setLocation } = useApp();
  const [deleted, setDeleted] = useState<string | null>(null);

  async function deleteData() {
    const token = readJSON<string | null>('ayuda.volunteer', null);
    try {
      if (token) await api.deleteMe(token);
      forgetVolunteer();
      setLocation(null);
      setDeleted('Your volunteering history has been deleted from Ayuda and this device.');
    } catch (e) {
      setDeleted(`Couldn't delete right now: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <PageTitle>Settings & privacy</PageTitle>
      <Card>
        <h2 className="text-xl font-bold text-forest">Accessibility & voice</h2>
        <ul className="mt-3 flex flex-col gap-4">
          {TOGGLES.map((t) => (
            <li key={t.key}>
              <label className="flex min-h-12 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings[t.key]}
                  onChange={(e) => updateSettings({ [t.key]: e.target.checked })}
                  className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-forest)]"
                  aria-describedby={`${t.key}-hint`}
                />
                <span>
                  <span className="block font-bold">{t.label}</span>
                  <span id={`${t.key}-hint`} className="text-muted">
                    {t.hint}
                  </span>
                </span>
              </label>
            </li>
          ))}
          <li>
            <label className="flex min-h-12 cursor-pointer items-start gap-3">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-forest)]" />
              <span>
                <span className="block font-bold">Demo Mode</span>
                <span className="text-muted">Show fictional, clearly labelled organisations around Bandra, Mumbai.</span>
              </span>
            </label>
          </li>
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="text-xl font-bold text-forest">What Ayuda does with your data</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Location</strong> is asked for only after you choose to share it, rounded to about 100 m on your device, used for one search, and never
            stored or shared with organisations or the AI model.
          </li>
          <li>
            <strong>Voice</strong> recordings go to ElevenLabs for transcription and are not stored by Ayuda. You can always type instead.
          </li>
          <li>
            <strong>Your words</strong> are interpreted by Gemma 3 4B, an open-weight model run by Ayuda's server. It sees your request text, never your
            location or identity.
          </li>
          <li>
            <strong>History</strong> is linked to a random anonymous code on this device. There is no account, name, phone number or email.
          </li>
          <li>
            <strong>Organisations</strong> come from Ayuda's database, never from the AI. Only verified organisations appear by default, and only verified
            organisations' contact details are shown.
          </li>
          <li>
            <strong>Money</strong>: Ayuda never asks you to donate.
          </li>
        </ul>
        <Button variant="danger" className="mt-5" onClick={deleteData}>
          Delete my history and data
        </Button>
        {deleted && (
          <div className="mt-3">
            <Alert>{deleted}</Alert>
          </div>
        )}
      </Card>
    </>
  );
}
