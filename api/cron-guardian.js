// api/cron-guardian.js — Torre de Control · GUARDIÁN DE REGRESIÓN.
//
// Por qué existe: Federico no programa y Eric usa Pazque EN VIVO y gratis. Cada
// deploy es un salto de fe: si algo se rompió, hoy lo descubre Eric antes que
// nadie. Este agente cierra ese agujero. Antes de que un cliente lo sufra,
// ejercita los flujos críticos COMO SI FUERA UN CLIENTE y, si una regresión
// apareció, te avisa por email con el detalle exacto.
//
// Se complementa con cron-health (uptime cada 10 min, "¿está arriba?") y con el
// auto-fix (arregla DESPUÉS de que un error explota). El Guardián es distinto:
// prueba la LÓGICA DE NEGOCIO (no un 200 vacío) para cazar la regresión ANTES.
//
// REGLAS DE DISEÑO (mismo criterio que toda la Torre de Control):
//   • SÓLO LECTURA, cero efectos: nunca crea pedidos, nunca manda OTP, nunca
//     toca datos. Los flujos con efecto se prueban por su capa de validación
//     (ej: otp-send con body vacío → 400, sin enviar nada).
//   • Multi-tenant / genérico: testea contra una org de prueba (GUARDIAN_ORG,
//     default la org demo), nunca contra datos de un cliente real.
//   • Auth por CRON_SECRET, como el resto de los crons. Sirve para (a) el cron
//     programado (red de seguridad), y (b) invocarlo a mano justo DESPUÉS de
//     cada deploy (curl con el mismo secret) para validar que no rompió nada.
//   • Anti-falso-positivo: un chequeo que falla se re-confirma tras una espera.
//     Sólo alerta si falla DOS veces (un pico transitorio no manda email).
//   • Alerta DIRECTO por email (no vía log.error) a propósito: una regresión de
//     deploy no debe abrir un Issue de auto-fix (eso es para errores que el
//     código tira solo); esto es un aviso para que Federico revise el deploy.
//   • Timeout por chequeo: un endpoint colgado no cuelga al Guardián.
// ----------------------------------------------------------------------------

