/**
 * demoMapper.ts — Maps demo dataset formats to internal app types.
 * Extracted from AppContext.tsx for testability and clarity.
 * 
 * Used by: AppContext (demo mode useEffect)
 * Tested by: demo.test.js, appcontext.test.js
 */

export function mapDemoProducts(products: any[]) {
  return products.map((p: any) => ({
    id: p.sku || p.id,
    uuid: p.id,
    nombre: p.name,
    name: p.name,
    marca: p.category,
    brand: p.category,
    unidad: p.unit || 'un',
    unit: p.unit || 'un',
    barcode: p.sku,
    stock: p.stock,
    minStock: p.min_stock,
    precio: p.cost,
    precioVenta: p.price,
    unitCost: p.cost,
    supplierId: p.supplier_id,
    imagenUrl: p.imagen_url,
    descripcion: '',
    ivaRate: p.iva_rate || 22,
    org_id: 'demo',
    dailyUsage: Math.max(1, Math.round(p.stock * 0.08)),
  }));
}

export function mapDemoClients(clients: any[]) {
  return clients.map((c: any) => ({
    id: c.id,
    nombre: c.name,
    tipo: c.zone || '',
    telefono: c.phone,
    email: '',
    direccion: c.address,
    ciudad: 'Montevideo',
    condPago: 'cuenta_corriente',
    limiteCred: c.credit_limit || 0,
    notas: '',
    activo: true,
    listaId: c.lista_id || null,
    lat: null,
    lng: null,
    org_id: 'demo',
  }));
}

export function mapDemoSuppliers(suppliers: any[]) {
  return suppliers.map((s: any) => ({
    id: s.id,
    name: s.name,
    flag: '',
    color: '#2980b9',
    times: { preparation: s.lead_time_days, customs: 0, freight: 0, warehouse: 0 },
    company: s.name,
    contact: '',
    email: s.email || '',
    phone: s.phone || '',
    country: 'Uruguay',
    city: 'Montevideo',
    currency: 'UYU',
    paymentTerms: '30',
    paymentMethod: '',
    minOrder: '',
    discount: '0',
    rating: 4,
    active: true,
    notes: '',
  }));
}

export function mapDemoVentas(ventas: any[], clients: any[], products: any[]) {
  return ventas.map((v: any) => ({
    id: v.id,
    nroVenta: v.id.toUpperCase(),
    clienteId: v.cliente_id,
    clienteNombre: clients.find((c: any) => c.id === v.cliente_id)?.name || '',
    clienteTelefono: clients.find((c: any) => c.id === v.cliente_id)?.phone || '',
    fecha: v.fecha || new Date().toISOString().split('T')[0],
    estado: v.estado,
    items: v.items.map((it: any) => ({
      productId: it.product_id,
      nombre: products.find((p: any) => p.id === it.product_id)?.name || it.product_id,
      qty: it.qty,
      precio: it.price,
      subtotal: it.qty * it.price,
    })),
    total: v.total || v.items.reduce((s: number, it: any) => s + it.qty * it.price, 0),
    descuento: 0,
    notas: '',
    estadoLog: [{ estado: v.estado, ts: v.created_at || new Date().toISOString(), user: 'demo' }],
    creadoEn: v.created_at || new Date().toISOString(),
    updatedAt: v.created_at || new Date().toISOString(),
    tieneDevolucion: false,
    moneda: 'UYU',
    org_id: 'demo',
  }));
}
