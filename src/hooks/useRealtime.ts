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

    // Recuperación ante CHANNEL_ERROR. El PRIMER join corre una carrera con la
    // carga inicial de la página (socket/token aún asentándose) y a veces entra
    // en CHANNEL_ERROR. realtime-js reintenta el MISMO canal (mismo topic) y ese
    // canal queda "envenenado": no se recupera nunca. Verificado: un canal NUEVO
    // (topic nuevo) siempre conecta SUBSCRIBED. Así que ante error recreamos el
    // canal desde cero con backoff, y si insiste reseteamos el socket entero.
    let currentChannel: ReturnType<typeof client.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let disposed = false;

    const join = () => {
      if (disposed) return;
      if (currentChannel) {
        try { client.removeChannel(currentChannel); } catch { /* noop */ }
        currentChannel = null;
      }

      const channel = client.channel(`aryes_rt_${orgId}_${Date.now()}`, {
        config: { broadcast: { self: false } },
      });
      TABLES.forEach(table => {
        channel.on('postgres_changes', {
          event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}`,
        }, payload => dispatch(table, payload));
      });
      channel.subscribe((status, err) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          attempts = 0;
          console.info('[Realtime] Connected org:', orgId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          attempts += 1;
          const delay = Math.min(1000 * 2 ** (attempts - 1), 15000);
          // Sólo el primer error se loguea como warning; los reintentos en silencio
          // para no llenar la consola (es recuperación esperada, no un fallo real).
          if (attempts === 1) {
            console.warn('[Realtime] Channel error — reconnecting', err?.message || err || '');
          }
          // Si tras varios intentos sigue fallando, el socket puede estar tildado:
          // lo reseteamos para que el próximo subscribe levante uno fresco.
          if (attempts >= 3) { try { client.realtime.disconnect(); } catch { /* noop */ } }
          clearTimeout(retryTimer);
          retryTimer = setTimeout(join, delay);
        }
      });
      currentChannel = channel;
    };

    join();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener('aryes-session-refreshed', onRefreshed);
      if (currentChannel) {
        try { client.removeChannel(currentChannel); } catch { /* noop */ }
      }
    };
  }, [enabled, orgId, dispatch]);
}
