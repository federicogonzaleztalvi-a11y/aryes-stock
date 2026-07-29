// api/_access.js — Gate de acceso por-org según estado de suscripción (Fix #2/#3)
// ============================================================================
// Qué resuelve:
//   Hoy el corte por falta de pago es client-side y fail-open (main.jsx hace
//   .catch → 'ok'), así que un trial vencido se saltea con devtools y el catálogo
//   sigue sirviéndose gratis para siempre. Este helper mueve el enforcement al
//   server: catalogo.js y pedido.js le preguntan si la org tiene acceso.
//
// Reglas (acordadas con Federico):
//   • PERÍODO DE GRACIA: no se corta el día que vence el trial. Se dan GRACE_DAYS
//     extra antes de bloquear.
//   • NUNCA se borra nada. El corte es SOLO un portón (catálogo/pedidos). La org,
//     sus productos, clientes, pedidos e historial quedan intactos en la base.
//     Reactivar = volver subscription_status a 'active'. Cero DELETE.
//   • FAIL-SAFE: ante cualquier duda (fallo de red/DB, org sin ficha, estado con
//     dato incompleto) NO se corta. Cortar es la acción agresiva; solo se hace
//     cuando hay certeza de que el trial venció pasada la gracia.
// ============================================================================

const SB_URL  = process.env.SUPABASE_URL;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// Días de gracia DESPUÉS del vencimiento del trial antes de cortar el servicio.
export const GRACE_DAYS = 5;

/**
 * @returns {Promise<{ok: boolean, status?: string, reason?: string, graceUntil?: string, degraded?: boolean}>}
 *   ok:true  → servir normal. ok:false → cortar (402). degraded:true → no se pudo
 *   evaluar con certeza, se sirve igual (fail-safe).
 */
export async function checkOrgAccess(org) {
  if (!org) return { ok: true, degraded: true };
  try {
    const key = SB_SVC || SB_ANON;
    const r = await fetch(
      SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(org) +
        '&select=active,subscription_status,trial_ends_at&limit=1',
      { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' } }
    );
    if (!r.ok) return { ok: true, degraded: true };          // fallo de DB → no cortar
    const rows = await r.json();
    const o = rows && rows[0];
    if (!o) return { ok: true, degraded: true };             // org sin ficha → no cortar

    // Deshabilitación explícita por admin (no es billing, pero también corta).
    if (o.active === false) return { ok: false, status: 'disabled', reason: 'org_disabled' };

    // Suscripción paga vigente → acceso pleno.
    if (o.subscription_status === 'active') return { ok: true, status: 'active' };

    // Trial (o cualquier estado con fecha) → válido hasta trial_ends_at + gracia.
    if (o.trial_ends_at) {
      const graceUntil = new Date(new Date(o.trial_ends_at).getTime() + GRACE_DAYS * 86400000);
      if (Date.now() <= graceUntil.getTime()) {
        return { ok: true, status: 'trial', graceUntil: graceUntil.toISOString() };
      }
      return { ok: false, status: 'expired', reason: 'trial_expired', graceUntil: graceUntil.toISOString() };
    }

    // Estado no-active y sin fecha → dato incompleto → no cortar (fail-safe).
    return { ok: true, status: o.subscription_status || 'unknown', degraded: true };
  } catch (e) {
    return { ok: true, degraded: true };                     // excepción → no cortar
  }
}
