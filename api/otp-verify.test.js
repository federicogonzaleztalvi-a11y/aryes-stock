/**
 * Tests for api/otp-verify.js — OTP verification with brute-force protection.
 *
 * Critical security path: if the lockout logic is broken, an attacker can
 * enumerate all 9,000 possible 4-digit codes and access any client's portal.
 *
 * We mock fetch to control Supabase responses without hitting the real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock req/res pair for testing the handler */
function mockReqRes(body = {}, headers = {}) {
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body; return this; },
    end()        { return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  const req = {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  };
  return { req, res };
}

/** SHA-256 hash matching the one in otp-verify.js */
async function sha256(text) {
  const buf  = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Make fetch return a Supabase-style JSON response */
const mockFetchJson = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json:  async () => data,
  text:  async () => JSON.stringify(data),
});

// ── Setup ────────────────────────────────────────────────────────────────────

let handler;

beforeEach(async () => {
  // Set required env vars
  process.env.SUPABASE_URL      = 'https://fake.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key-test';

  // Reset module to get a fresh handler
  vi.resetModules();
  const mod = await import('./otp-verify.js');
  handler   = mod.default;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('otp-verify handler', () => {

  it('returns 400 when tel or code are missing', async () => {
    const { req, res } = mockReqRes({ tel: '099123456' }); // no code
    globalThis.fetch = vi.fn(); // should never be called
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when no active OTP session exists', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchJson([])); // empty result
    const { req, res } = mockReqRes({ tel: '099123456', code: '1234' });
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._body.error).toMatch(/expirado|inválido/i);
  });

  it('returns 401 and increments failed_attempts on wrong code', async () => {
    const tel      = '099123456';
    const wrongCode= '0000';
    const goodCode = '9999';
    const codeHash = await sha256(goodCode + tel);

    const otpSession = {
      id: 'sess-1', tel, code_hash: codeHash,
      failed_attempts: 0, locked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    };

    const fetchMock = vi.fn()
      // First call: GET otp_sessions → returns the session
      .mockResolvedValueOnce(mockFetchJson([otpSession]))
      // Second call: PATCH to increment failed_attempts
      .mockResolvedValueOnce(mockFetchJson({}));

    globalThis.fetch = fetchMock;

    const { req, res } = mockReqRes({ tel, code: wrongCode });
    await handler(req, res);

    expect(res._status).toBe(401);
    expect(res._body.error).toMatch(/incorrecto/i);
    // Must show remaining attempts
    expect(res._body.error).toMatch(/4 intentos/i);

    // The PATCH call must increment failed_attempts
    const patchCall = fetchMock.mock.calls[1];
    const patchBody = JSON.parse(patchCall[1].body);
    expect(patchBody.failed_attempts).toBe(1);
    expect(patchBody.locked).toBe(false); // not yet locked (only 1 attempt)
  });

  it('locks the session after MAX_ATTEMPTS (5) wrong codes', async () => {
    const tel      = '099123456';
    const goodCode = '9999';
    const codeHash = await sha256(goodCode + tel);

    const otpSession = {
      id: 'sess-1', tel, code_hash: codeHash,
      failed_attempts: 4, // already 4 failed — this is the 5th
      locked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchJson([otpSession]))  // GET session
      .mockResolvedValueOnce(mockFetchJson({}));            // PATCH to lock

    globalThis.fetch = fetchMock;

    const { req, res } = mockReqRes({ tel, code: '0000' }); // wrong code
    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._body.locked).toBe(true);
    expect(res._body.error).toMatch(/bloqueado/i);

    // PATCH must set locked=true
    const patchBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(patchBody.locked).toBe(true);
    expect(patchBody.failed_attempts).toBe(5);
  });

  it('rejects requests when session is already locked', async () => {
    // The GET query includes locked=eq.false — a locked session returns []
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchJson([]));

    const { req, res } = mockReqRes({ tel: '099123456', code: '1234' });
    await handler(req, res);

    // Returns the same "expired or invalid" message — does not reveal lock status
    expect(res._status).toBe(401);
    // PATCH must NOT be called (session not found → can't increment)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with session token on correct code', async () => {
    const tel      = '099123456';
    const goodCode = '9999';
    const codeHash = await sha256(goodCode + tel);

    const otpSession = {
      id: 'sess-1', tel, code_hash: codeHash,
      failed_attempts: 0, locked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    };

    const cliente = { id: 'cli-1', nombre: 'Test Cliente', lista_id: null };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(mockFetchJson([otpSession])) // GET session
      .mockResolvedValueOnce(mockFetchJson({}))            // PATCH mark used
      .mockResolvedValueOnce(mockFetchJson([cliente]))     // GET client
      .mockResolvedValueOnce(mockFetchJson({}));           // POST portal_session

    const { req, res } = mockReqRes({ tel, code: goodCode });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(res._body.session.clienteId).toBe('cli-1');
    expect(res._body.session.nombre).toBe('Test Cliente');
    expect(res._body.session.token).toBeDefined();
    expect(typeof res._body.session.token).toBe('string');
    // Token must be a UUID (36 chars with hyphens)
    expect(res._body.session.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('marks OTP as used=true after successful verification', async () => {
    const tel      = '099123456';
    const goodCode = '9999';
    const codeHash = await sha256(goodCode + tel);

    const otpSession = {
      id: 'sess-42', tel, code_hash: codeHash,
      failed_attempts: 0, locked: false,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchJson([otpSession]))
      .mockResolvedValueOnce(mockFetchJson({}))           // PATCH mark used
      .mockResolvedValueOnce(mockFetchJson([{ id: 'cli-1', nombre: 'X', lista_id: null }]))
      .mockResolvedValueOnce(mockFetchJson({}));

    globalThis.fetch = fetchMock;

    const { req, res } = mockReqRes({ tel, code: goodCode });
    await handler(req, res);

    // The PATCH for marking as used (2nd fetch call)
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[0]).toContain('sess-42');
    const patchBody = JSON.parse(patchCall[1].body);
    expect(patchBody.used).toBe(true);
  });

  it('returns 500 when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    vi.resetModules();
    const mod = await import('./otp-verify.js');
    const h   = mod.default;

    globalThis.fetch = vi.fn();
    const { req, res } = mockReqRes({ tel: '099123456', code: '1234' });
    await h(req, res);

    expect(res._status).toBe(500);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

});
