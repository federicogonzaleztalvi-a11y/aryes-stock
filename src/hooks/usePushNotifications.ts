// src/hooks/usePushNotifications.ts
// Web Push Notifications — Delivery Hero principle
// Registers service worker, requests permission, saves subscription

import { useState, useEffect, useCallback } from 'react';
import { getOrgId } from '../lib/constants.js';

const API_BASE = '/api/push';

export type PushState = 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'loading';

export function usePushNotifications(role = 'admin') {
  const [state,    setState]    = useState<PushState>('loading');
  const [error,    setError]    = useState<string | null>(null);

  // Check current status on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') { setState('denied'); return; }

    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(sub => {
      setState(sub ? 'subscribed' : 'prompt');
    }).catch(() => setState('prompt'));
  }, []);

  // Register SW + subscribe
  const subscribe = useCallback(async () => {
    setError(null);
    setState('loading');
    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // 2. Get VAPID public key from server
      const keyRes = await fetch(`${API_BASE}?action=vapid-key`);
      if (!keyRes.ok) throw new Error('Push not configured on server');
      const { publicKey } = await keyRes.json();

      // 3. Subscribe with VAPID
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 4. Save subscription to server
      const saveRes = await fetch(`${API_BASE}?action=subscribe`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON(), orgId: getOrgId(), role }),
      });
      if (!saveRes.ok) throw new Error('Failed to save subscription');

      setState('subscribed');
    } catch (err: any) {
      const msg = err?.message || 'Error desconocido';
      setError(msg);
      setState(Notification.permission === 'denied' ? 'denied' : 'prompt');
    }
  }, [role]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
    setState('prompt');
  }, []);

  return { state, error, subscribe, unsubscribe };
}

// Send push from client (for testing) — normally sent from server
export async function sendPush(orgId: string, payload: {
  title?: string; body: string; url?: string; tag?: string; urgent?: boolean;
}) {
  const r = await fetch(`${API_BASE}?action=send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ orgId, ...payload }),
  });
  return r.ok;
}

// Utility — convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw      = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
