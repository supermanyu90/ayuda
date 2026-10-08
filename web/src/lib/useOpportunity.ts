import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { useSearchLocation } from './state';
import type { OpportunityDetail } from './types';

export function useOpportunity(id: string | undefined) {
  const where = useSearchLocation();
  const [data, setData] = useState<OpportunityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    api.opportunity(id, where ? { lat: where.lat, lng: where.lng } : null).then(
      (d) => live && setData(d),
      (e) => live && setError(e instanceof ApiError && e.status === 404 ? 'This opportunity is no longer listed.' : (e as Error).message),
    );
    return () => {
      live = false;
    };
  }, [id, where?.lat, where?.lng]);
  return { data, error };
}
