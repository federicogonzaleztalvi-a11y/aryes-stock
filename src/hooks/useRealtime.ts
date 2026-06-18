// src/hooks/useRealtime.ts — Supabase Realtime multi-device sync
import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SKEY, getOrgId, getSession } from '../lib/constants.js';

let _client = null;
function getClient() {
  if (!_client) _client = createClient(SB_URL, SKEY, { realtime: { params: { eventsPerSecond: 10 } } });
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

    // CRÍTICO: el websocket debe autenticarse con el JWT del usuario, no con la
    // anon key. Las tablas tienen RLS por org_id; sin el token de usuario el
    // canal no pasa el filtro de RLS → CHANNEL_ERROR perpetuo y sync entre
    // dispositivos roto. setAuth empuja el access_token al canal al unirse.
    const applyAuth = () => {
      const token = getSession()?.access_token;
      if (token) client.realtime.setAuth(token);
    };
    applyAuth();

    // Cuando el JWT se renueva (refreshSession), reautenticamos el socket para
    // que el canal no se caiga al vencer el token viejo.
    const onRefreshed = () => applyAuth();
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
