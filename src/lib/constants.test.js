/**
 * Tests for patchWithLock() concurrency logic and sanitizeText().
 *
 * patchWithLock() is the most complex function in the data layer.
 * It implements optimistic concurrency control for stock updates:
 * if two devices update stock simultaneously, the second write
 * detects the conflict (0 rows updated) and retries with fresh data.
 *
 * A bug here means silent stock corruption under concurrent operations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeText } from './constants.js';

// ─── getAuthHeaders ───────────────────────────────────────────────────────────

import { getAuthHeaders } from './constants.js';

describe('getAuthHeaders', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('throws when localStorage has no session', () => {
    expect(() => getAuthHeaders()).toThrow('[auth] No active session — request aborted');
  });

  it('throws when session has no access_token', () => {
    localStorage.setItem('aryes-session', JSON.stringify({ email: 'x@x.com', role: 'admin' }));
    expect(() => getAuthHeaders()).toThrow('[auth] No active session — request aborted');
  });

  it('throws when access_token is empty string', () => {
    localStorage.setItem('aryes-session', JSON.stringify({ access_token: '' }));
    expect(() => getAuthHeaders()).toThrow('[auth] No active session — request aborted');
  });

  it('returns correct headers when valid session exists', () => {
    const token = 'eyJvalid.jwt.token';
    localStorage.setItem('aryes-session', JSON.stringify({ access_token: token }));
    const headers = getAuthHeaders();
    expect(headers['Authorization']).toBe(`Bearer ${token}`);
    expect(headers['Content-Type']).toBe('application/json');
    // apikey must be present (anon key) — never the user token
    expect(headers['apikey']).toBeDefined();
    // CRITICAL: Authorization must never equal apikey
    expect(headers['Authorization']).not.toBe(`Bearer ${headers['apikey']}`);
  });

  it('never uses the anon key as a Bearer token', () => {
    // Even if localStorage throws, the function must not fall back to anon key as Bearer
    const origGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = (key) => {
      if (key === 'aryes-session') throw new Error('storage error');
      return origGetItem(key);
    };
    expect(() => getAuthHeaders()).toThrow();
    localStorage.getItem = origGetItem;
  });

  it('merges extra headers correctly when authenticated', () => {
    localStorage.setItem('aryes-session', JSON.stringify({ access_token: 'tok123' }));
    const headers = getAuthHeaders({ 'Prefer': 'return=representation' });
    expect(headers['Prefer']).toBe('return=representation');
    expect(headers['Authorization']).toBe('Bearer tok123');
  });
});



// ─── sanitizeText ─────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace to single spaces', () => {
    expect(sanitizeText('foo   bar\t\tbaz')).toBe('foo bar baz');
  });

  it('truncates to maxLen (default 200)', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeText(long).length).toBe(200);
  });

  it('truncates to custom maxLen', () => {
    expect(sanitizeText('hello world', 5)).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeText(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('converts numbers to string', () => {
    expect(sanitizeText(42)).toBe('42');
  });

  it('handles strings that are exactly maxLen', () => {
    const s = 'a'.repeat(200);
    expect(sanitizeText(s).length).toBe(200);
  });
});

// ─── patchWithLock — unit tests with mocked fetch ────────────────────────────
// We test the retry logic by controlling what fetch returns.
// The real Supabase is never called in tests.

describe('patchWithLock', () => {
  let db;
  let fetchMock;

  beforeEach(async () => {
    // Reset fetch mock before each test
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    // Re-import db fresh so it uses the mocked fetch
    // (vitest module cache is reset via vi.resetModules if needed)
    const mod = await import('./constants.js');
    db = mod.db;
  });

  /** Helper: make fetch return a successful PATCH response with given rows */
  const mockPatchSuccess = (rows) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rows),
      json: async () => rows,
      headers: { get: () => String(rows.length) },
    });
  };

  /** Helper: make fetch return a 0-row PATCH (conflict detected) */
  const mockPatchConflict = () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '[]',
      json: async () => [],
      headers: { get: () => '0' },
    });
  };

  /** Helper: make fetch return a fresh row for the re-fetch after conflict */
  const mockGetRow = (row) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([row]),
      json: async () => [row],
    });
  };

  /** Helper: make fetch return a server error */
  const mockServerError = (status = 500) => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => 'Internal Server Error',
    });
  };

  it('succeeds immediately when no conflict (rows returned on first try)', async () => {
    const updatedRow = { uuid: 'prod-1', stock: 50, updated_at: '2025-01-01' };
    mockPatchSuccess([updatedRow]);

    const result = await db.patchWithLock(
      'products',
      { stock: 50 },
      'uuid=eq.prod-1',
      'stock',
      45 // lockValue: current stock we read before writing
    );

    expect(result).toEqual(updatedRow);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once after a conflict (0 rows) and succeeds on second attempt', async () => {
    const freshRow   = { uuid: 'prod-1', stock: 48 }; // server has 48 (someone else wrote)
    const updatedRow = { uuid: 'prod-1', stock: 53 }; // 48 + delta(5) = 53

    // Sequence: PATCH → conflict (0 rows) → GET fresh → PATCH → success
    mockPatchConflict();
    mockGetRow(freshRow);
    mockPatchSuccess([updatedRow]);

    // We're trying to add 5 (50-45=5) to whatever stock is on server
    const result = await db.patchWithLock(
      'products',
      { stock: 50 },       // intended new stock (45 + 5)
      'uuid=eq.prod-1',
      'stock',
      45,                   // lockValue (stock we read before writing)
      3                     // maxRetries
    );

    expect(result).toEqual(updatedRow);
    // 3 calls: first PATCH (conflict) + GET (re-fetch) + second PATCH (success)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries (persistent conflict)', async () => {
    // Every PATCH returns 0 rows, every GET returns fresh data
    // With maxRetries=2: 2 PATCH conflicts + 1 GET between them
    mockPatchConflict();
    mockGetRow({ uuid: 'prod-1', stock: 48 });
    mockPatchConflict();
    // No more retries — should throw

    await expect(
      db.patchWithLock('products', { stock: 50 }, 'uuid=eq.prod-1', 'stock', 45, 2)
    ).rejects.toThrow('conflict after 2 retries');
  });

  it('throws immediately when server returns an error status', async () => {
    mockServerError(503);

    await expect(
      db.patchWithLock('products', { stock: 50 }, 'uuid=eq.prod-1', 'stock', 45)
    ).rejects.toThrow('patchWithLock products');
  });

  it('throws when row not found during re-fetch after conflict', async () => {
    // PATCH conflict → GET returns empty array (row deleted by someone else)
    mockPatchConflict();
    // Empty GET response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '[]',
      json: async () => [],
    });

    await expect(
      db.patchWithLock('products', { stock: 50 }, 'uuid=eq.prod-1', 'stock', 45, 3)
    ).rejects.toThrow('row not found');
  });

  it('includes the lockValue in the PATCH filter URL', async () => {
    mockPatchSuccess([{ uuid: 'prod-1', stock: 50 }]);

    await db.patchWithLock('products', { stock: 50 }, 'uuid=eq.prod-1', 'stock', 45);

    const calledUrl = fetchMock.mock.calls[0][0];
    // URL must include both the row filter AND the lock condition
    expect(calledUrl).toContain('uuid=eq.prod-1');
    expect(calledUrl).toContain('stock=eq.45');
  });

  it('sends correct JSON body with updated data', async () => {
    mockPatchSuccess([{ uuid: 'prod-1', stock: 50 }]);

    await db.patchWithLock(
      'products',
      { stock: 50, updated_at: '2025-01-01T00:00:00Z' },
      'uuid=eq.prod-1',
      'stock',
      45
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stock).toBe(50);
    expect(body.updated_at).toBe('2025-01-01T00:00:00Z');
  });
});
