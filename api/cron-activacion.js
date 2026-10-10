// api/cron-activacion.js — AGENTE DE ACTIVACIÓN de Pazque (product-led growth).
//
// El agente de VENTAS (cron-ventas) trae distribuidoras y las empuja a
// registrarse. Pero una cuenta vacía nunca paga: el momento que importa es
// cuando la distribuidora CARGA SU CATÁLOGO (al menos un producto con precio).
// Este agente acompaña ese primer tramo del onboarding.
//
// Qué hace, cada día (ver vercel.json):
//   1. Mira las orgs EN PRUEBA, activas y recientes que todavía NO cargaron
//      ningún producto con precio de venta (= no activaron).
//   2. Les manda una secuencia corta de 3 avisos, anclada en cuándo se
//      registraron (no es spam de calendario):
//        stage 1 (~24h)  → "cargá tu primer producto"
//        stage 2 (~3 días) → "importá tu lista de Excel" (el camino rápido)
//        stage 3 (~7 días) → último aviso + ayuda humana si la necesita
//   3. Apenas la org carga su primer producto con precio, marca activated_at y
//      NO le manda nada más. Nunca toca orgs que ya pagan ni fuera de prueba.
//
// REGLAS DE ORO (iguales al resto de la Torre de Control):
//   • Apagado por defecto: solo corre si ACTIVATION_AGENT_ENABLED === 'true'.
//   • Nunca promete que "nosotros te armamos el portal" — es self-serve: el
//     copy siempre dice "lo cargás vos en minutos" (ver templates.activacion).
//   • Auth por CRON_SECRET, como el resto de los crons.
//   • Re-chequea la activación JUSTO antes de mandar (evita avisar a alguien
//     que acaba de cargar su catálogo entre corridas).
// ----------------------------------------------------------------------------

import { sendEmail, templates } from './_email.js';

const SB_URL      = process.env.SUPABASE_URL;
const SB_SVC      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const ENABLED     = process.env.ACTIVATION_AGENT_ENABLED === 'true';
const SITE        = (process.env.SITE_URL || 'https://pazque.com').replace(/\/$/, '');

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

const DAY         = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 8;               // sólo acompañamos el primer tramo de la prueba
const MIN_GAP     = 20 * 60 * 60 * 1000; // no mandar dos avisos en <20h (defensa extra)

// Umbrales de cada etapa, anclados en created_at (cuándo se registró la org).
const STAGE_AT = { 1: 1 * DAY, 2: 3 * DAY, 3: 7 * DAY };

// ¿La org ya activó? = tiene al menos un producto con precio de venta > 0.
async function hasPricedProduct(orgId) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/products?org_id=eq.${encodeURIComponent(orgId)}` +
        `&precio_venta=gt.0&select=uuid&limit=1`,
      { headers: H }
    );
    if (!r.ok) return null;            // error de DB → no arriesgamos, no mandamos
    const rows = await r.json();
    return rows.length > 0;
  } catch { return null; }
}

export default async function handler(req, res) {
  // Auth: Vercel manda Authorization: Bearer {CRON_SECRET}
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Apagado por defecto: nada corre hasta que Federico prenda el flag.
  if (!ENABLED) {
    return res.status(200).json({ ok: true, skipped: 'ACTIVATION_AGENT_ENABLED!=true' });
  }

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * DAY).toISOString();

  // Orgs candidatas: en prueba, activas, registradas dentro de la ventana.
  const orgsRes = await fetch(
    `${SB_URL}/rest/v1/organizations?subscription_status=eq.trial&active=eq.true` +
      `&created_at=gte.${encodeURIComponent(windowStart)}` +
      `&select=id,name,email,created_at,activation&limit=200`,
    { headers: H }
  );
  if (!orgsRes.ok) return res.status(500).json({ error: 'orgs DB error' });
  const orgs = await orgsRes.json();

  let sent = 0, activated = 0, skipped = 0;
  // Deep-links al panel (el admin navega por /app/<tab>): cada aviso cae en el
  // lugar exacto donde se resuelve, no en la home genérica.
  const appUrl    = `${SITE}/app`;             // home / checklist de arranque
  const addUrl    = `${SITE}/app/inventory`;   // cargar un producto a mano
  const importUrl = `${SITE}/app/importar`;    // importar el catálogo desde Excel

  for (const org of orgs) {
    const email = (org.email || '').trim();
    if (!email) { skipped++; continue; }

    const st = org.activation || {};
    if (st.activated_at) { skipped++; continue; }    // ya activó en una corrida previa

    // Re-chequeo en vivo: ¿ya cargó catálogo? Si sí, marcamos y cortamos.
    const activo = await hasPricedProduct(org.id);
    if (activo === null) { skipped++; continue; }    // error DB → no arriesgamos
    if (activo === true) {
      await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org.id)}`, {
        method: 'PATCH', headers: HJSON,
        body: JSON.stringify({ activation: { ...st, activated_at: new Date().toISOString() } }),
      });
      activated++; continue;
    }

    // Etapa que corresponde según la edad de la cuenta.
    const age = now - new Date(org.created_at).getTime();
    let target = 0;
    if (age >= STAGE_AT[3]) target = 3;
    else if (age >= STAGE_AT[2]) target = 2;
    else if (age >= STAGE_AT[1]) target = 1;

    const current = Number(st.stage || 0);
    if (target === 0 || target <= current) { skipped++; continue; } // todavía no toca / ya enviado

    // Defensa extra anti-spam: nunca dos avisos en menos de MIN_GAP.
    if (st.last_nudge_at && (now - new Date(st.last_nudge_at).getTime()) < MIN_GAP) {
      skipped++; continue;
    }

    try {
      const tpl = templates.activacion({ empresa: org.name, stage: target, appUrl, importUrl, addUrl });
      await sendEmail({ to: email, ...tpl });
      await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${encodeURIComponent(org.id)}`, {
        method: 'PATCH', headers: HJSON,
        body: JSON.stringify({ activation: { ...st, stage: target, last_nudge_at: new Date().toISOString() } }),
      });
      sent++;
    } catch (e) {
      console.error('[cron-activacion] envío falló:', org.id, e.message);
      skipped++;
    }
  }

  return res.status(200).json({ ok: true, candidatas: orgs.length, sent, activated, skipped });
}
