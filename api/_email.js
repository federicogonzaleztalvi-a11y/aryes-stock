// api/_email.js — Email helper via Resend
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = 'Pazque <noreply@pazque.com>';

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_KEY) {
    console.warn('[email] RESEND_API_KEY not configured — skipping email');
    return null;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
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
  welcome: (empresa) => ({
    subject: 'Bienvenido a Pazque',
    html: `
      <div style="font-family:'Inter',system-ui,sans-serif;max-width:500px;margin:0 auto;padding:32px 24px">
        <img src="https://pazque.com/pazque-logo.png" alt="Pazque" style="height:28px;margin-bottom:24px" />
        <h1 style="font-size:22px;font-weight:700;color:#1a1a18;margin:0 0 12px">¡Bienvenido a Pazque!</h1>
        <p style="font-size:15px;color:#4b4b48;line-height:1.6;margin:0 0 16px">
          Tu cuenta para <strong>${empresa}</strong> está lista. Tenés 14 días gratis para probar todas las funcionalidades.
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
          Confirmamos tu pago de <strong>$${amount}</strong> para <strong>${empresa}</strong>. Tu suscripción está activa.
        </p>
        <a href="https://pazque.com/app" style="display:inline-block;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
          Ir a Pazque →
        </a>
        <p style="font-size:12px;color:#9a9a98;margin-top:32px">
          Podés ver y gestionar tu plan en Configuración → Plan.
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
          Tu período de prueba en Pazque para <strong>${empresa}</strong> ${daysLeft <= 1 ? 'vence hoy' : 'vence en ' + daysLeft + ' días'}. 
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
