// api/_cabinet-actions.js — REGISTRY de acciones del Jefe de Gabinete.
//
// Es el corazón de la aprobación-con-un-clic. Define QUÉ puede ejecutar el Jefe
// cuando Federico aprieta "aprobar" en el email, y CÓMO lo ejecuta. Lo usan dos
// lados: el cron (para PROPONER acciones) y api/cabinet-action.js (para EJECUTARlas
// cuando Federico confirma por POST).
//
// PRINCIPIOS DE SEGURIDAD (esto es lo que hace que sea "aprobación con un clic"
// sin convertirse en un agente suelto):
//   • Whitelist tipada: solo existen los `tipo` definidos acá abajo. El `tipo` y la
//     forma del payload se validan SIEMPRE; nada que venga de un lead/cliente se
//     ejecuta como instrucción (los datos del lead son solo valores de un UPDATE).
//   • Cada acción es INTERNA y REVERSIBLE: cambia estado en nuestras tablas
//     (pazque_leads, organizations, cabinet_loops). NINGUNA manda un mensaje a un
//     cliente ni a un prospecto — enviar sigue siendo un acto humano (deep-link a
//     WhatsApp que Federico toca él mismo). Cero riesgo de spam.
//   • El token es una llave de capacidad: imposible de adivinar, un solo uso, vence.
//     Vive solo en el inbox de Federico. La ejecución es por POST (nunca GET), así
//     ningún prefetch/escáner de mails dispara una acción.
// ----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const H     = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
const HJSON = { ...H, 'Content-Type': 'application/json' };
const DAY   = 86_400_000;

// Días de follow-up por defecto cuando marcás un prospecto como contactado.
const FOLLOW_UP_DAYS = Math.max(1, Number(process.env.OWNER_FOLLOW_UP_DAYS || 3));

async function sbGet(path) {
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; }
  catch { return null; }
}
async function sbPatch(path, body) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: { ...HJSON, Prefer: 'return=minimal' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path} → ${r.status} ${await r.text().catch(() => '')}`);
}
function nowISO(ms = Date.now()) { return new Date(ms).toISOString(); }

// ── EL REGISTRY ──────────────────────────────────────────────────────────────
// tipo → { verbo (botón), resumen(payload) (qué pasará), wa(payload) (deep-link
// opcional para enviar a mano), execute(payload) (el efecto, server-side) }.
export const ACTION_TYPES = {
  // Marcar que ya contactaste a un prospecto propio (vos mandás el WhatsApp a mano
  // con el deep-link; esto deja el registro y agenda el seguimiento).
  lead_marcar_contactado: {
    verbo: 'Marcar como contactado',
    resumen: (p) => `Vas a registrar que contactaste a ${p.nombre || p.empresa || 'el prospecto'} y agendar el seguimiento en ${FOLLOW_UP_DAYS} días.`,
    wa: (p) => (p.tel && p.mensaje) ? waLink(p.tel, p.mensaje) : '',
    async execute(p) {
      const id = p.lead_id;
      const cur = (await sbGet(`pazque_leads?id=eq.${id}&select=estado&limit=1`))?.[0];
      const patch = {
        ultimo_contacto_at: nowISO(),
        seguir_desde: nowISO(Date.now() + FOLLOW_UP_DAYS * DAY),
      };
      if ((cur?.estado || 'nuevo') === 'nuevo') patch.estado = 'contactado';
      await sbPatch(`pazque_leads?id=eq.${id}`, patch);
      return { mensaje: `Listo. ${p.nombre || 'El prospecto'} quedó como contactado; te lo recuerdo para seguir en ${FOLLOW_UP_DAYS} días.` };
    },
  },

  // Sacar un prospecto del pipeline (no encaja / no responde). Reversible desde /owner.
  lead_descartar: {
    verbo: 'Descartar prospecto',
    resumen: (p) => `Vas a descartar a ${p.nombre || p.empresa || 'el prospecto'} para despejar el pipeline. Lo podés reactivar desde /owner.`,
    async execute(p) {
      await sbPatch(`pazque_leads?id=eq.${p.lead_id}`, { estado: 'descartado' });
      return { mensaje: `Descartado. ${p.nombre || 'El prospecto'} ya no te aparece como pendiente.` };
    },
  },

  // Posponer el seguimiento de un prospecto N días (ahora no, más adelante).
  lead_posponer: {
    verbo: 'Posponer seguimiento',
    resumen: (p) => `Vas a posponer el seguimiento de ${p.nombre || p.empresa || 'el prospecto'} ${p.dias || 7} días.`,
    async execute(p) {
      const dias = Math.max(1, Math.min(90, Number(p.dias) || 7));
      await sbPatch(`pazque_leads?id=eq.${p.lead_id}`, { seguir_desde: nowISO(Date.now() + dias * DAY) });
      return { mensaje: `Pospuesto ${dias} días. Te lo vuelvo a traer cuando toque.` };
    },
  },

  // Extender la prueba de una distribuidora N días (dale aire para que active/pague).
  trial_extender: {
    verbo: 'Extender la prueba',
    resumen: (p) => `Vas a extender la prueba de ${p.nombre || 'la distribuidora'} ${p.dias || 7} días desde hoy.`,
    async execute(p) {
      const dias = Math.max(1, Math.min(60, Number(p.dias) || 7));
      await sbPatch(`organizations?id=eq.${encodeURIComponent(p.org_id)}`, { trial_ends_at: nowISO(Date.now() + dias * DAY) });
      return { mensaje: `Prueba de ${p.nombre || 'la distribuidora'} extendida ${dias} días.` };
    },
  },

  // Silenciar un loop N días: sigue abierto (no se pierde) pero deja de aparecer en
  // el parte hasta la fecha. Para cosas que ya viste y decidiste no tocar ahora.
  loop_silenciar: {
    verbo: 'Silenciar por una semana',
    resumen: (p) => `Vas a silenciar "${p.titulo || p.clave}" ${p.dias || 7} días. Sigue abierto, pero no te lo marco en el parte hasta entonces.`,
    async execute(p) {
      const dias = Math.max(1, Math.min(60, Number(p.dias) || 7));
      await sbPatch(`cabinet_loops?clave=eq.${encodeURIComponent(p.clave)}`, { silenciado_hasta: nowISO(Date.now() + dias * DAY) });
      return { mensaje: `Silenciado ${dias} días. No te jodo más con eso por ahora.` };
    },
  },
};

export function isValidTipo(tipo) { return Object.prototype.hasOwnProperty.call(ACTION_TYPES, tipo); }

// Deep-link de WhatsApp (click-to-chat). No envía: ABRE WhatsApp con el texto
// cargado para que Federico lo mande él mismo (enviar sigue siendo humano).
function waLink(tel, texto) {
  const digits = String(tel || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(texto || '').slice(0, 1200))}`;
}

