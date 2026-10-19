import { lazy } from 'react';

// Purga dura del navegador: des-registra el Service Worker y borra todas las
// cachés. Es lo que hace falta cuando un SW VIEJO (de un deploy anterior) sigue
// sirviendo un index.html muerto que apunta a chunks que ya no existen. Un
// reload pelado no alcanza porque el SW vuelve a servir lo mismo.
async function purgarNavegador() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => {})));
    }
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
    }
  } catch {}
}

function recargarConCacheBust() {
  const u = new URL(window.location.href);
  u.searchParams.set('_r', Date.now().toString(36));
  window.location.replace(u.toString());
}

// Envuelve un import dinámico para auto-recuperarse cuando un deploy cambió los
// hashes de los chunks y el navegador (o un SW viejo) tiene el index muerto.
// Escalera de recuperación, para no dejar al usuario en la pantalla de error:
//   1er fallo → reload normal (cubre caché HTTP / blip de red).
//   2do fallo → purga SW + cachés y reload con cache-bust (cubre SW viejo).
//   3er fallo → propaga al error boundary (algo más raro).
export function lazyWithRetry(importer) {
  return lazy(async () => {
    const KEY = 'pazque_chunk_reload';
    try {
      const mod = await importer();
      sessionStorage.removeItem(KEY); // import OK → limpiar flag
      return mod;
    } catch (err) {
      const msg = String(err && err.message || '');
      const esErrorDeChunk =
        /dynamically imported module|Failed to fetch|Importing a module|error loading dynamically/i.test(msg);
      const intentos = parseInt(sessionStorage.getItem(KEY) || '0', 10);
      if (esErrorDeChunk && intentos < 2) {
        sessionStorage.setItem(KEY, String(intentos + 1));
        if (intentos === 0) {
          window.location.reload();                      // 1er intento: barato
        } else {
          await purgarNavegador();                        // 2do intento: SW viejo
          recargarConCacheBust();
        }
        // Módulo vacío mientras recarga (no se llega a renderizar).
        return { default: () => null };
      }
      throw err; // ya reintentó dos veces, o es otro error → propagar
    }
  });
}
