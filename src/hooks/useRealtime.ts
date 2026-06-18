// src/hooks/useRealtime.ts — Supabase Realtime multi-device sync
import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SKEY, getOrgId, getSession } from '../lib/constants.js';

let _client = null;
function getClient() {
  if (!_client) _client = createClient(SB_URL, SKEY, {
    // CRÍTICO: realtime-js 2.x usa por defecto el protocolo VSN 2.0.0, que el
    // servidor Realtime de este proyecto rechaza → CHANNEL_ERROR sin detalle.
    // Verificado por websocket directo: el join con VSN 1.0.0 + el JWT del
    // usuario responde "Subscribed to PostgreSQL" (status ok). Forzamos 1.0.0.
    realtime: { vsn: '1.0.0', params: { eventsPerSecond: 10 } },
  });
  return _client;
}

const TABLES = ['products','ventas','stock_movements','rutas','b2b_orders','clients'];

export function useRealtime(callbacks, enabled = true) {
  const orgId   = getOrgId();
  const cbRef   = useRef(callbacks);
  cbRef.current = callbacks;

  const dispatch = useCallback((table, payload) => {
    const cb = cbRef.current;
    if (table === 'products')         cb.onProductChange?.(payload);
    else if (table === 'ventas')      cb.onVentaChange?.(payload);
    else if (table === 'stock_movements') cb.onMovementChange?.(payload);
    else if (table === 'rutas')       cb.onRutaChange?.(payload);
    else if (table === 'b2b_orders')  cb.onB2bOrderChange?.(payload);
    else if (table === 'clients')     cb.onClienteChange?.(payload);
  }, []);

  useEffect(() => {
    if (!enabled || !SB_URL || !SKEY) return;
    const client = getClient();

    // CRÍTICO: el websocket debe unirse con el JWT del usuario, no con la anon
    // key — las tablas tienen RLS por org_id, así que con anon el servidor
    // responde CHANNEL_ERROR. setAuth(token) DEBE correr ANTES de subscribe:
    // es síncrono cuando se le pasa un token explícito, así que el join sale
    // ya con el access_token (evita la race condition del callback async, que
    // dejaba el primer join con anon y el canal en error perpetuo).
    const token = getSession()?.access_token;
    if (token) client.realtime.setAuth(token);

    // Al renovarse el JWT, reautenticamos el socket con el token nuevo para que
    // el canal no se caiga cuando vence el viejo.
    const onRefreshed = () => {
      const t = getSession()?.access_token;
      if (t) { try { client.realtime.setAuth(t); } catch { /* noop */ } }
    };
    window.addEventListener('aryes-session-refreshed', onRefreshed);

    const channel = client.channel(`aryes_rt_${orgId}_${Date.now()}`, {
      config: { broadcast: { self: false } },
    });
    TABLES.forEach(table => {
      channel.on('postgres_changes', {
        event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}`,
      }, payload => dispatch(table, payload));
    });
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED')    console.info('[Realtime] Connected org:', orgId);
      if (status === 'CHANNEL_ERROR') console.warn('[Realtime] Channel error — retrying', err?.message || err || '(sin detalle)');
      if (status === 'TIMED_OUT')     console.warn('[Realtime] Timed out');
    });
    return () => {
      window.removeEventListener('aryes-session-refreshed', onRefreshed);
      client.removeChannel(channel);
    };
  }, [enabled, orgId, dispatch]);
}
