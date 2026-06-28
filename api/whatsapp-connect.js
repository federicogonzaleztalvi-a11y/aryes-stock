// api/whatsapp-connect.js — Conexión self-service del WhatsApp del distribuidor (Embedded Signup).
// ----------------------------------------------------------------------------
// Opción B (Tech Provider + Embedded Signup): cada distribuidor conecta su PROPIO
// número de WhatsApp desde la pestaña Integraciones. El botón del front abre el
// flujo de Meta (FB.login con config_id) y devuelve un `code` + `waba_id` +
// `phone_number_id`. Acá:
//   1. canjeamos el code por un access_token de negocio (Graph API + App Secret)
//   2. suscribimos la app de Pazque a la WABA del distribuidor (webhooks)
//   3. registramos el número en Cloud API (best-effort)
//   4. leemos el número/nombre para mostrarlo
//   5. guardamos { phone_id, token, waba_id, ... } en organizations.whatsapp_sender
//
// Una vez conectado, broadcast.js manda los broadcasts desde ese número y, si la
// plantilla pazque_otp está aprobada en SU WABA, otp-send.js manda también el
// código de acceso desde ese número (white-label total — Opción A).
//
// El token vive SERVER-SIDE (organizations.whatsapp_sender.token), nunca vuelve al
// browser. Todo scoped por org del admin. Genérico multi-tenant (nada hardcodeado).
//
// GET  ?action=status                                   → { connected, number, name, template_status, otp_status }
// POST ?action=connect  { code, waba_id, phone_number_id } → canjea, suscribe, guarda
// POST ?action=disconnect                               → borra credenciales
// POST ?action=create-template                          → crea pazque_broadcast + pazque_otp en la WABA conectada

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// App ID público de Pazque (cuenta Meta "Recomiendo"). Hardcodeado como default
// para que Federico no tenga que cargar otra env var; overridable si hiciera falta.
const WA_APP_ID     = process.env.WA_APP_ID || '1031176906086563';
const WA_APP_SECRET = process.env.WA_APP_SECRET;
const WA_LANG       = process.env.WA_BROADCAST_LANG || 'es_AR';

const GRAPH = 'https://graph.facebook.com/v21.0';

function svcHeaders() {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json' };
}

// Valida el JWT del admin y resuelve { org }. Solo rol admin (conectar la cuenta de
// mensajería es acción sensible). Mismo patrón que broadcast.js / simpliroute.js.
async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const k = SB_SVC || SB_ANON;

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: k, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;

  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

