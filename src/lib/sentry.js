import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: "https://d2e269337ba2248a447ef14c2c8fe3ca@o4511125463105536.ingest.us.sentry.io/4511125475819520",
  environment: import.meta.env.MODE || 'production',
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
