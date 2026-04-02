// ─── rutas/utils.js — Pure utility functions (no React, no side effects) ────
// Importable anywhere without pulling in React or AppContext.

// ── Haversine distance (km) between two lat/lng points ───────────────────────
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Nearest-Neighbor greedy TSP with time-window respect ─────────────────────
// Returns a reordered copy of `entregas` minimizing total distance,
// while respecting horarioDesde/horarioHasta windows per stop.
//
// Algorithm:
//   1. Nearest-neighbor greedy ordering (distance-optimal)
//   2. Post-process: for each stop with a time window, check if the
//      estimated arrival (assuming 10 min/stop average) falls within it.
//      If not, find the earliest slot in the sequence that would work
//      and move the stop there. A stop with no window is never moved.
export function nearestNeighborTSP(entregas, clientes) {
  const toMins = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const withCoords = entregas.map(e => {
    const cli = clientes.find(c => c.id === e.clienteId);
    return {
      ...e,
      lat: cli?.lat ?? null,
      lng: cli?.lng ?? null,
      winFrom: toMins(e.horarioDesde || cli?.horarioDesde),
      winTo:   toMins(e.horarioHasta || cli?.horarioHasta),
    };
  });

  const geocoded   = withCoords.filter(e => e.lat !== null && e.lng !== null);
  const ungeocoded = withCoords.filter(e => e.lat === null || e.lng === null);

  if (geocoded.length <= 1) {
    const clean = e => { const {lat:_l,lng:_g,winFrom:_f,winTo:_t,...rest}=e; return rest; };
    return [...withCoords.map(clean)];
  }

  // Phase 1: nearest-neighbor greedy
  const visited = new Array(geocoded.length).fill(false);
  const ordered = [];
  let current = 0;
  visited[0] = true;
  ordered.push(geocoded[0]);

  for (let step = 1; step < geocoded.length; step++) {
    let nearest = -1, minDist = Infinity;
    for (let j = 0; j < geocoded.length; j++) {
      if (visited[j]) continue;
      const d = haversine(geocoded[current].lat, geocoded[current].lng, geocoded[j].lat, geocoded[j].lng);
      if (d < minDist) { minDist = d; nearest = j; }
    }
    visited[nearest] = true;
    ordered.push(geocoded[nearest]);
    current = nearest;
  }

  // Phase 2: respect time windows
  // Assume route starts now, ~10 min between stops (rough estimate for UY urban)
  const MINS_PER_STOP = 10;
  const startMins = new Date().getHours() * 60 + new Date().getMinutes();

  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    if (stop.winFrom === null && stop.winTo === null) continue;

    const arrivalMins = startMins + i * MINS_PER_STOP;
    const tooEarly = stop.winFrom !== null && arrivalMins < stop.winFrom;
    const tooLate  = stop.winTo   !== null && arrivalMins > stop.winTo;

    if (!tooEarly && !tooLate) continue;

    let bestPos = i;
    for (let j = i; j < ordered.length; j++) {
      const arr = startMins + j * MINS_PER_STOP;
      const ok = (stop.winFrom === null || arr >= stop.winFrom) &&
                 (stop.winTo   === null || arr <= stop.winTo);
      if (ok) { bestPos = j; break; }
    }

    if (bestPos !== i) {
      ordered.splice(i, 1);
      ordered.splice(bestPos, 0, stop);
    }
  }

  const clean = e => { const {lat:_l,lng:_g,winFrom:_f,winTo:_t,...rest}=e; return rest; };
  return [...ordered.map(clean), ...ungeocoded.map(clean)];
}

// ── Nominatim geocoder (OpenStreetMap, free, no API key) ─────────────────────
export async function geocodeAddress(direccion, ciudad) {
  const q = [direccion, ciudad, 'Uruguay'].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'AryesStock/1.0' } });
  const data = await res.json();
  if (data?.length > 0) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  return null;
}
