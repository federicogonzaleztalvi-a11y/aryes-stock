// Serverless proxy for Anthropic API — keeps ANTHROPIC_KEY server-side only
// Never expose this key to the browser bundle

import { setCorsHeaders } from './_cors.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const ALLOWED_ORIGIN = process.env.APP_URL || 'https://aryes-stock.vercel.app';
const SB_URL       = process.env.SUPABASE_URL;
// No fallback — missing key causes verifySession() to always return null → 401 on every call.
// Fail loudly: a missing anon key means auth is broken, not silently degraded.
const SB_ANON_KEY  = process.env.SUPABASE_ANON_KEY;

// ── In-memory rate limiter (sliding window, per authenticated user) ───────────
//
// Why in-memory and not Redis/KV:
//   - Vercel Hobby plan has no built-in KV; adding one is overkill for this use case.
//   - Vercel serverless functions are single-instance per invocation — the store
//     lives in the module scope and persists across warm invocations of the SAME
//     instance. Cold starts reset it, which is fine: the limit is per warm window.
//   - This prevents a single session from hammering the Anthropic API in a burst.
//     Coordinated cross-instance abuse is unlikely given this is an internal tool.
//
// Limits (conservative for an internal kitchen operations tool):
//   WINDOW_MS  = 60 000 ms  (1 minute)
//   MAX_CALLS  = 10         (10 requests per user per minute)
//
// The store is a Map<userId, number[]> of timestamps.
// Old timestamps outside the window are pruned on each check.
// Max map size is bounded by MAX_STORE_SIZE to prevent memory leaks on long-lived instances.

const WINDOW_MS     = 60_000;  // 1 minute sliding window
const MAX_CALLS     = 10;      // max requests per user per window
const MAX_STORE_SIZE = 500;    // max unique users tracked (evict oldest on overflow)

const rateLimitStore = new Map(); // userId → [timestamp, ...]

function checkRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Evict oldest entry if store is full (prevents unbounded memory growth)
  if (!rateLimitStore.has(userId) && rateLimitStore.size >= MAX_STORE_SIZE) {
    const oldestKey = rateLimitStore.keys().next().value;
    rateLimitStore.delete(oldestKey);
  }

  // Get timestamps for this user, prune those outside the sliding window
  const timestamps = (rateLimitStore.get(userId) || []).filter(t => t > windowStart);

  if (timestamps.length >= MAX_CALLS) {
    // Calculate when the oldest request in the window expires
    const retryAfterMs = timestamps[0] + WINDOW_MS - now;
    return { limited: true, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  // Record this request and update the store
  timestamps.push(now);
  rateLimitStore.set(userId, timestamps);
  return { limited: false };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

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

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
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

  // ── Rate limit check (per authenticated user, sliding window) ──────────────
  const { limited, retryAfterSec } = checkRateLimit(user.id);
  if (limited) {
    console.warn(`[chat] rate limit exceeded for user ${user.id}, retry in ${retryAfterSec}s`);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('X-RateLimit-Limit', String(MAX_CALLS));
    res.setHeader('X-RateLimit-Window', `${WINDOW_MS / 1000}s`);
    return res.status(429).json({
      error: `Límite de solicitudes excedido. Intentá de nuevo en ${retryAfterSec} segundo${retryAfterSec !== 1 ? 's' : ''}.`,
      retryAfterSec,
    });
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
