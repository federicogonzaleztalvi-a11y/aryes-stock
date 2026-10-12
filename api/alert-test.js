// api/alert-test.js — Disparador manual de una alerta de prueba (Torre de Control).
// ----------------------------------------------------------------------------
// Sirve para verificar end-to-end que el canal de alertas funciona (email y, si
// está configurado ALERT_WHATSAPP, también WhatsApp). Pasa por el MISMO logger
// central que una alerta real: llama log.error, que dispara maybeAlert (_alert.js).
//
// Protegido por token (CRON_SECRET o ALERT_TEST_TOKEN): sin el token no hace
// nada. No toca la DB ni cambia estado. Es solo un "ping" del caño de alertas.
//
//   GET /api/alert-test?secret=<CRON_SECRET | ALERT_TEST_TOKEN>
// ----------------------------------------------------------------------------
import { log } from './_log.js';

const CRON_SECRET = process.env.CRON_SECRET;
const TEST_TOKEN  = process.env.ALERT_TEST_TOKEN;

export default function handler(req, res) {
  const token = req.query?.secret || (req.headers.authorization || '').replace('Bearer ', '');
  const ok = (CRON_SECRET && token === CRON_SECRET) || (TEST_TOKEN && token === TEST_TOKEN);
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Dispara una alerta real por el canal central. El waitUntil de _log.js mantiene
  // viva la lambda hasta que el email/WhatsApp salen, aunque ya hayamos respondido.
  log.error('alert-test', 'Alerta de prueba de la Torre de Control', {
    nota: 'Si recibís esto por WhatsApp y/o email, el canal de alertas funciona.',
    cuando: new Date().toISOString(),
  });

  return res.status(200).json({ ok: true, disparada: true });
}
