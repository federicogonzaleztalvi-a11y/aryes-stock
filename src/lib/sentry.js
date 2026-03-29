import * as Sentry from '@sentry/react';
export function initSentry(session) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return null;
      return event;
    },
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
  if (session?.email) {
    Sentry.setUser({ email: session.email, username: session.name });
    Sentry.setTag('org_id', session.orgId || 'unknown');
    Sentry.setTag('role', session.role || 'unknown');
  }
}
export function setSentryUser(session) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (session?.email) {
    Sentry.setUser({ email: session.email, username: session.name });
    Sentry.setTag('org_id', session.orgId || 'unknown');
    Sentry.setTag('role', session.role || 'unknown');
  } else {
    Sentry.setUser(null);
  }
}
export { Sentry };
