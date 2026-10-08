import type { MatchResponse, OpportunityDetail, Place, PublicConfig, Summary, VolunteerAction } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        ...(rest.body && !(rest.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError(0, 'network', "Can't reach Ayuda. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    const fallback =
      res.status === 429 ? 'Too many requests. Please wait a moment.' : res.status >= 500 ? 'Ayuda is temporarily unavailable.' : 'Something went wrong.';
    throw new ApiError(res.status, body.error ?? 'error', body.message ?? fallback);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);
export interface LatLng {
  lat: number;
  lng: number;
}

export const api = {
  config: () => call<PublicConfig>('/api/config'),
  match: (body: { text: string; location: LatLng; radius_km: number; demo: boolean }) =>
    call<MatchResponse>('/api/match', { method: 'POST', body: json(body) }),
  quick: (body: { location: LatLng; radius_km: number; demo: boolean; minutes?: number }) =>
    call<MatchResponse>('/api/match/quick', { method: 'POST', body: json(body) }),
  opportunity: (id: string, from?: LatLng | null) =>
    call<OpportunityDetail>(`/api/opportunities/${encodeURIComponent(id)}${from ? `?lat=${from.lat}&lng=${from.lng}` : ''}`),
  geocode: (q: string) => call<{ places: Place[] }>(`/api/geocode?q=${encodeURIComponent(q)}`),
  transcribe: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'request.webm');
    return call<{ text: string; language: string | null }>('/api/voice/transcribe', { method: 'POST', body: form });
  },
  summary: (id: string) => call<Summary>(`/api/summary/${encodeURIComponent(id)}`),
  /** Streaming MP3 URL for an <audio> element: playback starts on the first chunk. */
  speechUrl: (summaryId: string) => `${BASE}/api/voice/speak/${encodeURIComponent(summaryId)}`,

  volunteerSession: () => call<{ token: string }>('/api/volunteer/session', { method: 'POST' }),
  actions: (token: string) =>
    call<{ actions: VolunteerAction[]; completed_minutes: number; screen_minutes: number; world_minutes_per_screen_minute: number | null }>(
      '/api/volunteer/actions',
      { token },
    ),
  commit: (token: string, opportunity_id: string, planned_minutes: number, screen_seconds: number) =>
    call<{ id: string }>('/api/volunteer/actions', { method: 'POST', token, body: json({ opportunity_id, planned_minutes, screen_seconds }) }),
  setActionStatus: (token: string, id: string, status: 'completed' | 'cancelled') =>
    call<{ ok: boolean }>(`/api/volunteer/actions/${id}`, { method: 'PATCH', token, body: json({ status }) }),
  deleteMe: (token: string) => call<void>('/api/volunteer/me', { method: 'DELETE', token }),

  admin: {
    organisations: (token: string) => call<{ organisations: AdminOrganisation[] }>('/api/admin/organisations', { token }),
    createOrganisation: (token: string, body: unknown) =>
      call<{ id: string }>('/api/admin/organisations', { method: 'POST', token, body: json(body) }),
    setVerification: (token: string, id: string, status: string, note: string) =>
      call<{ ok: boolean }>(`/api/admin/organisations/${id}/verification`, { method: 'PATCH', token, body: json({ status, note }) }),
    extractNeed: (token: string, description: string) =>
      call<{ need: Record<string, unknown> | null; source: string; error?: string }>('/api/admin/extract-need', {
        method: 'POST',
        token,
        body: json({ description }),
      }),
    createOpportunity: (token: string, orgId: string, body: unknown) =>
      call<{ id: string }>(`/api/admin/organisations/${orgId}/opportunities`, { method: 'POST', token, body: json(body) }),
  },
};

export interface AdminOrganisation {
  id: string;
  name: string;
  category: string;
  description: string;
  locality: string;
  city: string;
  verification_status: 'VERIFIED' | 'PENDING' | 'UNVERIFIED';
  verification_note: string | null;
  is_demo: boolean;
  opportunities: number;
}
