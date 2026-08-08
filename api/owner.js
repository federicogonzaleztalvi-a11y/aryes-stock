// api/owner.js — Consola privada del DUEÑO de Pazque (Federico).
//
// Esta es la ÚNICA API que cruza la frontera multi-tenant: ve prospectos de
// TODA la plataforma (pazque_leads), no de una org. Por eso NO usa el sistema
// de roles por-org (admin/operador/vendedor) que protege a Eric — tiene su
// propio login, aislado.
//
// Login SIN contraseña (como Shopify/Amazon, no una clave compartida):
//   1) request-code  → manda un código de 6 dígitos al mail del dueño.
//   2) verify-code   → valida el código y devuelve un TOKEN de sesión (30 días).
//   3) list/update   → requieren ese token en el header `x-owner-token`.
//
// La sesión persiste 30 días por dispositivo (el token se guarda en el browser),
// así que el código se pide UNA vez por aparato, no cada vez.
//
//   POST { action:'request-code', email }        → { ok:true }  (genérico)
//   POST { action:'verify-code',  email, code }  → { ok:true, token, expiresAt }
//   POST { action:'list' }                        → { ok:true, leads:[...] }
//   POST { action:'update', id, estado?, notas? } → { ok:true }
//
// El embudo del PRODUCTO (portal_leads / api/lead.js) NO se toca acá.

import { setCorsHeaders } from './_cors.js';
import { checkRateLimit } from './_rate-limit.js';
import { sendEmail, templates } from './_email.js';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// Único mail autorizado a entrar. Default: la casilla de Federico. Se puede
// sobreescribir con OWNER_EMAIL (por si algún día cambia), pero no hace falta.
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'federico@pazque.com').trim().toLowerCase();

const CODE_TTL_MIN = 10;                 // el código vence a los 10 minutos
const SESSION_DAYS = 30;                 // la sesión dura 30 días por dispositivo
const MAX_CODE_ATTEMPTS = 5;             // intentos por código antes de invalidarlo

const ESTADOS = ['nuevo', 'contactado', 'demo', 'convertido', 'descartado'];

function svcHeaders(extra = {}) {
  const k = SB_SVC || SB_ANON;
  return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json', 'Content-Type': 'application/json', ...extra };
}

function sha256(s) { return createHash('sha256').update(String(s)).digest('hex'); }

