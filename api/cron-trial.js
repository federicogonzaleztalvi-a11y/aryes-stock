// api/cron-trial.js — Daily cron: send email to orgs with trial expiring in 3 days
import { sendEmail, templates } from './_email.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends this header)
  const auth = req.headers.authorization;
  if (auth !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const in2days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  // Find orgs with trial ending in ~3 days
  const r = await fetch(
    SB_URL + '/rest/v1/organizations?subscription_status=eq.trial&trial_ends_at=gte.' + encodeURIComponent(in2days) + '&trial_ends_at=lte.' + encodeURIComponent(in3days) + '&select=id,name,email,trial_ends_at&limit=50',
    { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }
  );

  if (!r.ok) return res.status(500).json({ error: 'DB error' });
  const orgs = await r.json();

  let sent = 0;
  for (const org of orgs) {
    if (!org.email) continue;
    const daysLeft = Math.max(0, Math.ceil((new Date(org.trial_ends_at) - now) / 86400000));
    try {
      const tpl = templates.trialExpiring(org.name || '', daysLeft);
      await sendEmail({ to: org.email, ...tpl });
      sent++;
    } catch (e) {
      console.error('[cron-trial] email failed:', org.id, e.message);
    }
  }

  // ── Also check orgs whose trial expired today (send "trial ended" email) ──
  const expired = await fetch(
    SB_URL + '/rest/v1/organizations?subscription_status=eq.trial&trial_ends_at=lte.' + encodeURIComponent(now.toISOString()) + '&select=id,name,email,trial_ends_at&limit=50',
    { headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC } }
  );

  let expiredSent = 0;
  if (expired.ok) {
    const expiredOrgs = await expired.json();
    for (const org of expiredOrgs) {
      if (!org.email) continue;
      try {
        const tpl = templates.trialExpired ? templates.trialExpired(org.name || '') : {
          subject: 'Tu período de prueba en Pazque terminó',
          html: '<div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px"><img src="https://pazque.com/pazque-logo.png" alt="Pazque" style="height:28px;margin-bottom:24px" /><h2 style="font-size:20px;color:#1a1a18;margin:0 0 12px">Tu prueba gratuita terminó</h2><p style="font-size:14px;color:#4a4a48;line-height:1.6">Hola ' + (org.name||'') + ', tu período de prueba de 14 días en Pazque terminó.</p><p style="font-size:14px;color:#4a4a48;line-height:1.6">Para seguir usando la plataforma, activá tu suscripción por <strong>USD 149/mes</strong>.</p><a href="https://pazque.com/app" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Activar suscripción</a><p style="font-size:12px;color:#9a9a98;margin-top:24px">Tus datos están seguros y se mantienen por 30 días.</p></div>',
        };
        await sendEmail({ to: org.email, ...tpl });
        expiredSent++;
        // Update status to expired
        await fetch(SB_URL + '/rest/v1/organizations?id=eq.' + org.id, {
          method: 'PATCH',
          headers: { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ subscription_status: 'expired' }),
        });
      } catch (e) {
        console.error('[cron-trial] expired email failed:', org.id, e.message);
      }
    }
  }

  return res.status(200).json({ ok: true, checked: orgs.length, sent, expiredChecked: expired.ok ? (await expired.clone().json()).length : 0, expiredSent });
}
