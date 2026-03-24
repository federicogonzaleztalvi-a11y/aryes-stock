// Serverless proxy for Anthropic API — keeps ANTHROPIC_KEY server-side only
// Never expose this key to the browser bundle

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const ALLOWED_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';
const SB_URL       = process.env.SUPABASE_URL || 'https://mrotnqybqvmvlexncvno.supabase.co';
// No fallback — missing key causes verifySession() to always return null → 401 on every call.
// Fail loudly: a missing anon key means auth is broken, not silently degraded.
const SB_ANON_KEY  = process.env.SUPABASE_ANON_KEY;

// Verify JWT signature via Supabase Auth — rejects forged/expired tokens
async function verifySession(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { 'apikey': SB_ANON_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify JWT signature via Supabase — rejects forged, expired, or fake tokens
  const user = await verifySession(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!SB_ANON_KEY) {
    console.error('[chat] SUPABASE_ANON_KEY env var is not set');
    return res.status(503).json({ error: 'Auth service misconfigured' });
  }

  if (!ANTHROPIC_KEY) {
    return res.status(503).json({ error: 'AI assistant not configured' });
  }

  const { messages, system, model, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: Math.min(max_tokens || 600, 1000), // cap at 1000
        system,
        messages,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error('[chat] Anthropic error:', r.status, err);
      return res.status(r.status).json({ error: err.error?.message || 'AI service error' });
    }

    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    console.error('[chat] fetch error:', e.message);
    return res.status(500).json({ error: 'Connection error' });
  }
}
