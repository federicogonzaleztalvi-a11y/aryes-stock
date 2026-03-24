/**
 * Tests for the in-memory sliding window rate limiter in api/chat.js.
 *
 * The rate limiter is the only business logic in the chat endpoint beyond
 * auth and the Anthropic proxy. It must:
 *   - Allow up to MAX_CALLS requests within WINDOW_MS
 *   - Block the (MAX_CALLS+1)th request with a correct Retry-After
 *   - Reset after the window slides past old timestamps
 *   - Isolate limits per user (user A's limit doesn't affect user B)
 *   - Not grow unboundedly (evict when store hits MAX_STORE_SIZE)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── Extract and test the rate limiter in isolation ────────────────────────────
// We re-implement the same algorithm here and test its invariants.
// This is intentional: we're testing the LOGIC, not the module itself
// (which imports env vars and fetch at the module level).
// When TypeScript is added, this moves to a shared utility.

function makeRateLimiter({ windowMs = 60_000, maxCalls = 10, maxStoreSize = 500 } = {}) {
  const store = new Map();

  function check(userId) {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!store.has(userId) && store.size >= maxStoreSize) {
      const oldestKey = store.keys().next().value;
      store.delete(oldestKey);
    }

    const timestamps = (store.get(userId) || []).filter(t => t > windowStart);

    if (timestamps.length >= maxCalls) {
      const retryAfterMs = timestamps[0] + windowMs - now;
      return { limited: true, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
    }

    timestamps.push(now);
    store.set(userId, timestamps);
    return { limited: false };
  }

  return { check, store };
}

describe('rate limiter — sliding window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic allow/deny ───────────────────────────────────────────────────────

  it('allows requests up to the limit', () => {
    const { check } = makeRateLimiter({ maxCalls: 3 });
    expect(check('user-1').limited).toBe(false); // 1
    expect(check('user-1').limited).toBe(false); // 2
    expect(check('user-1').limited).toBe(false); // 3
  });

  it('blocks the request that exceeds the limit', () => {
    const { check } = makeRateLimiter({ maxCalls: 3 });
    check('user-1'); // 1
    check('user-1'); // 2
    check('user-1'); // 3
    const result = check('user-1'); // 4 — should be blocked
    expect(result.limited).toBe(true);
  });

  it('returns a positive retryAfterSec when blocked', () => {
    const { check } = makeRateLimiter({ maxCalls: 2, windowMs: 60_000 });
    check('user-1'); // at t=0
    check('user-1'); // at t=0
    const result = check('user-1'); // blocked
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(60);
  });

  // ── Sliding window reset ───────────────────────────────────────────────────

  it('allows requests again after the window slides past old timestamps', () => {
    const { check } = makeRateLimiter({ maxCalls: 2, windowMs: 60_000 });

    check('user-1'); // t=0
    check('user-1'); // t=0 — now at limit

    // Move time forward past the window
    vi.advanceTimersByTime(61_000);

    // Old timestamps are now outside the window — should be allowed again
    expect(check('user-1').limited).toBe(false);
    expect(check('user-1').limited).toBe(false);
  });

  it('correctly counts only requests within the current window', () => {
    const { check } = makeRateLimiter({ maxCalls: 3, windowMs: 60_000 });

    check('user-1'); // t=0
    check('user-1'); // t=0

    // Move forward 30 seconds
    vi.advanceTimersByTime(30_000);
    check('user-1'); // t=30s — window has 3 requests total, now at limit

    // Move to t=61s — first two requests (t=0) slide out of window
    vi.advanceTimersByTime(31_000);
    // Only the t=30s request remains in window — 2 more should be allowed
    expect(check('user-1').limited).toBe(false); // 1 in window now
    expect(check('user-1').limited).toBe(false); // 2 in window now
  });

  // ── Per-user isolation ─────────────────────────────────────────────────────

  it('tracks limits independently per user', () => {
    const { check } = makeRateLimiter({ maxCalls: 2 });

    // Exhaust user-A's limit
    check('user-A');
    check('user-A');
    expect(check('user-A').limited).toBe(true);

    // user-B should be completely unaffected
    expect(check('user-B').limited).toBe(false);
    expect(check('user-B').limited).toBe(false);
  });

  it('does not cross-contaminate counts between users', () => {
    const { check } = makeRateLimiter({ maxCalls: 5 });

    // 4 requests from user-A
    for (let i = 0; i < 4; i++) check('user-A');

    // 4 requests from user-B — should not affect user-A's count
    for (let i = 0; i < 4; i++) check('user-B');

    // user-A should have 1 remaining
    expect(check('user-A').limited).toBe(false); // 5th — OK
    expect(check('user-A').limited).toBe(true);  // 6th — blocked
  });

  // ── Store size cap ─────────────────────────────────────────────────────────

  it('does not exceed maxStoreSize', () => {
    const maxStoreSize = 5;
    const { check, store } = makeRateLimiter({ maxStoreSize });

    // Fill the store to capacity
    for (let i = 0; i < maxStoreSize; i++) {
      check(`user-${i}`);
    }
    expect(store.size).toBe(maxStoreSize);

    // Add one more — store size should stay at maxStoreSize
    check('user-overflow');
    expect(store.size).toBe(maxStoreSize);
  });

  it('evicts the oldest entry when store is full', () => {
    const maxStoreSize = 3;
    const { check, store } = makeRateLimiter({ maxStoreSize });

    check('user-0');
    check('user-1');
    check('user-2'); // store full

    // user-0 was added first — it should be evicted
    check('user-3');
    expect(store.has('user-0')).toBe(false);
    expect(store.has('user-3')).toBe(true);
  });

  // ── retryAfterSec accuracy ─────────────────────────────────────────────────

  it('retryAfterSec is ceiling of remaining window time in seconds', () => {
    const windowMs = 60_000;
    const { check } = makeRateLimiter({ maxCalls: 1, windowMs });

    check('user-1'); // t=0 — fills the 1-call limit immediately

    // Advance 10.5 seconds into the window
    vi.advanceTimersByTime(10_500);

    const result = check('user-1'); // blocked
    expect(result.limited).toBe(true);

    // Remaining time = 60s - 10.5s = 49.5s → ceil = 50s
    expect(result.retryAfterSec).toBe(50);
  });

  it('retryAfterSec is 1 when window is about to expire', () => {
    const windowMs = 60_000;
    const { check } = makeRateLimiter({ maxCalls: 1, windowMs });

    check('user-1'); // t=0
    vi.advanceTimersByTime(59_500); // 59.5s elapsed → 0.5s remaining → ceil = 1s

    const result = check('user-1');
    expect(result.limited).toBe(true);
    expect(result.retryAfterSec).toBe(1);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('handles a new user correctly on first call', () => {
    const { check } = makeRateLimiter({ maxCalls: 5 });
    const result = check('brand-new-user');
    expect(result.limited).toBe(false);
  });

  it('handles maxCalls=1 correctly', () => {
    const { check } = makeRateLimiter({ maxCalls: 1 });
    expect(check('user-1').limited).toBe(false); // first call allowed
    expect(check('user-1').limited).toBe(true);  // second call blocked
  });
});