// Comparación en tiempo constante de dos hashes hex del mismo largo.
function hashEq(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function clean(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// ── Sesión: valida el token del header contra owner_sessions ────────────────
async function sessionOk(req) {
  const token = req.headers['x-owner-token'];
  if (!token) return false;
  const th = sha256(token);
  const r = await fetch(
    `${SB_URL}/rest/v1/owner_sessions?token_hash=eq.${encodeURIComponent(th)}&select=token_hash,expires_at`,
    { headers: svcHeaders() }
  );
  if (!r.ok) return false;
  const rows = await r.json();
  const row = rows[0];
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  // Refrescar last_seen (best-effort, no bloquea).
  fetch(`${SB_URL}/rest/v1/owner_sessions?token_hash=eq.${encodeURIComponent(th)}`, {
    method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => {});
  return true;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const action = clean(req.body?.action, 20);

  // ── Paso 1: pedir código ──────────────────────────────────────────────
  if (action === 'request-code') {
    // Rate-limit por IP: frena que alguien spamee el mail del dueño.
    if (!(await checkRateLimit('owner-code:' + ip, 600, 5, { failClosed: true })))
      return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });

    const email = clean(req.body?.email, 160).toLowerCase();
    // Respuesta SIEMPRE genérica: no revelamos cuál es el mail de dueño.
    if (email !== OWNER_EMAIL) return res.status(200).json({ ok: true });

    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const row = {
      email,
      code_hash: sha256(code),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(),
    };
    const ins = await fetch(`${SB_URL}/rest/v1/owner_login_codes`, {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(row),
    });
    if (!ins.ok) {
      console.error('[owner] code insert error:', await ins.text());
      return res.status(500).json({ error: 'No pudimos generar el código. Probá de nuevo.' });
    }
    try {
      const tpl = templates.ownerLoginCode(code, CODE_TTL_MIN);
      await sendEmail({ to: OWNER_EMAIL, subject: tpl.subject, html: tpl.html });
    } catch (e) {
      console.warn('[owner] code email failed:', e.message);
    }
    return res.status(200).json({ ok: true });
  }

  // ── Paso 2: verificar código → sesión ─────────────────────────────────
  if (action === 'verify-code') {
    if (!(await checkRateLimit('owner-verify:' + ip, 600, 10, { failClosed: true })))
      return res.status(429).json({ error: 'Demasiados intentos. Esperá un momento.' });

    const email = clean(req.body?.email, 160).toLowerCase();
    const code  = clean(req.body?.code, 6).replace(/\D/g, '');
    if (email !== OWNER_EMAIL || code.length !== 6)
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });

    // Traemos el código más reciente, vivo, para ese mail.
    const q = await fetch(
      `${SB_URL}/rest/v1/owner_login_codes?email=eq.${encodeURIComponent(email)}&consumed=eq.false&order=created_at.desc&limit=1`,
      { headers: svcHeaders() }
    );
    const rows = q.ok ? await q.json() : [];
    const rec = rows[0];
    if (!rec || new Date(rec.expires_at).getTime() < Date.now() || rec.attempts >= MAX_CODE_ATTEMPTS)
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });

    if (!hashEq(rec.code_hash, sha256(code))) {
      // Sumar intento (best-effort). A los 5 el código queda muerto.
      fetch(`${SB_URL}/rest/v1/owner_login_codes?id=eq.${encodeURIComponent(rec.id)}`, {
        method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ attempts: (rec.attempts || 0) + 1 }),
      }).catch(() => {});
      return res.status(401).json({ error: 'Código incorrecto o vencido.' });
    }

    // Consumir el código (un solo uso).
    await fetch(`${SB_URL}/rest/v1/owner_login_codes?id=eq.${encodeURIComponent(rec.id)}`, {
      method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ consumed: true }),
    });

    // Emitir sesión de 30 días. Guardamos solo el hash del token.
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    const sIns = await fetch(`${SB_URL}/rest/v1/owner_sessions`, {
      method: 'POST', headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ token_hash: sha256(token), email, expires_at: expiresAt }),
    });
    if (!sIns.ok) {
      console.error('[owner] session insert error:', await sIns.text());
      return res.status(500).json({ error: 'No pudimos iniciar la sesión. Probá de nuevo.' });
    }
    return res.status(200).json({ ok: true, token, expiresAt });
  }

  // ── De acá para abajo: requiere sesión válida ─────────────────────────
  if (!(await sessionOk(req))) return res.status(401).json({ error: 'Sesión vencida. Volvé a entrar.' });

  if (action === 'list') {
    const r = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?select=*&order=created_at.desc`,
      { headers: svcHeaders() }
    );
    if (!r.ok) {
      console.error('[owner] list error:', await r.text());
      return res.status(500).json({ error: 'No pudimos leer los prospectos.' });
    }
    const leads = await r.json();
    return res.status(200).json({ ok: true, leads });
  }

  if (action === 'update') {
    const id = clean(req.body?.id, 60);
    if (!id) return res.status(400).json({ error: 'Falta el id del prospecto' });

    const patch = { updated_at: new Date().toISOString() };
    if (req.body?.estado != null) {
      const estado = clean(req.body.estado, 20);
      if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
      patch.estado = estado;
    }
    if (req.body?.notas != null) patch.notas = clean(req.body.notas, 2000) || null;

    const upd = await fetch(
      `${SB_URL}/rest/v1/pazque_leads?id=eq.${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: svcHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(patch) }
    );
    if (!upd.ok) {
      console.error('[owner] update error:', await upd.text());
      return res.status(500).json({ error: 'No pudimos guardar el cambio.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Acción desconocida' });
}
