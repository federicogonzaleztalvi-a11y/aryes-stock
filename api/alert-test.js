// api/alert-test.js — TEMPORAL. Dispara un log.error de prueba para verificar
// que la Torre de Control (alerta por email) funciona de punta a punta.
// Protegido con token para que nadie más lo active. SE BORRA tras la prueba.
import { log } from './_log.js';

export default async function handler(req, res) {
  const token = req.query?.token || '';
  if (token !== 'pazque-torre-2026') return res.status(403).json({ error: 'forbidden' });
  log.error('alert-test', 'Prueba de la Torre de Control — si ves este mail, las alertas funcionan (post-SPF)', {
    disparado_por: 'Federico (prueba manual)',
    momento: new Date().toISOString(),
    nota: 'Este error es intencional y seguro. Podés ignorarlo.',
  });
  return res.status(200).json({ ok: true, msg: 'Alerta disparada. Revisá federico@pazque.com en ~1 min.' });
}
