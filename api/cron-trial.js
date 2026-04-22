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

  return res.status(200).json({ ok: true, checked: orgs.length, sent });
}
