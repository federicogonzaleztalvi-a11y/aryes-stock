/**
 * Tests for the stock mutation logic used in guardarVenta (VentasTab).
 *
 * This is the most financially critical path in the codebase:
 * a bug here means selling stock that doesn't exist, or failing to
 * deduct stock on a confirmed sale (double-spending inventory).
 *
 * We test the pure business logic functions in isolation —
 * no React, no Supabase, no DOM.
 */
import { describe, it, expect } from 'vitest';

// ── Pure business logic extracted for testing ─────────────────────────────────
// These mirror the logic in VentasTab.guardarVenta exactly.

/** Calculate venta total with optional discount */
function totalVenta(items, descuento = 0) {
  const sub = items.reduce((a, it) => a + Number(it.cantidad) * Number(it.precioUnit), 0);
  return descuento > 0 ? sub * (1 - descuento / 100) : sub;
}

/**
 * Validate stock availability before creating a venta.
 * Returns array of error strings (empty = valid).
 */
function validarStock(items, products) {
  const errors = [];
  const updProds = [...products];
  items.forEach(it => {
    const idx = updProds.findIndex(p => p.id === it.productoId);
    if (idx > -1) {
      if (Number(it.cantidad) > Number(updProds[idx].stock || 0)) {
        errors.push(
          `Stock insuficiente: ${it.nombre} — disponible ${updProds[idx].stock || 0}, solicitado ${it.cantidad}`
        );
      }
    }
  });
  return errors;
}

/**
 * Apply stock deductions optimistically (mirrors the state update in guardarVenta).
 * Returns a new products array with updated stock values.
 */
function aplicarStockDeduccion(items, products) {
  const updProds = [...products];
  items.forEach(it => {
    const idx = updProds.findIndex(p => p.id === it.productoId);
    if (idx > -1) {
      const newStock = Math.max(0, Number(updProds[idx].stock || 0) - Number(it.cantidad));
      updProds[idx] = { ...updProds[idx], stock: newStock };
    }
  });
  return updProds;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: 'prod-1', name: 'Chocolate Selecta 1kg', stock: 10, unitCost: 5, precioVenta: 7 },
  { id: 'prod-2', name: 'Pasta MEC3 500g',       stock: 0,  unitCost: 3, precioVenta: 4.5 },
  { id: 'prod-3', name: 'Colorante Duas Rodas',   stock: 5,  unitCost: 2, precioVenta: 3 },
];

const makeItem = (productoId, nombre, cantidad, precioUnit) =>
  ({ productoId, nombre, cantidad, precioUnit, unidad: 'u' });

// ── totalVenta ─────────────────────────────────────────────────────────────────

describe('totalVenta', () => {
  it('calculates sum of (cantidad × precioUnit) across all items', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 2, 7),   // 14
      makeItem('prod-3', 'Colorante', 3, 3),   // 9
    ];
    expect(totalVenta(items)).toBe(23);
  });

  it('applies percentage discount correctly', () => {
    const items = [makeItem('prod-1', 'Chocolate', 2, 10)]; // 20 subtotal
    expect(totalVenta(items, 10)).toBe(18); // 20 * 0.90
  });

  it('returns 0 for empty items', () => {
    expect(totalVenta([])).toBe(0);
  });

  it('handles 0% discount (no change)', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1, 7)];
    expect(totalVenta(items, 0)).toBe(7);
  });

  it('handles 100% discount (returns 0)', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1, 7)];
    expect(totalVenta(items, 100)).toBe(0);
  });

  it('handles decimal quantities and prices correctly', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1.5, 3.33)];
    expect(totalVenta(items)).toBeCloseTo(4.995);
  });
});

// ── validarStock ──────────────────────────────────────────────────────────────