function newToken() { return randomBytes(24).toString('hex'); } // 48 hex, imposible de adivinar

// ── Proponer una acción (dedup + token + vencimiento) ───────────────────────
// Si ya hay una propuesta viva con la misma dedup_clave, la REUSA (mismo token):
// así el mismo botón persiste día a día sin llenarte el inbox de duplicados.
export async function proposeAction({ tipo, titulo, resumen, payload = {}, dedup_clave, loop_clave = null, ttlDays = 7 }) {
  if (!isValidTipo(tipo)) throw new Error('tipo no permitido: ' + tipo);
  const nowMs = Date.now();

  if (dedup_clave) {
    const existing = await sbGet(
      `cabinet_actions?dedup_clave=eq.${encodeURIComponent(dedup_clave)}&estado=eq.propuesta&select=*&order=created_at.desc&limit=1`
    );
    const vivo = existing?.[0];
    if (vivo && (!vivo.expira_en || new Date(vivo.expira_en).getTime() > nowMs)) return vivo;
  }

  const row = {
    token: newToken(), tipo, titulo,
    resumen: resumen || ACTION_TYPES[tipo].resumen(payload),
    payload, dedup_clave: dedup_clave || null, loop_clave,
    estado: 'propuesta', expira_en: nowISO(nowMs + Math.max(1, ttlDays) * DAY),
  };
  const r = await fetch(`${SB_URL}/rest/v1/cabinet_actions`, {
    method: 'POST', headers: { ...HJSON, Prefer: 'return=representation' }, body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('crear acción → ' + r.status);
  return (await r.json())?.[0] || row;
}

export async function loadAction(token) {
  if (!token || !/^[a-f0-9]{48}$/.test(token)) return null;
  return (await sbGet(`cabinet_actions?token=eq.${token}&select=*&limit=1`))?.[0] || null;
}

// Ejecuta una acción YA validada (estado propuesta + no vencida). Marca el
// resultado en la fila (auditoría) y, si tenía loop, lo cierra.
export async function executeAction(row) {
  const def = ACTION_TYPES[row.tipo];
  if (!def) return { ok: false, mensaje: 'Tipo de acción desconocido.' };
  try {
    const out = await def.execute(row.payload || {});
    await sbPatch(`cabinet_actions?id=eq.${row.id}`, {
      estado: 'ejecutada', ejecutada_en: nowISO(), resultado: out || {},
    });
    if (row.loop_clave) {
      await sbPatch(`cabinet_loops?clave=eq.${encodeURIComponent(row.loop_clave)}`, {
        estado: 'resuelto', resuelto_en: nowISO(),
      }).catch(() => {});
    }
    return { ok: true, mensaje: out?.mensaje || 'Hecho.' };
  } catch (e) {
    await sbPatch(`cabinet_actions?id=eq.${row.id}`, {
      estado: 'fallida', resultado: { error: e.message },
    }).catch(() => {});
    return { ok: false, mensaje: 'No se pudo ejecutar: ' + e.message };
  }
}

export async function cancelAction(row) {
  await sbPatch(`cabinet_actions?id=eq.${row.id}`, { estado: 'descartada' }).catch(() => {});
  return { ok: true, mensaje: 'Acción descartada. No se hizo nada.' };
}
