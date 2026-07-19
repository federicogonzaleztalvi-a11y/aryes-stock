// api/_email.js — Email helper via Resend
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = 'Pazque <noreply@pazque.com>';

// HTML-escape para valores interpolados en los templates. Sin esto, un nombre de
// cliente o producto con "<script>"/HTML se inyecta en el email del admin (XSS
// almacenado en el cliente de correo). Todo dato controlado por el usuario pasa por acá.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendEmail({ to, subject, html, attachments }) {
  if (!RESEND_KEY) {
    console.warn('[email] RESEND_API_KEY not configured — skipping email');
    return null;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html, ...(attachments ? { attachments } : {}) }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[email] send failed:', err);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error('[email] error:', e.message);
    return null;
  }
}

export const templates = {
  nuevoPedido: (clienteNombre, items, total, empresa, currencySymbol) => ({
    subject: 'Nuevo pedido de ' + clienteNombre + ' - ' + (empresa || 'Pazque'),
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:20px;font-weight:700;color:#1a1a18;margin:0 0 4px">Nuevo pedido recibido</h1>
        <p style="font-size:14px;color:#6a6a68;margin:0 0 20px">Cliente: <strong>${esc(clienteNombre)}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1a1a18">
          <thead>
            <tr style="border-bottom:2px solid #efefeb;text-align:left">
              <th style="padding:8px 0">Producto</th>
              <th style="padding:8px 0;text-align:center">Cant.</th>
              <th style="padding:8px 0;text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map(it => `
              <tr style="border-bottom:1px solid #f4f4f0">
                <td style="padding:8px 0">${esc(it.nombre || it.productName || '')}</td>
                <td style="padding:8px 0;text-align:center">${esc(it.cantidad || it.qty || 0)} ${esc(it.unidad || it.unit || '')}</td>
                <td style="padding:8px 0;text-align:right">${esc(currencySymbol || '$')} ${Math.round(Number(it.subtotal || 0))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:16px;padding-top:12px;border-top:2px solid #efefeb;font-size:14px;color:#4b4b48">
          <div style="text-align:right;margin-bottom:4px">Subtotal: ${esc(currencySymbol || '$')} ${Math.round((items || []).reduce((s,it)=>s+Number(it.subtotal||0),0))}</div>
          <div style="text-align:right;margin-bottom:8px">IVA: ${esc(currencySymbol || '$')} ${Math.round(Number(total || 0) - (items || []).reduce((s,it)=>s+Number(it.subtotal||0),0))}</div>
          <div style="text-align:right;font-size:16px;font-weight:700;color:#1a1a18">Total: ${esc(currencySymbol || '$')} ${Math.round(Number(total || 0))}</div>
        </div>
        <a href="https://pazque.com/app/portal" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Ver pedido en Pazque
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:28px">Pazque - Notificacion automatica de pedido.</p>
      </div>`,
  }),

  // Mail al DISTRIBUIDOR cuando un prospecto deja sus datos en el portal
  // (captación Camino B). Incluye la fuente de campaña (utm/fbclid) para saber
  // de qué anuncio llegó. Lo envía api/lead.js best-effort a order_notify_email.
  nuevoProspecto: (lead, empresa) => {
    const fuente = [lead.utm_source, lead.utm_campaign].filter(Boolean).join(' · ')
      || (lead.fbclid ? 'Meta Ads' : (lead.gclid ? 'Google Ads' : (lead.referrer || 'Directo')));
    const row = (label, val) => val
      ? `<tr><td style="padding:6px 0;color:#6a6a68;width:120px">${esc(label)}</td><td style="padding:6px 0;color:#1a1a18;font-weight:600">${esc(val)}</td></tr>`
      : '';
    return {
      subject: 'Nuevo prospecto: ' + (lead.nombre || 'sin nombre') + ' — ' + (empresa || 'Pazque'),
      html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:20px;font-weight:700;color:#1a1a18;margin:0 0 4px">Nuevo prospecto interesado</h1>
        <p style="font-size:13px;color:#6a6a68;margin:0 0 20px">Alguien pidió acceso desde tu portal.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${row('Nombre', lead.nombre)}
          ${row('WhatsApp', lead.tel)}
          ${row('Comercio', lead.comercio)}
          ${row('Ciudad', lead.ciudad)}
          ${row('Mensaje', lead.mensaje)}
          ${row('Fuente', fuente)}
        </table>
        <a href="https://wa.me/${esc(String(lead.tel || '').replace(/\D/g,''))}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Escribirle por WhatsApp
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:28px">Aprobalo desde Pazque → Prospectos para crearlo como cliente. Notificación automática de Pazque.</p>
      </div>`,
    };
  },

  // Mail al CLIENTE con su comprobante de pedido adjunto en PDF. Distinto del
  // nuevoPedido (que va a la casilla del distribuidor): éste lo pide el cliente
  // desde el portal tras confirmar, para tener su orden en PDF en su bandeja.
  comprobanteCliente: (empresa, ref, total) => ({
    subject: 'Tu comprobante de pedido ' + ref + ' — ' + (empresa || 'Pazque'),
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:20px;font-weight:700;color:#1a1a18;margin:0 0 6px">Comprobante de tu pedido</h1>
        <p style="font-size:14px;color:#4b4b48;line-height:1.6;margin:0 0 16px">
          ¡Gracias por tu pedido en <strong>${esc(empresa || 'Pazque')}</strong>!
          Adjuntamos tu orden de compra <strong>${esc(ref)}</strong> en PDF.
        </p>
        <div style="background:#f7f7f4;border-radius:10px;padding:14px 18px;font-size:14px;color:#1a1a18">
          <div style="display:flex;justify-content:space-between"><span style="color:#6a6a68">Orden</span><strong>${esc(ref)}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#6a6a68">Total</span><strong>$ ${Math.round(Number(total || 0))}</strong></div>
        </div>
        <p style="font-size:12px;color:#9a9a98;margin-top:28px">Pazque — Comprobante generado automáticamente. El detalle completo está en el PDF adjunto.</p>
      </div>`,
  }),

  welcome: (empresa) => ({
    subject: 'Bienvenido a Pazque',
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px">
        <img src="https://pazque.com/pazque-logo.png" alt="Pazque" style="height:28px;margin-bottom:24px" />
        <h1 style="font-size:22px;font-weight:700;color:#1a1a18;margin:0 0 12px">¡Bienvenido a Pazque!</h1>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 16px">
          Tu cuenta para <strong>${esc(empresa)}</strong> está lista. Tenés 14 días gratis para probar todas las funcionalidades.
        </p>
        <a href="https://pazque.com/app" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Empezar ahora →
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:32px">
          ¿Dudas? Escribinos a contacto@pazque.com
        </p>
      </div>`,
  }),

  paymentConfirmed: (empresa, amount) => ({
    subject: 'Pago confirmado — Pazque',
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px">
        <img src="https://pazque.com/pazque-logo.png" alt="Pazque" style="height:28px;margin-bottom:24px" />
        <h1 style="font-size:22px;font-weight:700;color:#1a1a18;margin:0 0 12px">¡Pago recibido!</h1>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 16px">
          Confirmamos tu pago de <strong>$${esc(amount)}</strong> para <strong>${esc(empresa)}</strong>. Tu suscripción está activa.
        </p>
        <a href="https://pazque.com/app" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Ir a Pazque →
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:32px">
          Podés ver y gestionar tu plan en Configuración → Plan.
        </p>
      </div>`,
  }),

  // Recordatorio de carrito abandonado al CLIENTE del portal B2B. Lo dispara
  // cron-carrito-abandonado.js cuando el cliente dejó productos sin confirmar.
  // stage: 1 = primer aviso (~4h), 2 = segundo aviso (~24h, más insistente).
  carritoAbandonado: ({ empresa, nombre, lineCount, portalUrl, logoUrl, stage }) => ({
    subject: stage >= 2
      ? `¿Seguís con tu pedido? Tu carrito te espera — ${empresa || 'Pazque'}`
      : `Dejaste productos en tu carrito 🛒 — ${empresa || 'Pazque'}`,
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(empresa || '')}" style="height:36px;max-width:180px;object-fit:contain;margin-bottom:24px" />` : ''}
        <h1 style="font-size:21px;font-weight:700;color:#1a1a18;margin:0 0 10px">
          ${stage >= 2 ? 'Tu carrito sigue esperándote' : 'Te quedaron productos en el carrito'}
        </h1>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 8px">
          Hola ${esc(nombre || '')}, dejaste <strong>${esc(lineCount)} ${Number(lineCount) === 1 ? 'producto' : 'productos'}</strong> en tu carrito en <strong>${esc(empresa || 'el portal')}</strong> y todavía no confirmaste el pedido.
        </p>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 20px">
          ${stage >= 2
            ? 'Cuando quieras lo retomás — está guardado tal cual lo dejaste.'
            : 'Confirmalo en un toque, está guardado tal cual lo dejaste.'}
        </p>
        <a href="${esc(portalUrl)}" style="display:inline-block;padding:13px 30px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Ver mi carrito →
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:28px;line-height:1.5">
          Si ya hiciste el pedido, ignorá este mensaje. Recordatorio automático de ${esc(empresa || 'Pazque')}.
        </p>
      </div>`,
  }),

  trialExpiring: (empresa, daysLeft) => ({
    subject: daysLeft <= 1 ? 'Tu prueba de Pazque vence hoy' : `Te quedan ${daysLeft} días de prueba — Pazque`,
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px">
        <img src="https://pazque.com/pazque-logo.png" alt="Pazque" style="height:28px;margin-bottom:24px" />
        <h1 style="font-size:22px;font-weight:700;color:#1a1a18;margin:0 0 12px">
          ${daysLeft <= 1 ? 'Tu prueba vence hoy' : 'Te quedan ' + daysLeft + ' días de prueba'}
        </h1>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 16px">
          Tu período de prueba en Pazque para <strong>${esc(empresa)}</strong> ${daysLeft <= 1 ? 'vence hoy' : 'vence en ' + Number(daysLeft) + ' días'}.
          Suscribite para seguir usando la plataforma sin interrupciones.
        </p>
        <a href="https://pazque.com/app" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Suscribirme →
        </a>
        <p style="font-size:13px;color:#6a6a68;margin-top:16px">
          Plan: $5.990/mes los primeros 3 meses.
        </p>
        <p style="font-size:12px;color:#9a9a98;margin-top:24px">
          Tus datos están seguros. Si no te suscribís, tu cuenta se pausa pero no se elimina.
        </p>
      </div>`,
  }),
};
