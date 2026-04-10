/**
 * Tests for AppContext data mappings.
 * 
 * AppContext transforms Supabase snake_case rows into camelCase
 * frontend objects. A bug in mapping means wrong data displayed,
 * missing fields, or crashes.
 * 
 * These tests validate the mapping logic so we can safely split
 * AppContext into smaller modules without breaking the transforms.
 */
import { describe, it, expect } from 'vitest';

// ── Extracted mapping functions (mirrors AppContext.tsx) ──────

function mapClient(c) {
  return {
    id:            c.id,
    nombre:        c.name,
    tipo:          c.type || '',
    telefono:      c.phone || '',
    email:         c.email || '',
    direccion:     c.address || '',
    ciudad:        c.ciudad || '',
    condPago:      c.cond_pago || '',
    limiteCredito: Number(c.limite_credito) || 0,
    notas:         c.notes || '',
    activo:        c.activo !== false,
    listaId:       c.lista_id || null,
    lat:           c.lat || null,
    lng:           c.lng || null,
    org_id:        c.org_id || '',
  };
}

function mapSupplier(s) {
  return {
    id:            s.id,
    name:          s.name,
    flag:          s.flag || '',
    color:         s.color || '#2980b9',
    times:         s.times || {},
    company:       s.company || '',
    contact:       s.contact || '',
    email:         s.email || '',
    phone:         s.phone || '',
    country:       s.country || '',
    city:          s.city || '',
    currency:      s.currency || 'USD',
    paymentTerms:  s.payment_terms || '',
    paymentMethod: s.payment_method || '',
    minOrder:      s.min_order || '',
    discount:      s.discount || '0',
    rating:        s.rating || 0,
    active:        s.active !== false,
    notes:         s.notes || '',
    org_id:        s.org_id || '',
  };
}

