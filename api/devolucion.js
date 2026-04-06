// api/devolucion.js — Solicitud de devolución desde el portal B2B
const ALLOWED_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';
// POST /api/devolucion — cliente solicita una devolución
// El cliente ya está autenticado via OTP (teléfono verificado)

import { log } from './_log.js';
import { setCorsHeaders } from './_cors.js';


const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SB_URL || !SB_ANON) return res.status(503).json({ error: 'Servicio no disponible' });

  // GET — listar devoluciones del cliente por teléfono
  if (req.method === 'GET') {
    const { tel, org = 'aryes' } = req.query || {};
    if (!tel) return res.status(400).json({ error: 'Teléfono requerido' });
    const telClean = tel.replace(/\D/g, '');

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
    const { ventaId, clienteNombre, clienteTel, motivo, notas, items, org = 'aryes' } = req.body || {};

    if (!ventaId || !motivo || !items?.length) {
      return res.status(400).json({ error: 'ventaId, motivo e items son requeridos' });
    }
    if (!clienteTel) return res.status(400).json({ error: 'Teléfono del cliente requerido' });

    const telClean = clienteTel.replace(/\D/g, '');

    // Verificar que la venta pertenece a este cliente
    const vr = await fetch(
      `${SB_URL}/rest/v1/ventas?id=eq.${ventaId}&org_id=eq.${encodeURIComponent(org)}&select=id,cliente_nombre,estado`,
      { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, Accept: 'application/json' } }
    );
    const ventas = await vr.json();
    if (!Array.isArray(ventas) || !ventas.length) {
      return res.status(404).json({ error: 'Venta no encontrada' });
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
