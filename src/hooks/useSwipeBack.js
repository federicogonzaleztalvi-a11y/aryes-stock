import { useEffect, useRef } from 'react';

// useSwipeBack — gesto "volver" tipo app nativa + botón físico "atrás" de Android.
// ----------------------------------------------------------------------------
// Deslizar el dedo DESDE EL BORDE IZQUIERDO de la pantalla hacia la derecha
// ejecuta onBack(). onBack decide qué significa "volver" en cada pantalla y
// devuelve true si manejó el volver (había algo atrás) o false si no.
//
// Sin librerías: touch events propios. Sólo dispara si el toque arranca pegado
// al borde izquierdo (EDGE) y el arrastre es claramente horizontal hacia la
// derecha (THRESH) — así no choca con el scroll vertical de la página.
//
// ADEMÁS engancha el botón "atrás" de hardware/gesto de Android (e iOS Chrome):
// ese botón NO dispara los touch events, dispara el evento `popstate` del
// historial. Como la app es una SPA y no empuja entradas al historial, antes
// el back de Android se salía del portal. Acá dejamos "armada" una entrada
// trampa: al apretar atrás cae el popstate, llamamos al MISMO onBack y, si hubo
// algo que cerrar (devolvió true), re-armamos la trampa para la próxima. Si no
// hay nada atrás (false), dejamos que el back salga de verdad.
//
// Se usa igual en el portal del cliente, el de vendedores y la app de admin;
// cada uno pasa su propia lógica de onBack.
export default function useSwipeBack(onBack) {
  // Ref para que el listener siempre llame a la versión más fresca de onBack
  // (que depende del estado actual de la pantalla) sin re-registrar el listener.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  // ── Botón físico "atrás" de Android (popstate del historial) ──────────────
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Armamos una entrada "trampa" en el historial para tener algo que "pop".
    const arm = () => { try { window.history.pushState({ __pzqTrap: 1 }, ''); } catch { /* noop */ } };
    arm();

    // iOS Safari a veces dispara un `popstate` "fantasma" apenas carga la página
    // (sin que el usuario haya tocado atrás). Si lo tratáramos como un "volver"
    // real, ese pop se comería la trampa y, más tarde, el back del navegador se
    // saldría del sitio (ej: al volver desde la ficha de un producto). Por eso
    // consideramos la trampa "activa" recién después de la PRIMERA interacción
    // del usuario (o de 1s): antes de eso, cualquier popstate se neutraliza
    // re-armando la trampa en lugar de disparar el volver.
    let ready = false;
    const markReady = () => { ready = true; };
    window.addEventListener('pointerdown', markReady, { once: true, passive: true });
    window.addEventListener('touchstart', markReady, { once: true, passive: true });
    window.addEventListener('keydown', markReady, { once: true });
    const readyTimer = setTimeout(markReady, 1000);

    const onPop = () => {
      if (!ready) { arm(); return; } // popstate fantasma pre-interacción: re-armamos y salimos
      let handled = false;
      try { handled = !!(onBackRef.current && onBackRef.current()); } catch { /* noop */ }
      if (handled) {
        // Cerramos algo interno: re-armamos la trampa para la próxima vez.
        arm();
      } else {
        // No había nada atrás: dejamos salir de verdad (cerrar/atrás del navegador).
        window.history.back();
      }
    };
    window.addEventListener('popstate', onPop);

    // Al volver desde el back-forward cache (bfcache) de iOS Safari la trampa
    // puede quedar "abajo" en el historial; la re-armamos para no quedar sin red.
    const onShow = (e) => { if (e && e.persisted) arm(); };
    window.addEventListener('pageshow', onShow);

    return () => {
      clearTimeout(readyTimer);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('pointerdown', markReady);
      window.removeEventListener('touchstart', markReady);
      window.removeEventListener('keydown', markReady);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const EDGE = 28;     // px desde el borde izq donde puede arrancar el gesto
    const THRESH = 70;   // px horizontales mínimos para disparar el "volver"
    let startX = 0, startY = 0, tracking = false;

    const onStart = (e) => {
      const t = e.touches && e.touches[0];
      if (!t) { tracking = false; return; }
      if (t.clientX <= EDGE) { tracking = true; startX = t.clientX; startY = t.clientY; }
      else tracking = false;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (dx > THRESH && Math.abs(dy) < 50) {
        tracking = false;
        try { onBackRef.current && onBackRef.current(); } catch { /* noop */ }
      }
    };
    const onEnd = () => { tracking = false; };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);
}
