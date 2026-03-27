/**
 * useErrorReporting — captura errores no manejados en el browser.
 *
 * Escucha:
 *   - window.onerror (errores JS globales)
 *   - window.onunhandledrejection (Promises sin catch)
 *
 * En producción, logea via console.error con formato estructurado
 * para que aparezcan en los logs de Vercel Edge si se activa.
 *
 * Uso: llamar una vez en el componente raíz (main.jsx o App.jsx).
 */

import { useEffect } from 'react';

interface ErrorReport {
  ts:      string;
  level:   'error';
  service: 'browser';
  msg:     string;
  url:     string;
  line?:   number;
  col?:    number;
  stack?:  string;
  reason?: string;
}

function report(data: Omit<ErrorReport, 'ts' | 'level' | 'service'>): void {
  const entry: ErrorReport = {
    ts:      new Date().toISOString(),
    level:   'error',
    service: 'browser',
    ...data,
  };
  // Structured JSON — visible en browser console y en cualquier log aggregator
  console.error(JSON.stringify(entry));
}

export function useErrorReporting(): void {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Ignorar errores de scripts externos (extensiones de browser, etc.)
      if (event.filename && !event.filename.includes(window.location.hostname)) return;

      report({
        msg:   event.message || 'Unknown error',
        url:   event.filename || window.location.href,
        line:  event.lineno,
        col:   event.colno,
        stack: event.error?.stack?.split('\n').slice(0, 3).join(' | '),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report({
        msg:    'Unhandled promise rejection',
        url:    window.location.href,
        reason: typeof reason === 'string'
          ? reason.substring(0, 200)
          : (reason?.message || JSON.stringify(reason)).substring(0, 200),
        stack:  reason?.stack?.split('\n').slice(0, 3).join(' | '),
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