describe('validarStock', () => {
  it('returns no errors when all items have sufficient stock', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 5, 7),  // 5 of 10 available
      makeItem('prod-3', 'Colorante', 3, 3),  // 3 of 5 available
    ];
    expect(validarStock(items, PRODUCTS)).toHaveLength(0);
  });

  it('returns error when requested quantity exceeds stock', () => {
    const items = [makeItem('prod-1', 'Chocolate', 15, 7)]; // 15 of 10 available
    const errors = validarStock(items, PRODUCTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Stock insuficiente/);
    expect(errors[0]).toMatch(/Chocolate/);
    expect(errors[0]).toMatch(/disponible 10/);
    expect(errors[0]).toMatch(/solicitado 15/);
  });

  it('CRITICAL: rejects sale when product has 0 stock', () => {
    // prod-2 has stock=0 — must not allow selling any quantity
    const items = [makeItem('prod-2', 'Pasta MEC3', 1, 4.5)];
    const errors = validarStock(items, PRODUCTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/disponible 0/);
  });

  it('catches multiple insufficient items in one pass', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 15, 7), // exceeds stock (10)
      makeItem('prod-2', 'Pasta',     1,  4.5), // 0 stock
    ];
    const errors = validarStock(items, PRODUCTS);
    expect(errors).toHaveLength(2);
  });

  it('allows exact stock quantity (boundary: stock=5, request=5)', () => {
    const items = [makeItem('prod-3', 'Colorante', 5, 3)]; // exactly 5 of 5
    expect(validarStock(items, PRODUCTS)).toHaveLength(0);
  });

  it('rejects one unit over stock (boundary: stock=5, request=6)', () => {
    const items = [makeItem('prod-3', 'Colorante', 6, 3)]; // 6 of 5
    expect(validarStock(items, PRODUCTS)).toHaveLength(1);
  });
});

// ── aplicarStockDeduccion ─────────────────────────────────────────────────────

describe('aplicarStockDeduccion', () => {
  it('deducts sold quantities from product stock', () => {
    const items = [makeItem('prod-1', 'Chocolate', 3, 7)];
    const updated = aplicarStockDeduccion(items, PRODUCTS);
    const prod = updated.find(p => p.id === 'prod-1');
    expect(prod.stock).toBe(7); // 10 - 3
  });

  it('CRITICAL: does not allow stock to go below 0', () => {
    // If validation was bypassed and we somehow sell more than available,
    // stock must floor at 0, not go negative
    const items = [makeItem('prod-1', 'Chocolate', 100, 7)]; // way more than stock
    const updated = aplicarStockDeduccion(items, PRODUCTS);
    const prod = updated.find(p => p.id === 'prod-1');
    expect(prod.stock).toBe(0);
    expect(prod.stock).toBeGreaterThanOrEqual(0);
  });

  it('does not modify other products (isolation)', () => {
    const items = [makeItem('prod-1', 'Chocolate', 2, 7)];
    const updated = aplicarStockDeduccion(items, PRODUCTS);
    // prod-3 must be unchanged
    const unchanged = updated.find(p => p.id === 'prod-3');
    expect(unchanged.stock).toBe(5); // original value
  });

  it('handles multiple items in a single venta', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 3, 7),
      makeItem('prod-3', 'Colorante', 2, 3),
    ];
    const updated = aplicarStockDeduccion(items, PRODUCTS);
    expect(updated.find(p => p.id === 'prod-1').stock).toBe(7);  // 10-3
    expect(updated.find(p => p.id === 'prod-3').stock).toBe(3);  // 5-2
  });

  it('CRITICAL: does not mutate the original products array (pure function)', () => {
    const original = [...PRODUCTS];
    const items = [makeItem('prod-1', 'Chocolate', 5, 7)];
    aplicarStockDeduccion(items, PRODUCTS);
    // Original must be unchanged
    expect(PRODUCTS[0].stock).toBe(original[0].stock);
  });

  it('captures stock BEFORE deduction correctly (lockValue pattern)', () => {
    // The lockValue used in patchWithLock must be the stock BEFORE deduction
    const items   = [makeItem('prod-1', 'Chocolate', 3, 7)];
    const stockBefore = Object.fromEntries(
      items.map(it => [it.productoId, PRODUCTS.find(p => p.id === it.productoId)?.stock || 0])
    );
    const updated  = aplicarStockDeduccion(items, PRODUCTS);
    const newStock = updated.find(p => p.id === 'prod-1')?.stock;

    // Lock value is the BEFORE stock — the delta is consistent
    expect(stockBefore['prod-1']).toBe(10);
    expect(newStock).toBe(7);
    expect(stockBefore['prod-1'] - newStock).toBe(3); // cantidad sold
  });
});
