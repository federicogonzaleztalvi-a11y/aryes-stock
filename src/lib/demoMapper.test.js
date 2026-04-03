/**
 * Tests for demoMapper — validates demo data transformations.
 * These protect the AppContext split from breaking demo mode.
 */
import { describe, it, expect } from 'vitest';
import { mapDemoProducts, mapDemoClients, mapDemoSuppliers, mapDemoVentas } from '../context/demoMapper.ts';

const sampleProducts = [
  { id: 'h1', name: 'Queso Colonia', sku: 'LAC-001', category: 'Lácteos', supplier_id: 's1', unit: 'kg', price: 420, cost: 310, stock: 85, min_stock: 20, iva_rate: 22, imagen_url: null },
];

const sampleClients = [
  { id: 'c1', name: 'Restaurante El Palenque', phone: '099123001', address: 'Mitre 1381', zone: 'Centro', lista_id: 'general', credit_limit: 80000, balance: 12500 },
];

const sampleSuppliers = [
  { id: 's1', name: 'Conaprole', phone: '29161100', email: 'ventas@conaprole.com', lead_time_days: 2, category: 'Lácteos' },
];

const sampleVentas = [
  { id: 'v1', cliente_id: 'c1', items: [{ product_id: 'h1', qty: 5, price: 420 }], estado: 'entregada', pago: 'efectivo' },
];

describe('mapDemoProducts', () => {
  it('maps all required fields', () => {
    const mapped = mapDemoProducts(sampleProducts);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].id).toBe('LAC-001'); // uses sku
    expect(mapped[0].uuid).toBe('h1');
    expect(mapped[0].nombre).toBe('Queso Colonia');
    expect(mapped[0].name).toBe('Queso Colonia');
    expect(mapped[0].stock).toBe(85);
    expect(mapped[0].unitCost).toBe(310);
    expect(mapped[0].precioVenta).toBe(420);
    expect(mapped[0].org_id).toBe('demo');
  });

  it('has both nombre and name (dual naming)', () => {
    const mapped = mapDemoProducts(sampleProducts);
    expect(mapped[0].nombre).toBe(mapped[0].name);
  });

  it('generates dailyUsage > 0', () => {
    const mapped = mapDemoProducts(sampleProducts);
    expect(mapped[0].dailyUsage).toBeGreaterThan(0);
  });
});

describe('mapDemoClients', () => {
  it('maps all required fields', () => {
    const mapped = mapDemoClients(sampleClients);
    expect(mapped[0].nombre).toBe('Restaurante El Palenque');
    expect(mapped[0].telefono).toBe('099123001');
    expect(mapped[0].limiteCred).toBe(80000);
    expect(mapped[0].org_id).toBe('demo');
  });
});

describe('mapDemoSuppliers', () => {
  it('maps with correct defaults', () => {
    const mapped = mapDemoSuppliers(sampleSuppliers);
    expect(mapped[0].name).toBe('Conaprole');
    expect(mapped[0].times.preparation).toBe(2);
    expect(mapped[0].currency).toBe('UYU');
    expect(mapped[0].active).toBe(true);
  });
});

describe('mapDemoVentas', () => {
  it('resolves client and product names', () => {
    const mapped = mapDemoVentas(sampleVentas, sampleClients, sampleProducts);
    expect(mapped[0].clienteNombre).toBe('Restaurante El Palenque');
    expect(mapped[0].items[0].nombre).toBe('Queso Colonia');
    expect(mapped[0].total).toBe(2100); // 5 * 420
    expect(mapped[0].org_id).toBe('demo');
  });
});
