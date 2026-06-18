// src/hooks/useRealtime.ts — Supabase Realtime multi-device sync
import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SKEY, getOrgId, getSession } from '../lib/constants.js';

let _client = null;
function getClient() {
  if (!_client) {
    // CRÍTICO: pasamos `accessToken` como callback. Nuestra auth vive en
    // localStorage (no usamos supabase auth-js), así que sin esto el cliente
    // inyecta su propio _getAccessToken → auth.getSession() es null → cae al
    // anon key. Al conectar el socket, realtime-js llama _setAuthSafely('connect')
    // → setAuth() sin token → usa ese callback y PISA con anon el JWT que
    // habíamos puesto a mano → el server rechaza por RLS → CHANNEL_ERROR perpetuo.
    // Con accessToken propio, el callback devuelve SIEMPRE el JWT del usuario
    // (y al renovarse el token, en cada reconnect/heartbeat lee el fresco solo).
    _client = createClient(SB_URL, SKEY, {
      accessToken: async () => getSession()?.access_token ?? null,
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
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

    // El JWT del usuario lo provee el callback `accessToken` del cliente (ver
    // getClient): en cada join/reconnect realtime-js lo lee de localStorage, así
    // que el canal siempre se une autenticado contra RLS. Al renovarse el JWT
    // empujamos el token nuevo a los canales abiertos con setAuth() (sin arg →
    // re-lee el fresco vía callback) para no esperar a un reconnect.
    const onRefreshed = () => {
      try { client.realtime.setAuth(); } catch { /* noop */ }
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
