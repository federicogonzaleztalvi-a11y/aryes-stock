/**
 * Tests de la lógica de STOCK y total de una venta (admin / VentasTab).
 *
 * A diferencia de la versión vieja (que re-declaraba la lógica DENTRO del test,
 * o sea probaba una copia que nunca refleja producción), estos importan las
 * funciones REALES de ../lib/stock.js — las mismas que usa guardarVenta para
 * validar disponibilidad, descontar inventario al crear la venta y restaurarlo
 * al cancelarla. Si la lógica de stock cambia, estos tests lo detectan.
 *
 * Camino más crítico del negocio: un bug acá = vender stock que no existe o no
 * descontar el inventario de una venta confirmada (doble gasto de stock).
 */
import { describe, it, expect } from 'vitest';
import {
  totalVenta,
  validarStock,
  snapshotStock,
  deducirStock,
  restaurarStock,
} from './stock.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: 'prod-1', name: 'Chocolate Selecta 1kg', stock: 10, unitCost: 5, precioVenta: 7 },
  { id: 'prod-2', name: 'Pasta MEC3 500g',       stock: 0,  unitCost: 3, precioVenta: 4.5 },
  { id: 'prod-3', name: 'Colorante Duas Rodas',  stock: 5,  unitCost: 2, precioVenta: 3 },
];

const makeItem = (productoId, nombre, cantidad, precioUnit) =>
  ({ productoId, nombre, cantidad, precioUnit, unidad: 'u' });

// ── totalVenta ─────────────────────────────────────────────────────────────────

describe('totalVenta', () => {
  it('suma (cantidad × precioUnit) de todas las líneas', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 2, 7),   // 14
      makeItem('prod-3', 'Colorante', 3, 3),   // 9
    ];
    expect(totalVenta(items)).toBe(23);
  });

  it('aplica el descuento global en %', () => {
    const items = [makeItem('prod-1', 'Chocolate', 2, 10)]; // 20 subtotal
    expect(totalVenta(items, 10)).toBe(18); // 20 * 0.90
  });

  it('carrito vacío → 0', () => {
    expect(totalVenta([])).toBe(0);
  });

  it('0% de descuento → sin cambios', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1, 7)];
    expect(totalVenta(items, 0)).toBe(7);
  });

  it('100% de descuento → 0', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1, 7)];
    expect(totalVenta(items, 100)).toBe(0);
  });

  it('maneja cantidades y precios decimales', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1.5, 3.33)];
    expect(totalVenta(items)).toBeCloseTo(4.995);
  });
});

// ── validarStock ──────────────────────────────────────────────────────────────

describe('validarStock', () => {
  it('sin errores cuando hay stock suficiente para todo', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 5, 7),  // 5 de 10
      makeItem('prod-3', 'Colorante', 3, 3),  // 3 de 5
    ];
    expect(validarStock(items, PRODUCTS)).toHaveLength(0);
  });

  it('error cuando la cantidad pedida supera el stock', () => {
    const items = [makeItem('prod-1', 'Chocolate', 15, 7)]; // 15 de 10
    const errors = validarStock(items, PRODUCTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Stock insuficiente/);
    expect(errors[0]).toMatch(/Chocolate/);
    expect(errors[0]).toMatch(/disponible 10/);
    expect(errors[0]).toMatch(/solicitado 15/);
  });

  it('CRÍTICO: rechaza la venta si el producto tiene stock 0', () => {
    const items = [makeItem('prod-2', 'Pasta MEC3', 1, 4.5)];
    const errors = validarStock(items, PRODUCTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/disponible 0/);
  });

  it('detecta varias líneas insuficientes en una sola pasada', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 15, 7), // supera stock (10)
      makeItem('prod-2', 'Pasta',     1,  4.5), // stock 0
    ];
    expect(validarStock(items, PRODUCTS)).toHaveLength(2);
  });

  it('permite la cantidad exacta del stock (límite: stock=5, pide=5)', () => {
    const items = [makeItem('prod-3', 'Colorante', 5, 3)];
    expect(validarStock(items, PRODUCTS)).toHaveLength(0);
  });

  it('rechaza una unidad por encima del stock (límite: stock=5, pide=6)', () => {
    const items = [makeItem('prod-3', 'Colorante', 6, 3)];
    expect(validarStock(items, PRODUCTS)).toHaveLength(1);
  });

  it('ignora ítems cuyo producto no existe (no rompe ni falsea)', () => {
    const items = [makeItem('prod-fantasma', 'No existe', 99, 1)];
    expect(validarStock(items, PRODUCTS)).toHaveLength(0);
  });
});

