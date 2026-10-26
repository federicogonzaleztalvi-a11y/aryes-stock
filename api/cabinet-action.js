// api/cabinet-action.js — aprobación con un clic del Jefe de Gabinete.
//
// Federico abre el link del email (GET) → ve una PÁGINA DE CONFIRMACIÓN con lo que
// va a pasar (no se ejecuta nada). Recién al apretar "Confirmar" (POST) el servidor
// ejecuta la acción. Ese corte GET-mira / POST-ejecuta es a propósito: los clientes
// de mail prefetchean los links, y un GET que ejecutara dispararía acciones solo.
//
// Seguridad: la única llave es el `token` (48 hex, en el inbox de Federico, un solo
// uso, vence). No hay sesión: quien tiene el token del email, es él. Las acciones
// posibles están en la whitelist de _cabinet-actions.js — todas internas y
// reversibles, ninguna manda mensajes.
// ----------------------------------------------------------------------------

import { loadAction, executeAction, cancelAction, ACTION_TYPES } from './_cabinet-actions.js';

const BRAND = '#052e24', ACCENT = '#059669';

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Página HTML (sobria, mobile-first — Federico la abre del cel). `tone`: ok|warn|info.
function page({ titulo, cuerpo, tone = 'info' }) {
  const bar = tone === 'ok' ? ACCENT : tone === 'warn' ? '#b45309' : BRAND;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Jefe de Gabinete</title></head>
<body style="margin:0;background:#f4f4f0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a18">
  <div style="max-width:460px;margin:0 auto;padding:40px 18px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="height:5px;background:${bar}"></div>
      <div style="padding:26px 24px">
        <div style="display:inline-block;background:${BRAND};color:#6ee7b7;font-size:10px;font-weight:700;padding:4px 11px;border-radius:20px;letter-spacing:.05em;margin-bottom:16px">JEFE DE GABINETE</div>
        <h1 style="font-size:19px;margin:0 0 12px;line-height:1.35">${titulo}</h1>
        ${cuerpo}
      </div>
    </div>
    <p style="text-align:center;color:#b5b5b2;font-size:11px;margin-top:18px">Pazque · aprobación con un clic</p>
  </div>
</body></html>`;
}

function send(res, status, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(html);
}

export default async function handler(req, res) {
  const token = (req.query?.t || req.body?.token || '').toString().trim();
  const row = await loadAction(token);

  if (!row) {
    return send(res, 404, page({
      tone: 'warn', titulo: 'No encontré esa acción',
      cuerpo: `<p style="color:#6a6a68;font-size:14px;line-height:1.6">El link puede estar mal copiado o la acción ya no existe. Abrí la consola y seguí desde ahí.</p>
      <a href="/owner" style="display:inline-block;margin-top:12px;color:${ACCENT};font-weight:600;text-decoration:none">Abrir consola →</a>`,
    }));
  }

  const def = ACTION_TYPES[row.tipo];
  const resumen = row.resumen || (def ? def.resumen(row.payload || {}) : '');
  const vencida = row.expira_en && new Date(row.expira_en).getTime() < Date.now();

  // Ya resuelta (idempotente): mostrar el estado final, no re-ejecutar.
  if (row.estado !== 'propuesta') {
    const map = {
      ejecutada:  ['ok',   'Esta acción ya se hizo', row.resultado?.mensaje || 'Ya estaba ejecutada.'],
      descartada: ['info', 'Esta acción fue descartada', 'No se hizo nada. Si querés, arrancá de nuevo desde la consola.'],
      expirada:   ['warn', 'Esta acción venció', 'Pasó la ventana para aprobarla. El Jefe te la vuelve a proponer si sigue vigente.'],
      fallida:    ['warn', 'Esta acción falló', row.resultado?.error ? 'Error: ' + row.resultado.error : 'No se pudo ejecutar.'],
    };
    const [tone, titulo, msg] = map[row.estado] || ['info', 'Acción ya resuelta', ''];
    return send(res, 200, page({ tone, titulo, cuerpo: `<p style="color:#6a6a68;font-size:14px;line-height:1.6">${esc(msg)}</p>` }));
  }

  if (vencida) {
    return send(res, 200, page({
      tone: 'warn', titulo: 'Esta acción venció',
      cuerpo: `<p style="color:#6a6a68;font-size:14px;line-height:1.6">Pasó la ventana para aprobarla sin riesgo. Si el tema sigue abierto, el Jefe te la vuelve a proponer en el próximo parte.</p>`,
    }));
  }

  // ── POST: Federico confirmó (o descartó) → ejecutar ───────────────────────
  if (req.method === 'POST') {
    const accion = (req.body?.x || req.query?.x || '').toString();
    const out = accion === 'cancel' ? await cancelAction(row) : await executeAction(row);
    return send(res, 200, page({
      tone: out.ok ? (accion === 'cancel' ? 'info' : 'ok') : 'warn',
      titulo: out.ok ? (accion === 'cancel' ? 'Listo, no hice nada' : '¡Hecho!') : 'No se pudo',
      cuerpo: `<p style="color:#6a6a68;font-size:14px;line-height:1.6">${esc(out.mensaje)}</p>
      <a href="/owner" style="display:inline-block;margin-top:14px;color:${ACCENT};font-weight:600;text-decoration:none">Abrir consola →</a>`,
    }));
  }

  // ── GET: página de confirmación (NO ejecuta nada) ─────────────────────────
  const wa = def?.wa ? def.wa(row.payload || {}) : '';
  const msg = row.payload?.mensaje;
  const waBlock = wa ? `
    <div style="margin:18px 0;padding:14px;background:#f7f7f4;border-radius:12px">
      <div style="font-size:11px;color:#9a9a98;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Mensaje listo para enviar</div>
      ${msg ? `<div style="font-size:13px;color:#3a3a38;line-height:1.55;white-space:pre-wrap">${esc(msg)}</div>` : ''}
      <a href="${esc(wa)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;background:#25d366;color:#0b3d1f;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;font-size:13px">Abrir WhatsApp y enviarlo vos →</a>
      <div style="font-size:11px;color:#9a9a98;margin-top:8px">El mensaje lo mandás vos desde WhatsApp. Abajo registrás que lo contactaste.</div>
    </div>` : '';

  const act = (x, label, color, filled) => `
    <form method="POST" action="/api/cabinet-action?t=${esc(row.token)}&x=${x}" style="margin:0">
      <button type="submit" style="width:100%;box-sizing:border-box;padding:13px;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;border:1px solid ${color};
        ${filled ? `background:${color};color:#fff` : `background:#fff;color:${color}`}">${label}</button>
    </form>`;

  return send(res, 200, page({
    titulo: esc(row.titulo),
    cuerpo: `
      <p style="color:#4a4a48;font-size:14px;line-height:1.6;margin:0 0 4px">${esc(resumen)}</p>
      ${waBlock}
      <div style="margin-top:18px;display:grid;gap:10px">
        ${act('do', def?.verbo || 'Confirmar', ACCENT, true)}
        ${act('cancel', 'No, cancelar', '#9a9a98', false)}
      </div>
      <p style="color:#b5b5b2;font-size:11px;line-height:1.5;margin-top:16px">Nada pasa hasta que apretás un botón. Esta acción es reversible desde la consola.</p>`,
  }));
}
