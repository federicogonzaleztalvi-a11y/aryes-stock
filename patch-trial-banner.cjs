#!/usr/bin/env node
// patch-trial-banner.cjs — Add trial countdown banner to topbar

const fs = require('fs');
const path = require('path');

const mainPath = path.join(process.cwd(), 'src/App.jsx');
let app = fs.readFileSync(mainPath, 'utf8');

// 1. Add TrialBanner component before AryesApp function
const trialBannerComponent = `
// ── Trial countdown banner ────────────────────────────────────────
function TrialBanner({ session }) {
  const [daysLeft, setDaysLeft] = React.useState(null);
  React.useEffect(() => {
    if (!session?.orgId) return;
    const SB_URL = import.meta.env.VITE_SUPABASE_URL;
    const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(SB_URL + '/rest/v1/organizations?id=eq.' + encodeURIComponent(session.orgId) + '&select=subscription_status,trial_ends_at&limit=1', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + session.access_token }
    })
    .then(r => r.json())
    .then(orgs => {
      const org = orgs?.[0];
      if (!org || org.subscription_status !== 'trial' || !org.trial_ends_at) return;
      const days = Math.max(0, Math.ceil((new Date(org.trial_ends_at) - Date.now()) / 86400000));
      setDaysLeft(days);
    })
    .catch(() => {});
  }, [session?.orgId]);
  if (daysLeft === null || daysLeft > 14) return null;
  const urgent = daysLeft <= 3;
  return React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 12px',
      background: urgent ? '#fef2f2' : '#fffbeb',
      border: '1px solid ' + (urgent ? '#fecaca' : '#fde68a'),
      borderRadius: 6, fontSize: 12, fontWeight: 500,
      color: urgent ? '#dc2626' : '#92400e',
      whiteSpace: 'nowrap',
    }
  },
    urgent ? '⚠️' : '⏱',
    ' ',
    daysLeft === 0 ? 'Tu prueba vence hoy' : 'Prueba: ' + daysLeft + ' día' + (daysLeft !== 1 ? 's' : ''),
    React.createElement('a', {
      href: '/upgrade',
      style: {
        color: urgent ? '#dc2626' : '#92400e',
        fontWeight: 700,
        textDecoration: 'underline',
        marginLeft: 4,
      }
    }, 'Suscribite')
  );
}

`;

const appFnAnchor = '// LOGIN SCREEN';
if (!app.includes('TrialBanner')) {
  app = app.replace(appFnAnchor, trialBannerComponent + appFnAnchor);
  console.log('✅ Added TrialBanner component');
} else {
  console.log('⏭  TrialBanner already exists');
}

// 2. Insert TrialBanner in topbar, right before the demo mode button
const demoButtonLine = `{demoMode&&<button onClick={()=>window.location.href='/register'}`;
const trialBannerInsert = `{!demoMode&&<TrialBanner session={session} />}
          ${demoButtonLine}`;

if (!app.includes('TrialBanner session=')) {
  app = app.replace(demoButtonLine, trialBannerInsert);
  console.log('✅ Inserted TrialBanner in topbar');
} else {
  console.log('⏭  TrialBanner already in topbar');
}

fs.writeFileSync(mainPath, app, 'utf8');
console.log(`
══════════════════════════════════════════════
✅ Trial banner patched!
  - Shows "Prueba: X días" in yellow when > 3 days
  - Shows "⚠️ Tu prueba vence hoy" in red when ≤ 3 days
  - Link "Elegir plan" goes to /upgrade
  - Hidden when subscription is active or in demo mode
══════════════════════════════════════════════`);
