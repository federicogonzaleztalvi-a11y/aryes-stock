import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: "https://d2e269337ba2248a447ef14c2c8fe3ca@o4511125463105536.ingest.us.sentry.io/4511125475819520",
  environment: import.meta.env.MODE || 'production',
  // Sólo reportar desde el build de producción. En `npm run dev` los errores ya se
  // ven en consola, y Fast Refresh/HMR genera transitorios (ej. "Cannot read
  // properties of null (reading 'useRef')") que NO son bugs reales → si Sentry los
  // manda, las alertas por mail gritan cuando no hay incendio y pierden valor.
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return null;
    return event;
  },
});

export function setSentryUser(session) {
  if (session?.email) {
    Sentry.setUser({ email: session.email, username: session.name });
    Sentry.setTag('org_id', session.orgId || 'unknown');
    Sentry.setTag('role', session.role || 'unknown');
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };
