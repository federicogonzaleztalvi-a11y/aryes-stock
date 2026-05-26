import { lazy } from 'react';

// Envuelve un import dinámico para auto-recuperarse cuando un deploy
// cambió los hashes de los chunks y el navegador tiene el index viejo.
// Si el import falla por chunk inexistente, recarga la página UNA sola vez.
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
      const yaRecargo = sessionStorage.getItem(KEY) === '1';
      if (esErrorDeChunk && !yaRecargo) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // Devuelve un módulo vacío mientras recarga (no se llega a renderizar)
        return { default: () => null };
      }
      throw err; // ya recargó una vez, o es otro error → propagar
    }
  });
}
