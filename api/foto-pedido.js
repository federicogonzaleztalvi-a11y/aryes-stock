// api/foto-pedido.js — "Pedido por foto" del portal B2B (estilo Zapia).
// ============================================================================
// El cliente le saca una foto a su lista de compra (escrita a mano o impresa) y
// este endpoint la convierte en líneas de carrito. Claude (visión) LEE la lista
// y la matchea contra el catálogo con los precios de ESE cliente, usando el MISMO
// motor que el pedido por voz y el bot de WhatsApp (interpretarPedido).
//
// Vive dentro del portal que controlamos (no depende de WhatsApp).
//
// Seguridad: requiere sesión de portal válida. org_id y cliente_id se DERIVAN de
// la sesión, nunca del body/query (defensa IDOR / cross-tenant), igual que
// api/voz-pedido.js.
//
// POST /api/foto-pedido   body: { imagen: { media_type, data } }   Authorization: Bearer <token>
//   → 200 { ok, lineas:[...], sinPrecio:[...], sinMatch:[...] }
// ============================================================================

import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';
import { getCatalogoCliente } from './_catalog.js';
import { interpretarPedido } from './_wa-interpret.js';

const MIMES_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Vercel limita el body a ~4.5MB. El cliente comprime la foto antes de subir
// (~1600px, jpeg) → suele quedar en cientos de KB. Cortamos en ~3MB de base64
// (≈2.2MB reales) para entrar holgado y frenar payloads abusivos.
const MAX_B64 = 3_000_000;

// Rate limit: máx 15 fotos por IP por minuto (cada una gasta 1 llamada a Claude).
const _rl = new Map();
function _checkRate(ip) {
  const now = Date.now();
  const recent = (_rl.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 15) return false;
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

  // ── Sesión requerida: precios personalizados = dato privado del tenant ──
  const session = await validatePortalSession(getBearerToken(req));
  if (!session) return res.status(401).json({ error: 'Sesión requerida' });
  const org       = String(session.org_id || '').replace(/[^a-z0-9_-]/gi, '');
  const clienteId = String(session.cliente_id || '');
  if (!org || !clienteId) return res.status(401).json({ error: 'Sesión inválida' });

  // ── Body: la imagen en base64 ──
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const media_type = String(body?.imagen?.media_type || 'image/jpeg');
  const data       = String(body?.imagen?.data || '');
  if (!data)                       return res.status(400).json({ error: 'Falta la imagen' });
  if (!MIMES_OK.includes(media_type)) return res.status(400).json({ error: 'Formato de imagen no soportado' });
  if (data.length > MAX_B64)       return res.status(413).json({ error: 'La imagen es demasiado grande' });

  try {
    // Catálogo con la lista del cliente (misma fuente de verdad que portal y voz).
    let catalogo;
    try {
      catalogo = await getCatalogoCliente({ org, clienteId });
    } catch (e) {
      console.error('[foto-pedido] catálogo falló:', e.message);
      return res.status(502).json({ error: 'Database error' });
    }
    const { items = [], portalCfg = {} } = catalogo;

    // Respeta el apagado del catálogo a nivel org.
    if (portalCfg.portalCatalogo === false) {
      return res.status(200).json({ ok: true, lineas: [], sinPrecio: [], sinMatch: [] });
    }

    const r = await interpretarPedido({ imagen: { media_type, data }, catalogo: items });
    if (!r.ok) {
      const code = r.error || 'interpret_error';
      const status = code === 'anthropic_not_configured' ? 503 : 502;
      return res.status(status).json({ error: code });
    }

    return res.status(200).json({
      ok: true,
      lineas:    r.lineas,
      sinPrecio: r.sinPrecio,
      sinMatch:  r.sinMatch,
    });
  } catch (err) {
    console.error('[foto-pedido] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
