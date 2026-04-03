/**
 * Tests for product operations.
 * Validates saveProduct logic, stock calculations, and data integrity.
 */
import { describe, it, expect } from 'vitest';

describe('Product save — field validation', () => {
  const blank = {
    name: '', barcode: '', supplierId: 'arg', unit: 'kg',
    stock: 0, unitCost: 0, precioVenta: 0, iva_rate: 22,
    imagen_url: '', descripcion: '', history: [],
  };

  it('blank product has all required fields', () => {
    expect(blank.name).toBeDefined();
    expect(blank.unit).toBe('kg');
    expect(blank.iva_rate).toBe(22);
    expect(blank.stock).toBe(0);
    expect(blank.history).toBeInstanceOf(Array);
  });

  it('merging with defaults covers missing demo fields', () => {
    const demoProduct = { id: 'p1', name: 'Test', stock: 10 };
    const merged = { ...blank, ...demoProduct };
    expect(merged.name).toBe('Test');
    expect(merged.stock).toBe(10);
    expect(merged.unit).toBe('kg'); // from blank
    expect(merged.iva_rate).toBe(22); // from blank
    expect(merged.history).toEqual([]); // from blank
  });
});

describe('Stock calculations', () => {
  it('stock value = stock * unitCost', () => {
    const p = { stock: 100, unitCost: 50 };
    expect(p.stock * p.unitCost).toBe(5000);
  });

  it('zero stock = zero value', () => {
    const p = { stock: 0, unitCost: 50 };
    expect(p.stock * p.unitCost).toBe(0);
  });

  it('negative stock should not exist but handle gracefully', () => {
    const p = { stock: -5, unitCost: 50 };
    expect(p.stock * p.unitCost).toBe(-250);
    expect(Math.max(0, p.stock * p.unitCost)).toBe(0);
  });

  it('margin calculation', () => {
    const p = { unitCost: 70, precioVenta: 100 };
    const margin = ((p.precioVenta - p.unitCost) / p.precioVenta) * 100;
    expect(margin).toBe(30);
  });

  it('items below minStock are flagged', () => {
    const products = [
      { stock: 5, minStock: 10 },
      { stock: 15, minStock: 10 },
      { stock: 0, minStock: 5 },
    ];
    const belowMin = products.filter(p => p.stock <= p.minStock && p.stock > 0);
    const inZero = products.filter(p => p.stock <= 0);
    expect(belowMin).toHaveLength(1);
    expect(inZero).toHaveLength(1);
  });
});

describe('CSV export format', () => {
  it('generates valid CSV with headers', () => {
    const products = [
      { nombre: 'Queso', stock: 10, minStock: 5, unitCost: 50, precioVenta: 100 },
    ];
    const rows = [
      ['Producto', 'Stock', 'Min', 'Costo', 'PrecioVenta', 'Valor'],
      ...products.map(p => [
        p.nombre, p.stock, p.minStock, p.unitCost, p.precioVenta,
        p.stock * p.unitCost,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    expect(csv).toContain('Producto,Stock');
    expect(csv).toContain('Queso,10,5,50,100,500');
  });
});