import { sendEmail } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
// Default ON: su valor es cazar regresiones solo; apagarlo con GUARDIAN_ENABLED=false.
const ENABLED     = process.env.GUARDIAN_ENABLED !== 'false';
const ALERT_EMAIL = process.env.GUARDIAN_ALERT_EMAIL || process.env.OWNER_EMAIL || 'federico@pazque.com';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');
// Org de prueba: genérica, nunca atada a un cliente real. Default = org demo.
const GUARDIAN_ORG = (process.env.GUARDIAN_ORG || 'aryes-ltda').replace(/[^a-z0-9_-]/gi, '');
// Opcional: token de una sesión de portal de PRUEBA (cliente de la org demo).
// Si está, el chequeo de catálogo sube de nivel y verifica precios reales.
const GUARDIAN_TOKEN = process.env.GUARDIAN_SESSION_TOKEN || '';
const TIMEOUT_MS  = 12000;  // margen para cold-starts
const RECHECK_MS  = 3000;   // espera antes de reconfirmar un chequeo que falló
const MAX_ASSETS  = 40;     // tope de chunks a verificar (un build tiene ~15)

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// fetch con timeout (AbortController). wantText: leer el body como texto (para
// parsear index.html o respuestas JSON). Si el endpoint se cuelga, abortamos.
async function timedFetch(url, opts = {}, wantText = false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'manual' });
    const text = wantText ? await r.text() : '';
    return { ok: r.ok, status: r.status, ms: Date.now() - started, text };
  } catch (e) {
    return {
      ok: false, status: 0, ms: Date.now() - started, text: '',
      error: e.name === 'AbortError' ? `timeout >${TIMEOUT_MS}ms` : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Extrae del index.html las URLs de los chunks del build (Vite emite
// <script src="/assets/..js">, <link href="/assets/..css"> y modulepreload).
function extractAssets(html) {
  const urls = new Set();
  const re = /(?:src|href)=["']([^"']*\/assets\/[^"']+\.(?:js|mjs|css))["']/g;
  let m;
  while ((m = re.exec(html))) urls.add(m[1]);
  return [...urls];
}

// base: dominio contra el que se corre. Default el sitio productivo. Se puede
// apuntar a una URL de deploy puntual con ?base= (validado: sólo https de
// pazque.com o *.vercel.app, para no convertir esto en un SSRF abierto).
function resolveBase(req) {
  const q = (req.query?.base || '').trim();
  if (!q) return SITE;
  try {
    const u = new URL(q);
    const okHost = u.protocol === 'https:' &&
      (u.hostname === 'pazque.com' || u.hostname.endsWith('.pazque.com') || u.hostname.endsWith('.vercel.app'));
    return okHost ? q.replace(/\/$/, '') : SITE;
  } catch { return SITE; }
}

// ── Los 5 chequeos. Cada run() devuelve {ok,status,ms,error?,info?}. ─────────
function buildChecks(base) {
  return [
    {
      name: 'App shell + chunks',
      detail: 'index.html carga y ningún /assets/*.js|css está muerto',
      run: async () => {
        const idx = await timedFetch(base + '/', {}, true);
        if (!idx.ok) return { ok: false, status: idx.status, ms: idx.ms, error: idx.error || ('index HTTP ' + idx.status) };
        const html = idx.text || '';
        if (!/id=["']root["']/.test(html)) {
          return { ok: false, status: idx.status, ms: idx.ms, error: 'index sin <div id=root> (shell roto)' };
        }
        const assets = extractAssets(html);
        if (!assets.length) {
          return { ok: false, status: idx.status, ms: idx.ms, error: 'index no referencia chunks /assets (build roto)' };
        }
        const checked = await Promise.all(assets.slice(0, MAX_ASSETS).map(async (a) => {
          const u = a.startsWith('http') ? a : base + a;
          const r = await timedFetch(u);
          return { a, ok: r.ok, status: r.status };
        }));
        const dead = checked.filter(r => !r.ok);
        if (dead.length) {
          return {
            ok: false, status: dead[0].status, ms: idx.ms,
            error: `${dead.length} chunk(s) muertos (ej: ${dead[0].a} → HTTP ${dead[0].status}). Pantalla en blanco para el cliente.`,
          };
        }
        return { ok: true, status: 200, ms: idx.ms, info: `${assets.length} chunks vivos` };
      },
    },
    {
      name: 'Catálogo responde sano',
      detail: `GET /api/catalogo?org=${GUARDIAN_ORG}`,
      run: async () => {
        const r = await timedFetch(`${base}/api/catalogo?org=${encodeURIComponent(GUARDIAN_ORG)}`, {}, true);
        if (!r.ok) return { ok: false, status: r.status, ms: r.ms, error: r.error || ('HTTP ' + r.status) };
        let j;
        try { j = JSON.parse(r.text); } catch { return { ok: false, status: r.status, ms: r.ms, error: 'respuesta no-JSON' }; }
        if (j.error) return { ok: false, status: r.status, ms: r.ms, error: 'catálogo devolvió error: ' + j.error };
        if (!Array.isArray(j.items)) return { ok: false, status: r.status, ms: r.ms, error: 'respuesta sin array "items"' };

        // Nivel 2 (opcional): con token de sesión de prueba, verificamos que los
        // precios se resuelven. Esta es la clase de bug nº1 del proyecto.
        if (GUARDIAN_TOKEN) {
          const pr = await timedFetch(`${base}/api/catalogo?cliente=guardian`, {
            headers: { Authorization: 'Bearer ' + GUARDIAN_TOKEN },
          }, true);
          if (!pr.ok) return { ok: false, status: pr.status, ms: r.ms, error: 'catálogo con sesión falló: HTTP ' + pr.status };
          let pj;
          try { pj = JSON.parse(pr.text); } catch { return { ok: false, status: pr.status, ms: r.ms, error: 'catálogo con sesión: no-JSON' }; }
          const items = Array.isArray(pj.items) ? pj.items : [];
          if (!items.length) return { ok: false, status: pr.status, ms: r.ms, error: 'catálogo con sesión vino vacío' };
          const conPrecio = items.filter(it => Number(it.precio) > 0).length;
          if (conPrecio === 0) {
            return { ok: false, status: pr.status, ms: r.ms, error: `los ${items.length} ítems vinieron con precio 0 (regresión de precios)` };
          }
          return { ok: true, status: 200, ms: r.ms, info: `${conPrecio}/${items.length} con precio` };
        }
        return { ok: true, status: 200, ms: r.ms, info: `${j.items.length} items` + (j.requiereLogin ? ' (gated)' : '') };
      },
    },
    {
      name: 'Login vivo (sin enviar OTP)',
      detail: 'POST /api/otp-send con body vacío debe validar (400)',
      run: async () => {
        const r = await timedFetch(`${base}/api/otp-send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        }, true);
        if (r.status === 400) return { ok: true, status: 400, ms: r.ms, info: 'valida input' };
        if (r.status === 429) return { ok: true, status: 429, ms: r.ms, info: 'rate-limited (endpoint vivo)' };
        return { ok: false, status: r.status, ms: r.ms, error: r.error || `esperaba 400, vino HTTP ${r.status}` };
      },
    },
    {
      name: 'Seguimiento / auth-gate',
      detail: 'GET /api/historial sin sesión debe rechazar (401)',
      run: async () => {
        const r = await timedFetch(`${base}/api/historial`);
        if (r.status === 401) return { ok: true, status: 401, ms: r.ms, info: 'auth-gate ok' };
        if (r.status === 429) return { ok: true, status: 429, ms: r.ms, info: 'rate-limited (endpoint vivo)' };
        return { ok: false, status: r.status, ms: r.ms, error: r.error || `esperaba 401, vino HTTP ${r.status} (¿se cayó el gate de auth?)` };
      },
    },
    {
      name: 'Base de datos (Supabase)',
      detail: 'Lectura trivial de organizations',
      run: () => timedFetch(`${SB_URL}/rest/v1/organizations?select=id&limit=1`, {
        headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' },
      }),
    },
  ];
}

function buildAlert(failed, all, base) {
  const plural = failed.length === 1 ? '' : 's';
  const subject = `🛡️ Guardián: regresión en ${failed.map(f => f.name).join(', ')}`.slice(0, 120);
  const row = (r) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:13px;color:#1a1a18">
        ${r.ok ? '🟢' : '🔴'} ${esc(r.name)}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;color:#6a6a68">
        ${r.ok ? esc(r.info || 'OK') : esc(r.error || ('HTTP ' + r.status))} · ${r.ms}ms
      </td>
    </tr>`;
  const html = `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:28px 22px">
      <div style="display:inline-block;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px">
        POSIBLE REGRESIÓN (revisá el último deploy)
      </div>
      <h1 style="font-size:19px;font-weight:700;color:#1a1a18;margin:0 0 6px">
        ${failed.length} chequeo${plural} del Guardián falló${plural ? 'ron' : ''}
      </h1>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 4px">${esc(base)}</p>
      <p style="font-size:13px;color:#6a6a68;margin:0 0 18px">${esc(new Date().toISOString())}</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0ede8;border-radius:8px;overflow:hidden">
        ${all.map(row).join('')}
      </table>
      <p style="font-size:12px;color:#9a9a98;margin-top:22px;line-height:1.5">
        Guardián de regresión de Pazque · ejercita los flujos críticos como un cliente, sólo lee, no toca datos.
        Esta alerta se dispara sólo tras fallar DOS veces seguidas (con un reintento de por medio),
        así que no es un pico transitorio: algo del deploy rompió un flujo.
      </p>
    </div>`;
  return { subject, html };
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}. El mismo secret
  // sirve para invocarlo a mano post-deploy.
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'GUARDIAN_ENABLED=false' });
  }

  const base = resolveBase(req);
  const checks = buildChecks(base);

  const results = [];
  await Promise.all(checks.map(async (c) => {
    const r = await c.run();
    results.push({ name: c.name, detail: c.detail, run: c.run, ...r });
  }));

  // Anti-falso-positivo: re-confirmamos los que fallaron tras una espera. Sólo
  // cuenta como regresión si vuelve a fallar (un pico aislado no manda email).
  let failed = results.filter(r => !r.ok);
  if (failed.length) {
    await new Promise(r => setTimeout(r, RECHECK_MS));
    for (const r of results) {
      if (r.ok) continue;
      const retry = await r.run();
      if (retry.ok) { Object.assign(r, retry); r.recovered = true; }
      else { Object.assign(r, retry); r.confirmed = true; }
    }
    failed = results.filter(r => !r.ok);
  }
  for (const r of results) delete r.run; // sacar el puntero antes de serializar

  if (failed.length) {
    try {
      await sendEmail({ to: ALERT_EMAIL, ...buildAlert(failed, results, base) });
    } catch (e) {
      console.error('[cron-guardian] no se pudo enviar la alerta:', e.message);
    }
  }

  return res.status(200).json({
    ok: failed.length === 0,
    base,
    checked: results.length,
    failed: failed.length,
    results,
  });
}
