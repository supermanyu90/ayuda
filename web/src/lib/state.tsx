import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type LatLng } from './api';
import { readJSON, remove, writeJSON } from './storage';
import type { MatchResponse, PublicConfig } from './types';

export interface UserLocation extends LatLng {
  label: string;
  source: 'gps' | 'manual' | 'demo';
}

export interface Settings {
  voiceReplies: boolean;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = { voiceReplies: true, highContrast: false, largeText: false, reduceMotion: false };

/** ~110 m precision. Applied before coordinates leave the device. */
export const approximate = (p: LatLng): LatLng => ({ lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 });

interface AppState {
  config: PublicConfig | null;
  configError: boolean;
  demo: boolean;
  setDemo: (on: boolean) => void;
  /** Kept in memory only: never written to storage. */
  location: UserLocation | null;
  setLocation: (l: UserLocation | null) => void;
  radius: number;
  setRadius: (r: number) => void;
  request: { kind: 'text'; text: string } | { kind: 'quick'; minutes: number } | null;
  setRequest: (r: AppState['request']) => void;
  results: MatchResponse | null;
  setResults: (r: MatchResponse | null) => void;
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  volunteerToken: () => Promise<string>;
  forgetVolunteer: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children, initialConfig }: { children: ReactNode; initialConfig?: PublicConfig }) {
  const [config, setConfig] = useState<PublicConfig | null>(initialConfig ?? null);
  const [configError, setConfigError] = useState(false);
  const [demo, setDemoState] = useState<boolean>(() => readJSON('ayuda.demo', true));
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [radius, setRadius] = useState(5);
  const [request, setRequest] = useState<AppState['request']>(null);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...readJSON('ayuda.settings', {}) }));

  useEffect(() => {
    if (initialConfig) return;
    api.config().then(setConfig, () => setConfigError(true));
  }, [initialConfig]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.text = settings.largeText ? 'large' : 'normal';
    root.dataset.motion = settings.reduceMotion ? 'reduce' : 'normal';
  }, [settings]);

  const setDemo = useCallback((on: boolean) => {
    setDemoState(on);
    writeJSON('ayuda.demo', on);
    setResults(null);
  }, []);

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      writeJSON('ayuda.settings', next);
      return next;
    });
  }, []);

  const volunteerToken = useCallback(async () => {
    const existing = readJSON<string | null>('ayuda.volunteer', null);
    if (existing) return existing;
    const { token } = await api.volunteerSession();
    writeJSON('ayuda.volunteer', token);
    return token;
  }, []);

  const forgetVolunteer = useCallback(() => remove('ayuda.volunteer'), []);

  const value = useMemo<AppState>(
    () => ({
      config,
      configError,
      demo,
      setDemo,
      location,
      setLocation,
      radius,
      setRadius,
      request,
      setRequest,
      results,
      setResults,
      settings,
      updateSettings,
      volunteerToken,
      forgetVolunteer,
    }),
    [config, configError, demo, setDemo, location, radius, request, results, settings, updateSettings, volunteerToken, forgetVolunteer],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Location used for search: the fixed demo centre in Demo Mode, else the user's. */
export function useSearchLocation(): UserLocation | null {
  const { demo, config, location } = useApp();
  if (demo && config) return { ...config.demo_centre, source: 'demo' };
  return location;
}
