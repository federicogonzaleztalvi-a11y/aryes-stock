// api/cron-reservations.js — Cron horario: libera reservas de stock vencidas
// ============================================================================
// Por qué existe (Fix #5):
//   El RPC create_b2b_order_with_reservations crea reservas con TTL (p_ttl_hours)
//   para que el stock disponible (ATP = físico − reservas) no se sobre-venda entre
//   "pedido hecho" y "admin confirma". Si el admin nunca confirma ni cancela, esas
//   reservas quedarían reteniendo stock para siempre. expire_stale_reservations()
//   marca como vencidas las que pasaron su TTL y libera ese stock. Estaba definida
//   en supabase-stock-reservations.sql pero NADIE la invocaba. Este cron la corre
//   cada hora.
//
//   Nota: solo tiene efecto real para orgs que controlan inventario
//   (no_controla_stock = false → el toggle "Controlo inventario" prendido), las
//   únicas que generan reservas. Para el resto es un no-op inofensivo.
// ============================================================================

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Verify cron secret (Vercel manda este header en los cron jobs).
  const auth = req.headers.authorization;
  if (auth !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/expire_stale_reservations', {
      method: 'POST',
      headers: {
        apikey: SB_SVC,
        Authorization: 'Bearer ' + SB_SVC,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[cron-reservations] RPC error:', r.status, detail);
      return res.status(500).json({ error: 'RPC error', status: r.status });
    }

    // La función devuelve la cantidad de reservas liberadas (si está tipada así).
    const freed = await r.json().catch(() => null);
    return res.status(200).json({ ok: true, freed });
  } catch (e) {
    console.error('[cron-reservations] failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
