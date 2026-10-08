/**
 * Round coordinates to 3 decimal places (~110 m). Applied to every user
 * location the server receives before it is used; precise coordinates are
 * never stored, logged or sent to the model.
 */
export function approximate(p: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
}