async function getConfig(org) {
  const r = await fetch(
    `${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}&select=whatsapp_sender&limit=1`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return null;
  return (await r.json())?.[0]?.whatsapp_sender || null;
}

async function saveConfig(org, cfg) {
  await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org)}`, {
    method: 'PATCH',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ whatsapp_sender: cfg }),
  });
}

function digits(s) { return String(s || '').replace(/\D/g, ''); }

// Canjea el `code` de Embedded Signup por un access_token de negocio (system user,
// larga duración). No requiere redirect_uri en el flujo de Embedded Signup.
async function exchangeCode(code) {
  const url = `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(WA_APP_ID)}`
    + `&client_secret=${encodeURIComponent(WA_APP_SECRET)}&code=${encodeURIComponent(code)}`;
  const r = await fetch(url);
  if (!r.ok) return { error: (await r.text()).slice(0, 300) };
  const d = await r.json();
  if (!d?.access_token) return { error: 'Meta no devolvió token' };
  return { token: d.access_token };
}

// Definiciones de las plantillas que Pazque necesita en la WABA del distribuidor.
// pazque_broadcast (MARKETING, 1 parámetro de cuerpo) → la usa api/broadcast.js.
// pazque_otp (AUTHENTICATION, botón COPY_CODE) → la usa api/otp-send.js. El payload
// de envío del OTP (body param + button index 0) es compatible con COPY_CODE.
function templateDefs() {
  return [
    {
      name: 'pazque_broadcast',
      category: 'MARKETING',
      language: WA_LANG,
      components: [
        { type: 'BODY', text: '{{1}}', example: { body_text: [['Hola! Tenemos novedades para vos. Pasá a ver el catálogo.']] } },
      ],
    },
    {
      name: 'pazque_otp',
      category: 'AUTHENTICATION',
      language: WA_LANG,
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 10 },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE' }] },
      ],
    },
  ];
}

// Crea las dos plantillas que Pazque necesita en la WABA y devuelve el estado de
// cada una. Lo usan tanto `connect` (auto, para que el distribuidor no tenga que
// saber que existe este paso) como `create-template` (reintento manual).
async function ensureTemplates(cfg) {
  const [bcast, otp] = await Promise.all(
    templateDefs().map(def => createTemplate(cfg.waba_id, cfg.token, def))
  );
  return {
    template_status: bcast.ok ? 'PENDING' : null,
    otp_status:      otp.ok   ? 'PENDING' : null,
    allOk: bcast.ok && otp.ok,
    error: bcast.error || otp.error || null,
  };
}

// Crea (o detecta como ya-existente) una plantilla en la WABA. Idempotente: si ya
// existe, Meta devuelve error 100 con mensaje "already exists" → lo tratamos como ok.
async function createTemplate(wabaId, token, def) {
  try {
    const r = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(def),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, status: d?.status || 'PENDING' };
    const msg = (d?.error?.message || '').toLowerCase();
    if (msg.includes('already exists')) return { ok: true, status: 'PENDING', existed: true };
    return { ok: false, error: d?.error?.message || 'Error al crear plantilla' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !(SB_SVC || SB_ANON)) return res.status(503).json({ error: 'Servicio no disponible' });

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(401).json({ error: 'No autorizado' });
  const org = admin.org;
  const action = req.query?.action || 'status';

  // ── GET status: ¿conectado? (nunca devuelve el token) ──
  if (action === 'status' && req.method === 'GET') {
    const cfg = await getConfig(org);
    return res.status(200).json({
      connected: !!cfg?.token,
      number: cfg?.display_phone || null,
      name: cfg?.verified_name || null,
      template_status: cfg?.template_status || null,   // estado de pazque_broadcast
      otp_status: cfg?.otp_status || null,             // estado de pazque_otp
    });
  }

  // ── POST connect: canjea el code, suscribe la app, registra el número y guarda ──
  if (action === 'connect' && req.method === 'POST') {
    if (!WA_APP_SECRET) return res.status(503).json({ error: 'Falta configurar WA_APP_SECRET en el servidor.' });

    const code   = String(req.body?.code || '').trim();
    const wabaId = digits(req.body?.waba_id);
    const phoneId = digits(req.body?.phone_number_id);
    if (!code || !wabaId || !phoneId)
      return res.status(400).json({ error: 'Faltan datos de la conexión. Probá de nuevo.' });

    // 1) Canjear code → access_token de negocio.
    const ex = await exchangeCode(code);
    if (ex.error) return res.status(400).json({ error: 'No se pudo conectar con Meta: ' + ex.error });
    const token = ex.token;

    // 2) Suscribir la app de Pazque a la WABA (para recibir webhooks de esa cuenta).
    try {
      await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token },
      });
    } catch { /* best-effort */ }

    // 3) Registrar el número en Cloud API (best-effort; puede ya estar registrado).
    try {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      await fetch(`${GRAPH}/${phoneId}/register`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      });
    } catch { /* best-effort */ }

    // 4) Leer número y nombre verificado para mostrarlos en el panel.
    let display_phone = null, verified_name = null;
    try {
      const pRes = await fetch(`${GRAPH}/${phoneId}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (pRes.ok) {
        const p = await pRes.json();
        display_phone = p?.display_phone_number || null;
        verified_name = p?.verified_name || null;
      }
    } catch { /* opcional */ }

    // 5) Guardar. Forma { phone_id, token } esperada por broadcast.js / otp-send.js.
    const cfg = {
      phone_id: phoneId, token, waba_id: wabaId,
      display_phone, verified_name,
      template_status: null, otp_status: null,
      connected_at: new Date().toISOString(),
    };
    await saveConfig(org, cfg);

    // 6) Crear las plantillas AUTOMÁTICAMENTE (turnkey): el distribuidor no tiene que
    //    saber que este paso existe. Best-effort; si falla, el botón "Crear plantillas"
    //    del panel queda como reintento. El webhook actualiza a APPROVED/REJECTED.
    try {
      const tpl = await ensureTemplates(cfg);
      cfg.template_status = tpl.template_status;
      cfg.otp_status      = tpl.otp_status;
      await saveConfig(org, cfg);
    } catch { /* reintenta desde el botón del panel */ }

    return res.status(200).json({
      ok: true, connected: true, number: display_phone, name: verified_name,
      template_status: cfg.template_status, otp_status: cfg.otp_status,
    });
  }

  // ── POST disconnect: borra credenciales (vuelve a usar el número Pazque) ──
  if (action === 'disconnect' && req.method === 'POST') {
    await saveConfig(org, null);
    return res.status(200).json({ ok: true, connected: false });
  }

  // ── POST create-template: empuja las plantillas a la WABA conectada ──
  if (action === 'create-template' && req.method === 'POST') {
    const cfg = await getConfig(org);
    if (!cfg?.token || !cfg?.waba_id)
      return res.status(400).json({ error: 'Primero conectá tu WhatsApp.' });

    const tpl = await ensureTemplates(cfg);

    // Guardamos el estado provisional; el webhook lo actualiza a APPROVED/REJECTED.
    cfg.template_status = tpl.template_status;
    cfg.otp_status      = tpl.otp_status;
    await saveConfig(org, cfg);

    if (!cfg.template_status && !cfg.otp_status)
      return res.status(400).json({ error: tpl.error || 'No se pudieron crear las plantillas.' });

    return res.status(200).json({
      ok: true,
      template_status: cfg.template_status,
      otp_status: cfg.otp_status,
      warning: !tpl.allOk ? 'Una de las plantillas no se pudo crear; reintentá más tarde.' : null,
    });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}
