// api/_keycheck.js — VERIFICADOR TEMPORAL de la service-role key.
// Gated por ?secret=... para no exponerlo. Hace una operación que SOLO el rol
// service_role puede (UPDATE en clients, con id que no matchea → no toca datos) y
// reporta si la key actual resuelve como service_role o como anon (rota).
// BORRAR después de confirmar que la key quedó bien.

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = 'aryes-keycheck-7x9q';

export default async function handler(req, res) {
  if ((req.query?.secret || '') !== SECRET) return res.status(404).json({ error: 'not found' });
  if (!SB_URL) return res.status(200).json({ ok: false, reason: 'SB_URL faltante' });
  if (!SB_SVC) return res.status(200).json({ ok: false, svcSet: false, reason: 'SUPABASE_SERVICE_ROLE_KEY vacía o no seteada' });

  // Pistas del valor SIN exponerlo: largo + primeros chars (eyJ = JWT legacy, sb_ = key nueva).
  const pref = SB_SVC.slice(0, 3);
  let out = { svcSet: true, keyLen: SB_SVC.length, keyPrefix: pref };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/clients?id=eq.__keycheck_nomatch_zzz__`, {
      method: 'PATCH',
      headers: {
        apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ razon_social: 'x' }),
    });
    const body = await r.text().catch(() => '');
    out.status = r.status;
    out.works = r.status >= 200 && r.status < 300;   // service_role puede → 2xx; anon/rota → 401/403
    out.hint = body.slice(0, 140);
  } catch (e) {
    out.works = false;
    out.error = String(e && e.message || e).slice(0, 140);
  }
  return res.status(200).json(out);
}
