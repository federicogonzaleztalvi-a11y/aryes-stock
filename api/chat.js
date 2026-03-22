// Serverless proxy for Anthropic API — keeps ANTHROPIC_KEY server-side only
// Never expose this key to the browser bundle

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const ALLOWED_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Must have a valid Supabase session token — prevents unauthenticated usage
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
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