// ── deducirStock ──────────────────────────────────────────────────────────────

describe('deducirStock', () => {
  it('descuenta las cantidades vendidas del stock', () => {
    const items = [makeItem('prod-1', 'Chocolate', 3, 7)];
    const updated = deducirStock(items, PRODUCTS);
    expect(updated.find(p => p.id === 'prod-1').stock).toBe(7); // 10 - 3
  });

  it('CRÍTICO: el stock nunca baja de 0', () => {
    // Si la validación se saltea y se vende más de lo disponible,
    // el stock debe quedar en 0, nunca negativo.
    const items = [makeItem('prod-1', 'Chocolate', 100, 7)];
    const updated = deducirStock(items, PRODUCTS);
    const prod = updated.find(p => p.id === 'prod-1');
    expect(prod.stock).toBe(0);
    expect(prod.stock).toBeGreaterThanOrEqual(0);
  });

  it('no toca otros productos (aislamiento)', () => {
    const items = [makeItem('prod-1', 'Chocolate', 2, 7)];
    const updated = deducirStock(items, PRODUCTS);
    expect(updated.find(p => p.id === 'prod-3').stock).toBe(5); // sin cambios
  });

  it('maneja varias líneas en una misma venta', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 3, 7),
      makeItem('prod-3', 'Colorante', 2, 3),
    ];
    const updated = deducirStock(items, PRODUCTS);
    expect(updated.find(p => p.id === 'prod-1').stock).toBe(7); // 10-3
    expect(updated.find(p => p.id === 'prod-3').stock).toBe(3); // 5-2
  });

  it('CRÍTICO: no muta el array original (función pura)', () => {
    const original = PRODUCTS.map(p => ({ ...p }));
    const items = [makeItem('prod-1', 'Chocolate', 5, 7)];
    deducirStock(items, PRODUCTS);
    expect(PRODUCTS[0].stock).toBe(original[0].stock);
  });

  it('setea updatedAt sólo si se pasa `now`', () => {
    const items = [makeItem('prod-1', 'Chocolate', 1, 7)];
    const sinNow = deducirStock(items, PRODUCTS);
    expect(sinNow.find(p => p.id === 'prod-1').updatedAt).toBeUndefined();
    const conNow = deducirStock(items, PRODUCTS, '2026-06-27T00:00:00Z');
    expect(conNow.find(p => p.id === 'prod-1').updatedAt).toBe('2026-06-27T00:00:00Z');
  });
});

// ── snapshotStock (lock value para patchWithLock) ─────────────────────────────

describe('snapshotStock', () => {
  it('captura el stock ANTES de descontar', () => {
    const items = [makeItem('prod-1', 'Chocolate', 3, 7)];
    const before = snapshotStock(items, PRODUCTS);
    const updated = deducirStock(items, PRODUCTS);
    const newStock = updated.find(p => p.id === 'prod-1').stock;
    expect(before['prod-1']).toBe(10);          // valor de lock = stock previo
    expect(newStock).toBe(7);
    expect(before['prod-1'] - newStock).toBe(3); // delta = cantidad vendida
  });
});

// ── restaurarStock (cancelar venta) ───────────────────────────────────────────

describe('restaurarStock', () => {
  it('suma de vuelta las cantidades al cancelar', () => {
    const items = [makeItem('prod-1', 'Chocolate', 3, 7)];
    const updated = restaurarStock(items, PRODUCTS);
    expect(updated.find(p => p.id === 'prod-1').stock).toBe(13); // 10 + 3
  });

  it('CRÍTICO: descontar y luego restaurar deja el stock igual (round-trip)', () => {
    const items = [
      makeItem('prod-1', 'Chocolate', 4, 7),
      makeItem('prod-3', 'Colorante', 2, 3),
    ];
    const afterDeduc = deducirStock(items, PRODUCTS);
    const afterRestore = restaurarStock(items, afterDeduc);
    expect(afterRestore.find(p => p.id === 'prod-1').stock).toBe(10);
    expect(afterRestore.find(p => p.id === 'prod-3').stock).toBe(5);
  });

  it('no muta el array original (función pura)', () => {
    const original = PRODUCTS.map(p => ({ ...p }));
    const items = [makeItem('prod-1', 'Chocolate', 5, 7)];
    restaurarStock(items, PRODUCTS);
    expect(PRODUCTS[0].stock).toBe(original[0].stock);
  });
});
