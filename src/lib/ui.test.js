/**
 * Tests for alertLevel() and its math helpers.
 *
 * alertLevel() is the most business-critical function in the codebase:
 * it determines when purchase orders should be placed. A bug here means
 * either missing a critical reorder (stock-out) or spamming false alerts.
 *
 * Covered: totalLead, avgDaily, stdDev, safetyStock, rop, eoq, alertLevel
 */
import { describe, it, expect } from 'vitest';
import {
  totalLead,
  avgDaily,
  stdDev,
  safetyStock,
  rop,
  eoq,
  alertLevel,
} from './ui.jsx';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A supplier with known lead times summing to 8 days */
const SUPPLIER = {
  times: { preparation: 2, customs: 1, freight: 4, warehouse: 1 },
};

/**
 * Build a product history array. Each entry represents one month.
 * consumed: total kg consumed that month.
 */
const makeHistory = (consumedPerMonth) =>
  consumedPerMonth.map((consumed) => ({ consumed }));

/** Stable history: 30 kg/month = 1 kg/day */
const STABLE_HISTORY = makeHistory([30, 30, 30, 30, 30, 30]);

/** Variable history for stdDev tests */
const VARIABLE_HISTORY = makeHistory([10, 50, 20, 60, 30, 40]);

// ─── totalLead ────────────────────────────────────────────────────────────────

describe('totalLead', () => {
  it('sums all time components', () => {
    expect(totalLead(SUPPLIER)).toBe(8); // 2+1+4+1
  });

  it('returns 0 for null supplier', () => {
    expect(totalLead(null)).toBe(0);
  });

  it('returns 0 for supplier with no times', () => {
    expect(totalLead({})).toBe(0);
  });

  it('handles partial times object', () => {
    expect(totalLead({ times: { freight: 5 } })).toBe(5);
  });
});

// ─── avgDaily ─────────────────────────────────────────────────────────────────

describe('avgDaily', () => {
  it('computes daily average from monthly history', () => {
    // 30 kg/month / 30 days = 1 kg/day
    expect(avgDaily(STABLE_HISTORY)).toBeCloseTo(1, 5);
  });

  it('returns 0 for empty history', () => {
    expect(avgDaily([])).toBe(0);
  });

  it('returns 0 for null history', () => {
    expect(avgDaily(null)).toBe(0);
  });

  it('computes variable average correctly', () => {
    // (10+50+20+60+30+40)/6 = 35 kg/month / 30 = ~1.167 kg/day
    expect(avgDaily(VARIABLE_HISTORY)).toBeCloseTo(35 / 30, 5);
  });
});

// ─── stdDev ──────────────────────────────────────────────────────────────────

describe('stdDev', () => {
  it('returns 0 for stable history (no variance)', () => {
    expect(stdDev(STABLE_HISTORY)).toBe(0);
  });

  it('returns 0 for single entry (cannot compute stddev)', () => {
    expect(stdDev(makeHistory([30]))).toBe(0);
  });

  it('returns 0 for empty history', () => {
    expect(stdDev([])).toBe(0);
  });

  it('returns positive value for variable history', () => {
    expect(stdDev(VARIABLE_HISTORY)).toBeGreaterThan(0);
  });

  it('is higher for more variable history', () => {
    const lowVar  = makeHistory([29, 30, 31, 30, 29, 31]);
    const highVar = makeHistory([5,  55, 5,  55, 5,  55]);
    expect(stdDev(highVar)).toBeGreaterThan(stdDev(lowVar));
  });
});

// ─── safetyStock ─────────────────────────────────────────────────────────────

describe('safetyStock', () => {
  it('returns 0 for stable consumption (no variance = no safety stock needed)', () => {
    // stdDev is 0 for stable history → safetyStock = ceil(1.65 * 0 * sqrt(8)) = 0
    expect(safetyStock(STABLE_HISTORY, 8)).toBe(0);
  });

  it('increases with lead time', () => {
    const ss8  = safetyStock(VARIABLE_HISTORY, 8);
    const ss16 = safetyStock(VARIABLE_HISTORY, 16);
    expect(ss16).toBeGreaterThan(ss8);
  });

  it('returns a non-negative integer', () => {
    const ss = safetyStock(VARIABLE_HISTORY, 8);
    expect(ss).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(ss)).toBe(true);
  });
});

// ─── rop (Reorder Point) ─────────────────────────────────────────────────────

describe('rop', () => {
  it('equals avgDaily * lead for stable history (safetyStock=0)', () => {
    // avgDaily=1, lead=8, safetyStock=0 → rop = ceil(8) = 8
    expect(rop(STABLE_HISTORY, 8)).toBe(8);
  });

  it('is higher than avgDaily * lead when there is variance', () => {
    const baseRop = Math.ceil(avgDaily(VARIABLE_HISTORY) * 8);
    expect(rop(VARIABLE_HISTORY, 8)).toBeGreaterThanOrEqual(baseRop);
  });

  it('increases with lead time', () => {
    expect(rop(STABLE_HISTORY, 16)).toBeGreaterThan(rop(STABLE_HISTORY, 8));
  });

  it('returns a positive integer', () => {
    const r = rop(STABLE_HISTORY, 8);
    expect(r).toBeGreaterThan(0);
    expect(Number.isInteger(r)).toBe(true);
  });
});

// ─── eoq (Economic Order Quantity) ───────────────────────────────────────────

