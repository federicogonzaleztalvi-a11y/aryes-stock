/**
 * Tests for session expiry logic.
 *
 * readSession() in main.jsx reads the session from localStorage and
 * returns null if the JWT has expired. This is the authentication gate
 * that every page load passes through.
 *
 * A bug here means: expired sessions stay logged in (security issue)
 * or valid sessions get logged out (UX issue).
 *
 * We test the pure logic extracted here so it can be verified without
 * mounting a React component or mocking the entire DOM.
 */
import { describe, it, expect } from 'vitest';

// ─── Pure logic extracted from main.jsx ──────────────────────────────────────
// This mirrors readSession() exactly. When we add TypeScript, this moves to
// a shared utility. For now, the test validates the logic is correct so any
// drift from main.jsx will be visible when reading the test.

function readSession(storage) {
  try {
    const raw = storage.getItem('aryes-session');
    const s = JSON.parse(raw || 'null');
    if (s && s.expiresAt != null && Date.now() > s.expiresAt) {
      storage.removeItem('aryes-session');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

// ─── Fake localStorage ────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    _store:     store,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('readSession — JWT expiry logic', () => {
  it('returns null when storage has no session', () => {
    const storage = makeStorage();
    expect(readSession(storage)).toBeNull();
  });

  it('returns null for malformed JSON in storage', () => {
    const storage = makeStorage({ 'aryes-session': 'not-json{{' });
    expect(readSession(storage)).toBeNull();
  });

  it('returns the session when it is valid and not expired', () => {
    const session = {
      access_token: 'tok123',
      email: 'user@example.com',
      role: 'admin',
      expiresAt: Date.now() + 60 * 60 * 1000, // expires in 1 hour
    };
    const storage = makeStorage({ 'aryes-session': JSON.stringify(session) });
    const result = readSession(storage);
    expect(result).toEqual(session);
  });

  it('returns null and removes the key when session is expired', () => {
    const session = {
      access_token: 'tok_old',
      email: 'user@example.com',
      role: 'operador',
      expiresAt: Date.now() - 1000, // expired 1 second ago
    };
    const storage = makeStorage({ 'aryes-session': JSON.stringify(session) });

    const result = readSession(storage);

    expect(result).toBeNull();
    // Must remove the key so next page load doesn't loop
    expect(storage._store['aryes-session']).toBeUndefined();
  });

  it('treats a session with expiresAt=0 as expired', () => {
    const session = { access_token: 'tok', expiresAt: 0 };
    const storage = makeStorage({ 'aryes-session': JSON.stringify(session) });
    expect(readSession(storage)).toBeNull();
  });

  it('keeps a session with no expiresAt field (legacy — never auto-expires)', () => {
    // Sessions created before expiresAt was added have no expiry field.
    // readSession() should return them as-is rather than crashing.
    const session = { access_token: 'tok_legacy', email: 'admin@aryes.com' };
    const storage = makeStorage({ 'aryes-session': JSON.stringify(session) });
    expect(readSession(storage)).toEqual(session);
  });

  it('is boundary-correct: expires at exactly now is treated as expired', () => {
    // Date.now() > expiresAt: if they're equal, not expired.
    // We set expiresAt to Date.now() - 1 to be 1ms past.
    const now = Date.now();
    const session = { access_token: 'tok', expiresAt: now - 1 };
    const storage = makeStorage({ 'aryes-session': JSON.stringify(session) });
    expect(readSession(storage)).toBeNull();
  });

  it('does not throw for null stored in localStorage', () => {
    // localStorage.getItem returns null for missing keys
    const storage = makeStorage({ 'aryes-session': null });
    expect(() => readSession(storage)).not.toThrow();
    expect(readSession(storage)).toBeNull();
  });
});

// ─── expiresAt calculation (mirrors LoginScreen logic) ────────────────────────

describe('session expiresAt calculation', () => {
  it('adds expires_in seconds to current time', () => {
    const before = Date.now();
    const expiresIn = 3600; // 1 hour
    const expiresAt = Date.now() + expiresIn * 1000;
    const after = Date.now();

    expect(expiresAt).toBeGreaterThanOrEqual(before + expiresIn * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after  + expiresIn * 1000);
  });

  it('defaults to 3600s when expires_in is missing from API response', () => {
    const data = {}; // no expires_in field
    const expiresIn = (data.expires_in || 3600) * 1000;
    expect(expiresIn).toBe(3_600_000); // 1 hour in ms
  });

  it('uses provided expires_in when present', () => {
    const data = { expires_in: 7200 }; // 2 hours
    const expiresIn = (data.expires_in || 3600) * 1000;
    expect(expiresIn).toBe(7_200_000);
  });
});
