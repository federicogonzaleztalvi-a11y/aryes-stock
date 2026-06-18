// src/hooks/useRealtime.ts — Supabase Realtime multi-device sync (Broadcast-from-DB)
//
// Antes usábamos postgres_changes (CDC), pero el worker PostgresCdcRls del tenant
// crasheaba con :queue_timeout y nunca entregaba (canal SUBSCRIBED, cero eventos).
// Ahora sincronizamos por Broadcast: triggers en la base emiten un broadcast
// PRIVADO al topic 'org:<org_id>' en cada INSERT/UPDATE/DELETE (ver
// supabase-broadcast-sync.sql). Acá nos suscribimos a ese topic y despachamos a
// los mismos callbacks con la forma { eventType, new, old }.
import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SKEY, getOrgId, getSession } from '../lib/constants.js';

let _client = null;
function getClient() {
  if (!_client) {
    // accessToken propio: nuestra auth vive en localStorage (no usamos supabase
    // auth-js). El callback devuelve SIEMPRE el JWT del usuario, así que cada
    // join/reconnect (y los canales PRIVADOS, que se autorizan por RLS contra
    // realtime.messages) van autenticados. Sin esto el cliente caería al anon
    // key y el server rechazaría por RLS.
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
    if (!orgId || orgId === '__no_org__') return;
    const client = getClient();

    // Al renovarse el JWT, empujamos el token nuevo a los canales abiertos con
    // setAuth() (sin arg → re-lee el fresco vía el callback accessToken) para no
    // esperar a un reconnect. Importante en canales privados (re-autoriza).
    const onRefreshed = () => {
      try { client.realtime.setAuth(); } catch { /* noop */ }
    };
    window.addEventListener('aryes-session-refreshed', onRefreshed);

    // El topic DEBE ser exactamente 'org:<org_id>' para casar con la policy de
    // realtime.messages (rt_receive_own_org). Ante CHANNEL_ERROR recreamos el
    // canal con el MISMO topic y backoff; si insiste, reseteamos el socket.
    const topic = `org:${orgId}`;
    let currentChannel: ReturnType<typeof client.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let disposed = false;

    const join = async () => {
      if (disposed) return;
      if (currentChannel) {
        try { client.removeChannel(currentChannel); } catch { /* noop */ }
        currentChannel = null;
      }

      // CRÍTICO para canales PRIVADOS: subscribe() dispara el POST de autorización
      // (contra realtime.messages/RLS) con el token YA cacheado en el socket. Como
      // nuestra auth es async (callback accessToken), ese token arranca en null/anon
      // y la policy rt_receive_own_org deniega ("Unauthorized... topic org:<id>"):
      // get_my_org_id() sin claim email -> NULL -> 'org:x' = 'org:'||NULL = NULL.
      // setAuth() (sin arg) re-lee el JWT fresco vía el callback y lo empuja al
      // socket ANTES de subscribe, así la autorización va con el email del usuario.
      try { await client.realtime.setAuth(); } catch { /* noop */ }
      if (disposed) return;

      const channel = client.channel(topic, {
        config: { private: true, broadcast: { self: false } },
      });

      // Un único evento 'change' para todas las tablas; el payload trae la tabla.
      channel.on('broadcast', { event: 'change' }, (msg: any) => {
        const p = msg?.payload;
        if (!p?.table) return;
        dispatch(p.table, { eventType: p.operation, new: p.record, old: p.old_record });
      });

      channel.subscribe((status, err) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          attempts = 0;
          console.info('[Realtime] Connected org:', orgId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          attempts += 1;
          const delay = Math.min(1000 * 2 ** (attempts - 1), 15000);
          if (attempts === 1) {
            console.warn('[Realtime] Channel error — reconnecting', err?.message || err || '');
          }
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
