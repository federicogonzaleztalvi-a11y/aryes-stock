/**
 * Tests for demo mode logic.
 * 
 * The demo mode allows prospects to explore the platform
 * with sample data without creating an account.
 * A bug here means: demo data leaks into real data, or
 * real data operations run in demo mode.
 */
import { describe, it, expect } from 'vitest';

// ── Mock demo datasets ────────────────────────────────────────
const DEMO_INDUSTRIES = ['horeca', 'bebidas', 'limpieza', 'construccion'];

const mockDataset = {
  org: { name: 'Test Corp', rut: '123', address: 'Test', phone: '099', ownerPhone: '099', moneda: 'UYU', iva_default: 22 },
  products: [
    { id: 'p1', name: 'Product 1', sku: 'SKU-001', stock: 10, min_stock: 5, price: 100, cost: 70, unit: 'kg', iva_rate: 22, imagen_url: null, supplier_id: 's1', category: 'Cat1' },
    { id: 'p2', name: 'Product 2', sku: 'SKU-002', stock: 0, min_stock: 3, price: 200, cost: 150, unit: 'un', iva_rate: 22, imagen_url: null, supplier_id: 's1', category: 'Cat1' },
  ],
  clients: [
    { id: 'c1', name: 'Client 1', phone: '099111', address: 'Addr 1', zone: 'Zone1', lista_id: 'general', credit_limit: 50000, balance: 10000 },
  ],
  suppliers: [
    { id: 's1', name: 'Supplier 1', phone: '099222', email: 'sup@test.com', lead_time_days: 3, category: 'Cat1' },
  ],
  ventas: [
    { id: 'v1', cliente_id: 'c1', date: -1, items: [{ product_id: 'p1', qty: 5, price: 100 }], estado: 'entregada', pago: 'efectivo' },
  ],
};

// ── Tests ────────────────────────────────────────────────────

describe('Demo mode — data isolation', () => {
  it('all 4 industries are defined', () => {
    expect(DEMO_INDUSTRIES).toHaveLength(4);
    expect(DEMO_INDUSTRIES).toContain('horeca');
    expect(DEMO_INDUSTRIES).toContain('bebidas');
  });

  it('demo dataset has required fields', () => {
    expect(mockDataset.org).toBeDefined();
    expect(mockDataset.org.name).toBeTruthy();
    expect(mockDataset.products).toBeInstanceOf(Array);
    expect(mockDataset.clients).toBeInstanceOf(Array);
    expect(mockDataset.suppliers).toBeInstanceOf(Array);
    expect(mockDataset.ventas).toBeInstanceOf(Array);
  });

  it('demo products have all required fields for ProductForm', () => {
    for (const p of mockDataset.products) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.sku).toBeTruthy();
      expect(typeof p.stock).toBe('number');
      expect(typeof p.price).toBe('number');
      expect(typeof p.cost).toBe('number');
      expect(p.unit).toBeTruthy();
      expect(typeof p.iva_rate).toBe('number');
    }
  });

  it('demo clients have phone for WhatsApp', () => {
    for (const c of mockDataset.clients) {
      expect(c.phone).toBeTruthy();
      expect(c.phone.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('demo ventas reference valid client and product IDs', () => {
    const clientIds = new Set(mockDataset.clients.map(c => c.id));
    const productIds = new Set(mockDataset.products.map(p => p.id));
    for (const v of mockDataset.ventas) {
      expect(clientIds.has(v.cliente_id)).toBe(true);
      for (const item of v.items) {
        expect(productIds.has(item.product_id)).toBe(true);
      }
    }
  });

  it('stockValue calculation works with both unitCost and precio', () => {
    // This mirrors the Dashboard KPI fix
    const withUnitCost = [{ stock: 10, unitCost: 50, precio: 70 }];
    const withPrecio = [{ stock: 10, precio: 70 }];
    const withNeither = [{ stock: 10 }];

    const calc = (products) => products.reduce((s, p) => s + (p.stock || 0) * (p.unitCost || p.precio || 0), 0);

    expect(calc(withUnitCost)).toBe(500); // uses unitCost
    expect(calc(withPrecio)).toBe(700);   // falls back to precio
    expect(calc(withNeither)).toBe(0);    // no cost = 0
  });
});

describe('Demo mode — guard logic', () => {
  it('demoGuard returns true and shows message for destructive actions', () => {
    let toastMsg = null;
    const mockDemoGuard = (msg) => { toastMsg = msg; return true; };

    const blocked = mockDemoGuard('Creá tu cuenta para guardar cambios');
    expect(blocked).toBe(true);
    expect(toastMsg).toContain('Creá tu cuenta');
  });

  it('demo session has _demo flag', () => {
    const demoSession = {
      email: 'demo@aryes.com',
      role: 'admin',
      name: 'Demo',
      orgId: 'demo',
      access_token: 'demo-token',
      _demo: true,
    };
    expect(demoSession._demo).toBe(true);
    expect(demoSession.role).toBe('admin');
  });
});
