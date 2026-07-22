// api/resolver-ambiguo.js — resuelve una desambiguación de pedido con texto libre.
// ============================================================================
// Cuando el pedido por voz/foto queda "ambiguo" (ej: el cliente dijo "chocolate"
// y hay varios), el portal le muestra 2-5 opciones candidatas. El cliente puede
// tocar una (sin llamar acá) o escribir/decir su respuesta con sus propias
// palabras ("el nestlé", "el más barato", "el segundo", "ninguno") — para eso
// está este endpoint: manda esa respuesta + las opciones YA acotadas a Claude,
// que sólo tiene que elegir entre ellas (no vuelve a tocar el catálogo entero,
// así que no hay riesgo de que "se vaya" a un producto no relacionado).
//
// Seguridad: requiere sesión de portal válida, igual que voz-pedido/foto-pedido
// (evita que cualquiera gaste llamadas a Claude sin ser cliente logueado).
//
// POST /api/resolver-ambiguo   headers: Authorization: Bearer <token>
//   body: { texto, opciones:[{productId,nombre,unidad,precio}] }
//   → 200 { ok, productId: string|null }   (null = no eligió ninguna)
// ============================================================================

import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';
import { resolverOpcionLibre } from './_wa-interpret.js';

// Rate limit: máx 30 respuestas por IP por minuto (llamada chica pero sigue
// gastando 1 request a Claude por vez).
const _rl = new Map();
function _checkRate(ip) {
  const now = Date.now();
  const recent = (_rl.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 30) return false;
  recent.push(now);
  _rl.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate(ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  // ── Sesión requerida (mismo patrón que voz-pedido / foto-pedido) ──
  const session = await validatePortalSession(getBearerToken(req));
  if (!session) return res.status(401).json({ error: 'Sesión requerida' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const texto = String(body?.texto || '').trim();
  const opciones = Array.isArray(body?.opciones) ? body.opciones : [];

  if (!texto || opciones.length === 0) return res.status(200).json({ ok: true, productId: null });
  if (texto.length > 300) return res.status(400).json({ error: 'Texto demasiado largo' });
  if (opciones.length > 5) return res.status(400).json({ error: 'Demasiadas opciones' });

  // Saneamos las opciones: sólo lo que necesita el resolver, nada del body pasa
  // directo a Claude salvo el texto y estos campos ya validados como strings/números.
  const opcionesSanas = opciones
    .filter(o => o && typeof o.productId === 'string' && o.productId)
    .map(o => ({
      productId: o.productId,
      nombre: String(o.nombre || '').slice(0, 200),
      unidad: String(o.unidad || 'un').slice(0, 40),
      precio: Number(o.precio) || 0,
    }));
  if (opcionesSanas.length === 0) return res.status(200).json({ ok: true, productId: null });

  try {
    const r = await resolverOpcionLibre({ texto, opciones: opcionesSanas });
    if (!r.ok) {
      const code = r.error || 'resolver_error';
      const status = code === 'anthropic_not_configured' ? 503 : 502;
      return res.status(status).json({ error: code });
    }
    return res.status(200).json({ ok: true, productId: r.productId });
  } catch (err) {
    console.error('[resolver-ambiguo] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
