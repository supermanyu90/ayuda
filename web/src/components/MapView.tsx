import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../lib/api';
import type { MatchCard } from '../lib/types';
import { Alert } from './ui';

interface Props {
  centre: LatLng;
  radiusKm: number;
  matches: MatchCard[];
  onSelect: (id: string) => void;
}

/** Leaflet + OpenStreetMap tiles. The user is shown as an approximate area, never a precise pin. */
export function MapView({ centre, radiusKm, matches, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    let map: L.Map;
    try {
      map = L.map(el.current, { scrollWheelZoom: false });
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      let tileErrors = 0;
      tiles.on('tileerror', () => {
        if (++tileErrors > 6) setFailed(true);
      });
      L.circle([centre.lat, centre.lng], { radius: 400, color: '#f2a516', fillOpacity: 0.25, weight: 2 })
        .addTo(map)
        .bindTooltip('Your approximate area');
      L.circle([centre.lat, centre.lng], { radius: radiusKm * 1000, color: '#173c2f', fill: false, weight: 1, dashArray: '6 6' }).addTo(map);
      matches.forEach((m, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#173c2f;color:#fff;font-weight:700;border:3px solid #f2a516">${i + 1}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        L.marker([m.location.lat, m.location.lng], { icon, title: `${i + 1}. ${m.title}, ${m.organisation_name}`, keyboard: true })
          .addTo(map)
          .on('click', () => onSelect(m.opportunity_id))
          .on('keypress', (e: L.LeafletKeyboardEvent) => e.originalEvent.key === 'Enter' && onSelect(m.opportunity_id));
      });
      const bounds = L.latLngBounds([[centre.lat, centre.lng], ...matches.map((m) => [m.location.lat, m.location.lng] as [number, number])]);
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
    } catch {
      setFailed(true);
      return;
    }
    return () => {
      map.remove();
    };
  }, [centre.lat, centre.lng, radiusKm, matches, onSelect]);

  if (failed) return <Alert tone="warn">The map couldn't load. The list view has everything you need.</Alert>;
  return (
    <div
      ref={el}
      className="h-[420px] w-full border border-line"
      role="region"
      aria-label={`Map of ${matches.length} opportunities. Numbered markers match the list order.`}
    />
  );
}