describe('eoq', () => {
  it('returns 0 for zero unit cost (cannot compute)', () => {
    expect(eoq(STABLE_HISTORY, 0)).toBe(0);
  });

  it('returns 0 for empty history', () => {
    expect(eoq([], 10)).toBe(0);
  });

  it('returns a positive integer for valid inputs', () => {
    const q = eoq(STABLE_HISTORY, 5); // 1 kg/day * 365 = 365 kg/year, cost=$5
    expect(q).toBeGreaterThan(0);
    expect(Number.isInteger(q)).toBe(true);
  });

  it('decreases as unit cost increases (higher holding cost = smaller batches)', () => {
    const cheapEoq     = eoq(STABLE_HISTORY, 1);
    const expensiveEoq = eoq(STABLE_HISTORY, 100);
    expect(cheapEoq).toBeGreaterThan(expensiveEoq);
  });
});

// ─── alertLevel ──────────────────────────────────────────────────────────────

describe('alertLevel', () => {
  // ── guard clauses ──
  it('returns ok when supplier is null', () => {
    const p = { stock: 10, history: STABLE_HISTORY };
    expect(alertLevel(p, null).level).toBe('ok');
  });

  it('returns ok when product has no history', () => {
    const p = { stock: 10, history: [] };
    expect(alertLevel(p, SUPPLIER).level).toBe('ok');
  });

  it('returns ok when product history is missing', () => {
    const p = { stock: 10 };
    expect(alertLevel(p, SUPPLIER).level).toBe('ok');
  });

  // ── order_now: stock at or below ROP ──
  it('returns order_now when stock equals ROP (exactly at threshold)', () => {
    // ROP for stable history + 8-day lead = 8 units
    // stock=8 → stock <= rop → order_now
    const p = { stock: 8, history: STABLE_HISTORY, unitCost: 5 };
    const result = alertLevel(p, SUPPLIER);
    expect(result.level).toBe('order_now');
  });

  it('returns order_now when stock is below ROP', () => {
    const p = { stock: 1, history: STABLE_HISTORY, unitCost: 5 };
    expect(alertLevel(p, SUPPLIER).level).toBe('order_now');
  });

  it('returns order_now when stock is zero', () => {
    const p = { stock: 0, history: STABLE_HISTORY, unitCost: 5 };
    expect(alertLevel(p, SUPPLIER).level).toBe('order_now');
  });

  // ── order_soon: daysToROP <= 5 ──
  it('returns order_soon when stock runs out in <= 5 days past ROP', () => {
    // ROP=8, daily=1 → need stock > 8 but (stock-rop)/daily <= 5
    // stock=12 → daysToROP = floor((12-8)/1) = 4 → order_soon
    const p = { stock: 12, history: STABLE_HISTORY, unitCost: 5 };
    const result = alertLevel(p, SUPPLIER);
    expect(result.level).toBe('order_soon');
    expect(result.daysToROP).toBe(4);
  });

  // ── watch: daysToROP <= 10 ──
  it('returns watch when stock runs out in 6-10 days past ROP', () => {
    // stock=15 → daysToROP = floor((15-8)/1) = 7 → watch
    const p = { stock: 15, history: STABLE_HISTORY, unitCost: 5 };
    const result = alertLevel(p, SUPPLIER);
    expect(result.level).toBe('watch');
    expect(result.daysToROP).toBe(7);
  });

  // ── ok: daysToROP > 10 ──
  it('returns ok when stock is well above ROP', () => {
    // stock=100 → daysToROP = floor((100-8)/1) = 92 → ok
    const p = { stock: 100, history: STABLE_HISTORY, unitCost: 5 };
    expect(alertLevel(p, SUPPLIER).level).toBe('ok');
  });

  // ── return shape ──
  it('always returns all expected fields', () => {
    const p = { stock: 50, history: STABLE_HISTORY, unitCost: 5 };
    const result = alertLevel(p, SUPPLIER);
    expect(result).toMatchObject({
      level:     expect.any(String),
      daysToROP: expect.any(Number),
      daysOut:   expect.any(Number),
      rop:       expect.any(Number),
      ss:        expect.any(Number),
      eoq:       expect.any(Number),
      daily:     expect.any(Number),
      ropDate:   expect.any(Date),
    });
  });

  it('daysOut reflects how many days stock will last', () => {
    // stock=30, daily=1 → daysOut=30
    const p = { stock: 30, history: STABLE_HISTORY, unitCost: 5 };
    expect(alertLevel(p, SUPPLIER).daysOut).toBe(30);
  });

  it('daysToROP is never negative', () => {
    const p = { stock: 0, history: STABLE_HISTORY, unitCost: 5 };
    expect(alertLevel(p, SUPPLIER).daysToROP).toBeGreaterThanOrEqual(0);
  });

  // ── alert escalation direction (regression guard) ──
  it('alert level escalates correctly as stock decreases', () => {
    const levels = [200, 50, 15, 12, 5].map(stock => {
      const p = { stock, history: STABLE_HISTORY, unitCost: 5 };
      return alertLevel(p, SUPPLIER).level;
    });
    // Should go from ok → ok/watch → watch → order_soon → order_now
    // The last level must be order_now
    expect(levels[levels.length - 1]).toBe('order_now');
    // The first level must be ok
    expect(levels[0]).toBe('ok');
  });
});
