// api/geo.js — Detección de país por IP (header de Vercel).
// Público, sin auth. Lo usa el wizard de alta para pre-seleccionar el país del
// nuevo distribuidor (y con él su moneda/impuesto) sin que tenga que buscarlo.
// Devuelve el código ISO-2 (ej. 'UY', 'PE'). Si Vercel no lo provee → ''.
import { setCorsHeaders } from './_cors.js';

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel inyecta el país del visitante en este header (ISO-3166-1 alpha-2).
  const raw = req.headers['x-vercel-ip-country'] || '';
  const country = String(raw).trim().toUpperCase().slice(0, 2);

  // No cachear por CDN: el país depende de quién pide, no de la URL.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ country: /^[A-Z]{2}$/.test(country) ? country : '' });
}