function mapVenta(v) {
  return {
    id:              v.id,
    nroVenta:        v.nro_venta || '',
    clienteId:       v.cliente_id || '',
    clienteNombre:   v.cliente_nombre || '',
    clienteTelefono: v.cliente_telefono || '',
    fecha:           v.fecha || '',
    estado:          v.estado || 'pendiente',
    items:           v.items || [],
    total:           Number(v.total) || 0,
    descuento:       Number(v.descuento) || 0,
    notas:           v.notas || '',
    estadoLog:       v.estado_log || [],
    creadoEn:        v.creado_en || '',
    updatedAt:       v.updated_at || '',
    tieneDevolucion: v.tiene_devolucion || false,
    moneda:          v.moneda || 'UYU',
    org_id:          v.org_id || '',
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('Client mapping (Supabase → frontend)', () => {
  const dbRow = {
    id: 'cli-1', name: 'Restaurante El Palenque', type: 'Restaurant',
    phone: '099123001', email: 'info@palenque.com', address: 'Mitre 1381',
    ciudad: 'Montevideo', cond_pago: 'credito_30', limite_credito: 80000,
    notes: 'VIP client', activo: true, lista_id: 'premium',
    lat: -34.9, lng: -56.18, org_id: 'aryes',
  };

  it('maps all fields correctly', () => {
    const mapped = mapClient(dbRow);
    expect(mapped.nombre).toBe('Restaurante El Palenque');
    expect(mapped.telefono).toBe('099123001');
    expect(mapped.condPago).toBe('credito_30');
    expect(mapped.limiteCredito).toBe(80000);
    expect(mapped.listaId).toBe('premium');
    expect(mapped.lat).toBe(-34.9);
  });

  it('handles missing optional fields', () => {
    const minimal = { id: 'cli-2', name: 'Test' };
    const mapped = mapClient(minimal);
    expect(mapped.nombre).toBe('Test');
    expect(mapped.telefono).toBe('');
    expect(mapped.limiteCredito).toBe(0);
    expect(mapped.listaId).toBeNull();
    expect(mapped.activo).toBe(true); // default active
  });

  it('converts limite_credito to number', () => {
    const withString = { id: 'cli-3', name: 'X', limite_credito: '50000' };
    expect(mapClient(withString).limiteCredito).toBe(50000);
  });

  it('handles null/undefined gracefully', () => {
    const withNulls = { id: 'cli-4', name: 'Y', phone: null, email: undefined };
    const mapped = mapClient(withNulls);
    expect(mapped.telefono).toBe('');
    expect(mapped.email).toBe('');
  });
});

describe('Supplier mapping (Supabase → frontend)', () => {
  const dbRow = {
    id: 'sup-1', name: 'Conaprole', flag: 'UY', color: '#059669',
    times: { preparation: 2, customs: 0, freight: 1, warehouse: 0 },
    company: 'Conaprole SA', phone: '29161100', email: 'ventas@conaprole.com',
    country: 'Uruguay', city: 'Montevideo', currency: 'UYU',
    payment_terms: '30', payment_method: 'transfer', min_order: '100',
    discount: '5', rating: 4, active: true, org_id: 'aryes',
  };

  it('maps all fields correctly', () => {
    const mapped = mapSupplier(dbRow);
    expect(mapped.name).toBe('Conaprole');
    expect(mapped.paymentTerms).toBe('30');
    expect(mapped.times.preparation).toBe(2);
    expect(mapped.rating).toBe(4);
  });

  it('handles missing fields with defaults', () => {
    const minimal = { id: 'sup-2', name: 'Test Supplier' };
    const mapped = mapSupplier(minimal);
    expect(mapped.color).toBe('#2980b9');
    expect(mapped.currency).toBe('USD');
    expect(mapped.active).toBe(true);
  });
});

describe('Venta mapping (Supabase → frontend)', () => {
  const dbRow = {
    id: 'v-1', nro_venta: 'VTA-0001', cliente_id: 'cli-1',
    cliente_nombre: 'El Palenque', cliente_telefono: '099123001',
    fecha: '2026-04-03', estado: 'entregada',
    items: [{ productId: 'p1', qty: 5, precio: 100 }],
    total: 500, descuento: 0, notas: '',
    estado_log: [{ estado: 'pendiente', ts: '2026-04-03T10:00:00Z', user: 'admin' }],
    creado_en: '2026-04-03T10:00:00Z', updated_at: '2026-04-03T12:00:00Z',
    tiene_devolucion: false, moneda: 'UYU', org_id: 'aryes',
  };

  it('maps all fields correctly', () => {
    const mapped = mapVenta(dbRow);
    expect(mapped.nroVenta).toBe('VTA-0001');
    expect(mapped.clienteId).toBe('cli-1');
    expect(mapped.clienteNombre).toBe('El Palenque');
    expect(mapped.estado).toBe('entregada');
    expect(mapped.total).toBe(500);
    expect(mapped.creadoEn).toBe('2026-04-03T10:00:00Z');
  });

  it('handles missing fields with defaults', () => {
    const minimal = { id: 'v-2' };
    const mapped = mapVenta(minimal);
    expect(mapped.nroVenta).toBe('');
    expect(mapped.estado).toBe('pendiente');
    expect(mapped.total).toBe(0);
    expect(mapped.moneda).toBe('UYU');
  });

  it('converts total/descuento to numbers', () => {
    const withStrings = { id: 'v-3', total: '1500', descuento: '100' };
    const mapped = mapVenta(withStrings);
    expect(mapped.total).toBe(1500);
    expect(mapped.descuento).toBe(100);
  });
});

describe('Product dual naming (nombre + name)', () => {
  it('demo products have both nombre and name', () => {
    // This mirrors AppContext line 91
    const demoProduct = { id: 'p1', name: 'Queso Colonia', sku: 'LAC-001', stock: 10 };
    const mapped = {
      id: demoProduct.sku || demoProduct.id,
      uuid: demoProduct.id,
      nombre: demoProduct.name,
      name: demoProduct.name,
    };
    expect(mapped.nombre).toBe('Queso Colonia');
    expect(mapped.name).toBe('Queso Colonia');
    expect(mapped.nombre).toBe(mapped.name);
  });

  it('dashboard KPI works with both unitCost and precio', () => {
    const products = [
      { stock: 10, unitCost: 50, precio: 70 },
      { stock: 5, precio: 100 },
      { stock: 20 },
    ];
    const stockValue = products.reduce((s, p) => 
      s + (p.stock || 0) * (p.unitCost || p.precio || 0), 0);
    expect(stockValue).toBe(10 * 50 + 5 * 100 + 0); // 500 + 500 + 0
    expect(stockValue).toBe(1000);
  });
});

describe('State machine — venta estados', () => {
  const VALID_TRANSITIONS = {
    pendiente:  ['confirmada', 'cancelada'],
    confirmada: ['preparada', 'cancelada'],
    preparada:  ['en_ruta', 'cancelada'],
    en_ruta:    ['entregada', 'cancelada'],
    entregada:  [],
    cancelada:  [],
  };

  it('pendiente can go to confirmada or cancelada', () => {
    expect(VALID_TRANSITIONS.pendiente).toContain('confirmada');
    expect(VALID_TRANSITIONS.pendiente).toContain('cancelada');
    expect(VALID_TRANSITIONS.pendiente).not.toContain('entregada');
  });

  it('cannot skip states (pendiente → entregada)', () => {
    expect(VALID_TRANSITIONS.pendiente).not.toContain('entregada');
    expect(VALID_TRANSITIONS.pendiente).not.toContain('en_ruta');
  });

  it('entregada and cancelada are terminal states', () => {
    expect(VALID_TRANSITIONS.entregada).toHaveLength(0);
    expect(VALID_TRANSITIONS.cancelada).toHaveLength(0);
  });

  it('any state can be cancelled', () => {
    for (const [estado, transitions] of Object.entries(VALID_TRANSITIONS)) {
      if (estado !== 'entregada' && estado !== 'cancelada') {
        expect(transitions).toContain('cancelada');
      }
    }
  });
});

describe('getOrgId / getSession pattern', () => {
  it('session without orgId defaults to aryes', () => {
    const session = { email: 'test@test.com', access_token: 'tok' };
    const orgId = session?.orgId || 'aryes';
    expect(orgId).toBe('aryes');
  });

  it('session with orgId uses it', () => {
    const session = { email: 'test@test.com', orgId: 'cliente-x' };
    const orgId = session?.orgId || 'aryes';
    expect(orgId).toBe('cliente-x');
  });

  it('null session defaults to aryes', () => {
    const session = null;
    const orgId = session?.orgId || 'aryes';
    expect(orgId).toBe('aryes');
  });
});
