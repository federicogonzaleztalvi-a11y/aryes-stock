// api/devolucion.js — Solicitud de devolución desde el portal B2B
// POST /api/devolucion — cliente solicita una devolución
// El cliente ya está autenticado via OTP (teléfono verificado)

import { log } from './_log.js';
import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';


const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;


export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_ANON) return res.status(503).json({ error: 'Servicio no disponible' });

  // SECURITY: requiere sesión de portal válida. Identidad (org, tel, cliente_id) se
  // deriva de la sesión — NUNCA del query/body. Antes cualquiera con un teléfono podía
  // leer las devoluciones de otro cliente o crear devoluciones por ventaId adivinado.
  const session = await validatePortalSession(getBearerToken(req));
  if (!session) return res.status(401).json({ error: 'Sesión requerida' });
  const sessOrg = String(session.org_id || 'aryes');
  const sessTel = String(session.tel || '').replace(/\D/g, '');
  const sessClienteId = String(session.cliente_id || '');

  // GET — listar devoluciones del cliente autenticado
  if (req.method === 'GET') {
    const telClean = sessTel;
    if (!telClean) return res.status(400).json({ error: 'Teléfono no encontrado en la sesión' });
    const org = sessOrg;

    const r = await fetch(
      `${SB_URL}/rest/v1/devoluciones?cliente_tel=eq.${encodeURIComponent(telClean)}&org_id=eq.${encodeURIComponent(org)}&order=creado_en.desc&limit=10`,
      { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
    );
    if (!r.ok) return res.status(502).json({ error: 'Error al cargar devoluciones' });
    const data = await r.json();
    return res.status(200).json({ devoluciones: Array.isArray(data) ? data : [] });
  }

  // POST — crear solicitud de devolución desde el portal
  if (req.method === 'POST') {
    const { ventaId, clienteNombre, motivo, notas, items } = req.body || {};
    // Identidad SIEMPRE desde la sesión, nunca del body.
    const org = sessOrg;
    const telClean = sessTel;

    if (!ventaId || !motivo || !items?.length) {
      return res.status(400).json({ error: 'ventaId, motivo e items son requeridos' });
    }
    if (!telClean) return res.status(400).json({ error: 'Teléfono no encontrado en la sesión' });

    // Verificar que la venta pertenece a ESTE cliente (org + cliente_id de la sesión).
    const vr = await fetch(
      `${SB_URL}/rest/v1/ventas?id=eq.${encodeURIComponent(ventaId)}&org_id=eq.${encodeURIComponent(org)}&select=id,cliente_id,cliente_nombre,estado`,
      { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
    );
    const ventas = await vr.json();
    if (!Array.isArray(ventas) || !ventas.length) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    if (sessClienteId && ventas[0].cliente_id && String(ventas[0].cliente_id) !== sessClienteId) {
      log.warn('devolucion', 'venta ownership mismatch — blocked', { ventaId, sessClienteId });
      return res.status(403).json({ error: 'Esta venta no pertenece a tu cuenta' });
    }
    if (ventas[0].estado !== 'entregada') {
      return res.status(400).json({ error: 'Solo se pueden devolver ventas entregadas' });
    }

    // Crear solicitud de devolución con estado 'solicitada' (pendiente de aprobación del admin)
    const devId  = crypto.randomUUID();
    const ahora  = new Date().toISOString();
    const nro    = 'DEV-P-' + Date.now().toString().slice(-6); // provisional hasta que admin procese

    const payload = {
      id:              devId,
      nro_devolucion:  nro,
      venta_id:        ventaId,
      cliente_nombre:  clienteNombre || '',
      cliente_tel:     telClean,
      motivo,
      notas:           notas || '',
      items,
      estado:          'solicitada', // pendiente de aprobación
      origen:          'portal',     // distinguir de las creadas por el admin
      org_id:          org,
      creado_en:       ahora,
    };

    const r = await fetch(`${SB_URL}/rest/v1/devoluciones`, {
      method:  'POST',
      headers: {
        apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok && r.status !== 201) {
      const err = await r.text();
      log.error('devolucion', 'insert failed', { status: r.status, body: err.slice(0, 200) });
      return res.status(502).json({ error: 'Error al registrar la devolución' });
    }

    // Notificar al admin via push (best-effort)
    try {
      await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/push?action=send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: org,
          title: 'Nueva solicitud de devolucion',
          body:  `${clienteNombre || 'Cliente'} solicita devolucion — ${motivo}`,
          url:   '/?tab=devoluciones',
          tag:   'devolucion-' + devId,
          urgent: true,
        }),
      });
    } catch { /* non-critical */ }

    log.info('devolucion', 'created from portal', { org, ventaId, motivo });
    return res.status(201).json({ ok: true, id: devId, nro });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
