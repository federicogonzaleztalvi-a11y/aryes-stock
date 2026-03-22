export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL || 'https://mrotnqybqvmvlexncvno.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Test DB connectivity with service role
  let dbTest = 'not_attempted';
  let dbStatus = null;
  let dbError = null;
  
  if (SERVICE_KEY) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/users?select=role&limit=1`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      dbStatus = r.status;
      const body = await r.text();
      dbTest = r.ok ? 'ok:' + body.slice(0, 100) : 'failed:' + body.slice(0, 100);
    } catch(e) {
      dbError = e.message;
      dbTest = 'threw';
    }
  }
  
  res.status(200).json({
    ok: true,
    has_service_key: !!SERVICE_KEY,
    service_key_prefix: SERVICE_KEY ? SERVICE_KEY.slice(0, 20) + '...' : null,
    sb_url: SB_URL,
    db_test: dbTest,
    db_status: dbStatus,
    db_error: dbError
  });
}
