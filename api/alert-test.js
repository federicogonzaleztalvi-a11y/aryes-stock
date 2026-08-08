// api/alert-test.js — TEMPORAL / DIAGNÓSTICO. Espera (await) el envío del email
// y devuelve la respuesta REAL de Resend, para distinguir si el problema es el
// envío (Resend) o la entrega (Zoho/SPF). Protegido con token. SE BORRA tras la prueba.
import { sendEmail } from './_email.js';

export default async function handler(req, res) {
  const token = req.query?.token || '';
  if (token !== 'pazque-torre-2026') return res.status(403).json({ error: 'forbidden' });
  const to = process.env.ALERT_EMAIL || 'contacto@pazque.com';
  const r = await sendEmail({
    to,
    subject: '✅ Diagnóstico Torre de Control (await directo)',
    html: '<p>Si ves esto, el envío directo funciona. Prueba de diagnóstico post-SPF.</p>',
  });
  return res.status(200).json({
    to,
    resend_ok: !!r,
    resend_response: r || null,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    has_resend_key: !!process.env.RESEND_API_KEY,
  });
}
