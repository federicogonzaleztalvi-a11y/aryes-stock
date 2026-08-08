// api/alert-test.js — TEMPORAL. Verifica la ruta REAL de la Torre de Control:
// log.error() dispara la alerta fire-and-forget y waitUntil mantiene viva la
// lambda hasta que el mail sale. Protegido con token. SE BORRA tras la prueba.
import { log } from './_log.js';

export default async function handler(req, res) {
  const token = req.query?.token || '';
  if (token !== 'pazque-torre-2026') return res.status(403).json({ error: 'forbidden' });
  log.error('alert-test', 'Prueba final Torre de Control — ruta real con waitUntil', {
    disparado_por: 'Federico (prueba manual)',
    momento: new Date().toISOString(),
    nota: 'Error intencional y seguro. Podés ignorarlo.',
  });
  return res.status(200).json({ ok: true, msg: 'Alerta disparada por la ruta real. Revisá federico@pazque.com.' });
}
