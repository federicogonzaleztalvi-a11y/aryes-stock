import { useEffect, useRef } from 'react';

// useSwipeBack — gesto "volver" tipo app nativa.
// ----------------------------------------------------------------------------
// Deslizar el dedo DESDE EL BORDE IZQUIERDO de la pantalla hacia la derecha
// ejecuta onBack(). onBack decide qué significa "volver" en cada pantalla y
// devuelve true si manejó el volver (había algo atrás) o false si no.
//
// Sin librerías: touch events propios. Sólo dispara si el toque arranca pegado
// al borde izquierdo (EDGE) y el arrastre es claramente horizontal hacia la
// derecha (THRESH) — así no choca con el scroll vertical de la página.
//
// Se usa igual en el portal del cliente, el de vendedores y la app de admin;
// cada uno pasa su propia lógica de onBack.
export default function useSwipeBack(onBack) {
  // Ref para que el listener siempre llame a la versión más fresca de onBack
  // (que depende del estado actual de la pantalla) sin re-registrar el listener.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

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
