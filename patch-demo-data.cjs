/**
 * patch-demo-data.js
 * 
 * Run from ~/Downloads/aryes-stock:
 *   node patch-demo-data.js
 * 
 * This script:
 * 1. Adds mapDemoCfes, mapDemoCobros, mapDemoMovements, mapDemoRutas to demoMapper.ts
 * 2. Updates AppContext.tsx to load cfes, cobros, movements, rutas in demo mode
 * 3. Adds cfes, cobros, movements data to all 4 demo datasets
 * 
 * After running: npm run build && npx vercel --prod
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// ═══════════════════════════════════════════════════════════════════════════
// 1. PATCH demoMapper.ts — add 4 new mapping functions
// ═══════════════════════════════════════════════════════════════════════════

const mapperPath = path.join(ROOT, 'src/context/demoMapper.ts');
let mapper = fs.readFileSync(mapperPath, 'utf8');

const newMappers = `

export function mapDemoCfes(cfes: any[], clients: any[]) {
  return cfes.map((f: any) => ({
    id: f.id,
    numero: f.numero || '',
    tipo: f.tipo || 'e-Factura',
    moneda: f.moneda || 'UYU',
    fecha: f.fecha || '',
    fechaVenc: f.fecha_venc || null,
    clienteId: f.cliente_id || null,
    clienteNombre: clients.find((c: any) => c.id === f.cliente_id)?.name || '',
    clienteRut: '',
    subtotal: f.subtotal || 0,
    ivaTotal: f.iva_total || 0,
    descuento: 0,
    total: f.total || 0,
    saldoPendiente: f.saldo_pendiente ?? f.total ?? 0,
    status: f.status || 'emitida',
    items: f.items || [],
    notas: '',
    createdAt: f.created_at || '',
  }));
}

export function mapDemoCobros(cobros: any[]) {
  return cobros.map((c: any) => ({
    id: c.id,
    clienteId: c.cliente_id || null,
    monto: c.monto || 0,
    metodo: c.metodo || '',
    fecha: c.fecha || '',
    fechaCheque: null,
    notas: c.notas || '',
    facturasAplicar: c.facturas_aplicar || [],
    createdAt: c.created_at || '',
  }));
}

export function mapDemoMovements(movements: any[]) {
  return movements.map((m: any) => ({
    id: m.id,
    tipo: m.tipo || 'manual_in',
    productoId: m.producto_id || '',
    productoNombre: m.producto_nombre || '',
    cantidad: m.cantidad || 0,
    referencia: m.referencia || '',
    notas: m.notas || '',
    fecha: m.fecha || '',
    timestamp: m.timestamp || m.fecha || '',
  }));
}

export function mapDemoRutas(rutas: any[]) {
  return rutas.map((r: any) => ({
    id: r.id,
    vehiculo: r.vehiculo || '',
    zona: r.zona || '',
    dia: r.dia || '',
    notas: r.notas || '',
    entregas: r.entregas || [],
    creadoEn: r.creado_en || new Date().toISOString(),
    capacidadKg: r.capacidad_kg ? Number(r.capacidad_kg) : undefined,
    capacidadBultos: r.capacidad_bultos ? Number(r.capacidad_bultos) : undefined,
  }));
}
`;

if (!mapper.includes('mapDemoCfes')) {
  mapper += newMappers;
  fs.writeFileSync(mapperPath, mapper, 'utf8');
  console.log('✅ demoMapper.ts — 4 new mapping functions added');
} else {
  console.log('⏭  demoMapper.ts — already patched');
}


// ═══════════════════════════════════════════════════════════════════════════
// 2. PATCH AppContext.tsx — load cfes, cobros, movements, rutas in demo mode
// ═══════════════════════════════════════════════════════════════════════════

const ctxPath = path.join(ROOT, 'src/context/AppContext.tsx');
let ctx = fs.readFileSync(ctxPath, 'utf8');

// 2a. Add imports for new mappers
if (!ctx.includes('mapDemoCfes')) {
  ctx = ctx.replace(
    /import\s*{\s*mapDemoProducts,\s*mapDemoClients,\s*mapDemoSuppliers,\s*mapDemoVentas\s*}/,
    'import { mapDemoProducts, mapDemoClients, mapDemoSuppliers, mapDemoVentas, mapDemoCfes, mapDemoCobros, mapDemoMovements, mapDemoRutas }'
  );
  console.log('✅ AppContext.tsx — imports updated');
} else {
  console.log('⏭  AppContext.tsx — imports already patched');
}

// 2b. Add loading of cfes, cobros, movements, rutas after setVentas(dv)
const ANCHOR = 'setProducts(dp); setClientes(dc); setSuppliers(ds); setVentas(dv);';
const NEW_LINES = `setProducts(dp); setClientes(dc); setSuppliers(ds); setVentas(dv);
    if (demoState.cfes) setCfes(mapDemoCfes(demoState.cfes, demoState.clients));
    if (demoState.cobros) setCobros(mapDemoCobros(demoState.cobros));
    if (demoState.movements) setMovements(mapDemoMovements(demoState.movements) as unknown as Movement[]);
    if (demoState.rutas) setRutas(mapDemoRutas(demoState.rutas) as unknown as Ruta[]);`;

if (!ctx.includes('demoState.cfes')) {
  ctx = ctx.replace(ANCHOR, NEW_LINES);
  console.log('✅ AppContext.tsx — demo data loading updated');
} else {
  console.log('⏭  AppContext.tsx — demo loading already patched');
}

// 2c. Update demoState type to include new fields
const OLD_TYPE = 'demoState?: { org: any; products: any[]; clients: any[]; suppliers: any[]; ventas: any[]; rutas: any[]; deposit_zones: any[]; industry: string } | null;';
const NEW_TYPE = 'demoState?: { org: any; products: any[]; clients: any[]; suppliers: any[]; ventas: any[]; rutas: any[]; deposit_zones: any[]; cfes?: any[]; cobros?: any[]; movements?: any[]; industry: string } | null;';

if (!ctx.includes('cfes?: any[]')) {
  ctx = ctx.replace(OLD_TYPE, NEW_TYPE);
  console.log('✅ AppContext.tsx — demoState type updated');
}

// 2d. Update useDemo demoState to pass new fields
const ctxUseDemoAnchor = `org: demoData.org,
      products: demoData.products,
      clients: demoData.clients,
      suppliers: demoData.suppliers,
      ventas: demoData.ventas,
      rutas: demoData.rutas,
      deposit_zones: demoData.deposit_zones,
      industry: demoIndustry,`;

const ctxUseDemoNew = `org: demoData.org,
      products: demoData.products,
      clients: demoData.clients,
      suppliers: demoData.suppliers,
      ventas: demoData.ventas,
      rutas: demoData.rutas,
      deposit_zones: demoData.deposit_zones,
      cfes: demoData.cfes || [],
      cobros: demoData.cobros || [],
      movements: demoData.movements || [],
      industry: demoIndustry,`;

// This is in useDemo.js, not AppContext
const useDemoPath = path.join(ROOT, 'src/demo/useDemo.js');
let useDemo = fs.readFileSync(useDemoPath, 'utf8');
if (!useDemo.includes('demoData.cfes')) {
  useDemo = useDemo.replace(ctxUseDemoAnchor, ctxUseDemoNew);
  fs.writeFileSync(useDemoPath, useDemo, 'utf8');
  console.log('✅ useDemo.js — demoState now passes cfes, cobros, movements');
} else {
  console.log('⏭  useDemo.js — already patched');
}

fs.writeFileSync(ctxPath, ctx, 'utf8');


// ═══════════════════════════════════════════════════════════════════════════
// 3. ADD FINANCIAL + OPERATIONAL DATA TO ALL 4 DATASETS
// ═══════════════════════════════════════════════════════════════════════════

function generateDemoFinancials(datasetName, clients, products, ventas) {
  const now = new Date();
  
  // Generate CFEs from ventas (each venta = 1 factura)
  const cfes = [];
  const cobros = [];
  const movements = [];

  // Past ventas get invoices
  ventas.forEach((v, i) => {
    const ventaDate = new Date(now);
    ventaDate.setDate(ventaDate.getDate() + (v.date || 0));
    const vencDate = new Date(ventaDate);
    vencDate.setDate(vencDate.getDate() + 30);
    
    const total = v.items.reduce((s, it) => s + it.qty * it.price, 0);
    const iva = Math.round(total * 0.22);
    const subtotal = total - iva;
    
    const isDelivered = ['entregada'].includes(v.estado);
    const isPaid = v.pago === 'efectivo' || v.pago === 'transferencia';
    
    cfes.push({
      id: `cfe-${datasetName}-${i+1}`,
      numero: `E-${String(1000 + i).padStart(4, '0')}`,
      tipo: 'e-Factura',
      moneda: 'UYU',
      fecha: ventaDate.toISOString().split('T')[0],
      fecha_venc: vencDate.toISOString().split('T')[0],
      cliente_id: v.cliente_id,
      subtotal,
      iva_total: iva,
      total,
      saldo_pendiente: isDelivered && isPaid ? 0 : total,
      status: isDelivered && isPaid ? 'cobrada' : isDelivered ? 'emitida' : 'borrador',
      items: v.items,
      created_at: ventaDate.toISOString(),
    });
    
    // Cobros for paid invoices
    if (isDelivered && isPaid) {
      cobros.push({
        id: `cob-${datasetName}-${i+1}`,
        cliente_id: v.cliente_id,
        monto: total,
        metodo: v.pago === 'efectivo' ? 'efectivo' : 'transferencia',
        fecha: ventaDate.toISOString().split('T')[0],
        notas: '',
        facturas_aplicar: [`cfe-${datasetName}-${i+1}`],
        created_at: ventaDate.toISOString(),
      });
    }
  });

  // Add some older CFEs for sparkline data (last 6 months)
  for (let month = 5; month >= 1; month--) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - month);
    const numInvoices = 8 + Math.floor(Math.random() * 5);
    
    for (let j = 0; j < numInvoices; j++) {
      const day = 1 + Math.floor(Math.random() * 28);
      const invoiceDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const clientIdx = Math.floor(Math.random() * clients.length);
      const total = 5000 + Math.floor(Math.random() * 45000);
      const iva = Math.round(total * 0.22);
      
      cfes.push({
        id: `cfe-${datasetName}-hist-${month}-${j}`,
        numero: `E-${String(800 + month*20 + j).padStart(4, '0')}`,
        tipo: 'e-Factura',
        moneda: 'UYU',
        fecha: invoiceDate.toISOString().split('T')[0],
        fecha_venc: new Date(invoiceDate.getTime() + 30*86400000).toISOString().split('T')[0],
        cliente_id: clients[clientIdx].id,
        subtotal: total - iva,
        iva_total: iva,
        total,
        saldo_pendiente: month >= 3 ? 0 : Math.random() > 0.6 ? total : 0,
        status: month >= 3 ? 'cobrada' : Math.random() > 0.6 ? 'emitida' : 'cobrada',
        items: [],
        created_at: invoiceDate.toISOString(),
      });
    }
  }

  // Generate movements from products (recent activity)
  const movTypes = ['delivery', 'manual_in', 'order_placed', 'manual_out'];
  products.slice(0, 15).forEach((p, i) => {
    const daysAgo = Math.floor(Math.random() * 14);
    const movDate = new Date(now);
    movDate.setDate(movDate.getDate() - daysAgo);
    const tipo = movTypes[i % movTypes.length];
    const isOut = tipo === 'order_placed' || tipo === 'manual_out';
    
    movements.push({
      id: `mov-${datasetName}-${i+1}`,
      tipo,
      producto_id: p.sku || p.id,
      producto_nombre: p.name,
      cantidad: isOut ? -(Math.floor(Math.random() * 10) + 1) : Math.floor(Math.random() * 20) + 5,
      referencia: tipo === 'delivery' ? `PO-${100+i}` : tipo === 'order_placed' ? `V-${i+1}` : '',
      notas: '',
      fecha: movDate.toISOString().split('T')[0],
      timestamp: movDate.toISOString(),
    });
  });

  return { cfes, cobros, movements };
}

// Generate rutas with entregas for each dataset
function generateDemoRutas(datasetName, clients, ventas) {
  const now = new Date();
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  
  // Create 3 rutas with real entregas
  const rutas = [];
  const clientGroups = [];
  const perGroup = Math.ceil(clients.length / 3);
  for (let i = 0; i < 3; i++) {
    clientGroups.push(clients.slice(i * perGroup, (i + 1) * perGroup));
  }

  const vehiculos = ['Camión Hyundai HD65', 'Renault Master', 'Fiat Ducato'];
  const zonas = {
    horeca: ['Centro-Pocitos', 'Costa Este', 'Carrasco-Malvín'],
    bebidas: ['Zona Sur', 'Ciudad Vieja-Centro', 'Zona Norte'],
    limpieza: ['Ruta 1 - Oeste', 'Cordón-Parque Rodó', 'Malvín-Buceo'],
    construccion: ['Zona Industrial', 'Centro-Sur', 'Costa'],
  };
  const zoneNames = zonas[datasetName] || ['Zona A', 'Zona B', 'Zona C'];

  clientGroups.forEach((group, i) => {
    if (group.length === 0) return;
    const entregas = group.slice(0, 6).map((c, j) => {
      const estados = ['entregado', 'entregado', 'en_camino', 'pendiente', 'pendiente', 'pendiente'];
      return {
        clienteId: c.id,
        clienteNombre: c.name,
        direccion: c.address || '',
        telefono: c.phone || '',
        estado: estados[j] || 'pendiente',
        orden: j + 1,
        notas: '',
        hora: j < 2 ? `${8 + j}:${j === 0 ? '30' : '15'}` : null,
      };
    });

    rutas.push({
      id: `ruta-${datasetName}-${i+1}`,
      vehiculo: vehiculos[i] || `Vehículo ${i+1}`,
      zona: zoneNames[i],
      dia: days[i % days.length],
      notas: '',
      entregas,
      creado_en: now.toISOString(),
      capacidad_kg: 500 + i * 200,
      capacidad_bultos: 50 + i * 20,
    });
  });

  return rutas;
}


// ── Patch each dataset file ──────────────────────────────────────────────

const datasets = [
  { file: 'demo-horeca.js', export: 'demoHoreca', name: 'horeca' },
  { file: 'demo-bebidas.js', export: 'demoBebidas', name: 'bebidas' },
  { file: 'demo-limpieza.js', export: 'demoLimpieza', name: 'limpieza' },
  { file: 'demo-construccion.js', export: 'demoConstruccion', name: 'construccion' },
];

datasets.forEach(ds => {
  const filePath = path.join(ROOT, 'src/demo', ds.file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('"cfes"') || content.includes("'cfes'") || content.includes('cfes:')) {
    console.log(`⏭  ${ds.file} — already has cfes`);
    return;
  }

  // Dynamic import to read the data
  // We can't use require() for ES modules, so we'll parse the data manually
  // Instead, we'll extract clients, products, ventas arrays from the file
  
  // Simple approach: add a generator block that creates data at runtime
  const runtimeBlock = `

  // ── Generated financial & operational demo data ──────────────────────────
  // CFEs (facturas), cobros, movements — generated at import time for realistic KPIs
  get cfes() {
    const now = new Date();
    const cfes = [];
    // Current month ventas → invoices
    (this.ventas || []).forEach((v, i) => {
      const d = new Date(now); d.setDate(d.getDate() + (v.date || 0));
      const venc = new Date(d); venc.setDate(venc.getDate() + 30);
      const total = v.items.reduce((s, it) => s + it.qty * it.price, 0);
      const iva = Math.round(total * 0.22);
      const isPaid = v.pago === 'efectivo' || v.pago === 'transferencia';
      const isDone = v.estado === 'entregada';
      cfes.push({
        id: 'cfe-${ds.name}-'+i, numero: 'E-'+String(1000+i).padStart(4,'0'),
        tipo: 'e-Factura', moneda: 'UYU',
        fecha: d.toISOString().split('T')[0],
        fecha_venc: venc.toISOString().split('T')[0],
        cliente_id: v.cliente_id, subtotal: total-iva, iva_total: iva,
        total, saldo_pendiente: isDone&&isPaid ? 0 : total,
        status: isDone&&isPaid ? 'cobrada' : isDone ? 'emitida' : 'borrador',
        items: v.items, created_at: d.toISOString(),
      });
    });
    // Historical invoices (5 months back) for sparkline
    for (let m=5; m>=1; m--) {
      const md = new Date(now); md.setMonth(md.getMonth()-m);
      for (let j=0; j<(8+Math.floor(m*1.5)); j++) {
        const day = 1+Math.floor(Math.random()*28);
        const id2 = new Date(md.getFullYear(), md.getMonth(), day);
        const ci = Math.floor(Math.random()*this.clients.length);
        const t = 5000+Math.floor(Math.random()*45000);
        const iv = Math.round(t*0.22);
        cfes.push({
          id: 'cfe-${ds.name}-h'+m+'-'+j, numero: 'E-'+String(800+m*20+j).padStart(4,'0'),
          tipo: 'e-Factura', moneda: 'UYU',
          fecha: id2.toISOString().split('T')[0],
          fecha_venc: new Date(id2.getTime()+30*864e5).toISOString().split('T')[0],
          cliente_id: this.clients[ci]?.id||'c1', subtotal: t-iv, iva_total: iv,
          total: t, saldo_pendiente: m>=3 ? 0 : (j%3===0 ? t : 0),
          status: m>=3 ? 'cobrada' : (j%3===0 ? 'emitida' : 'cobrada'),
          items: [], created_at: id2.toISOString(),
        });
      }
    }
    return cfes;
  },

  get cobros() {
    const now = new Date();
    const cobros = [];
    (this.ventas || []).forEach((v, i) => {
      if ((v.pago==='efectivo'||v.pago==='transferencia') && v.estado==='entregada') {
        const d = new Date(now); d.setDate(d.getDate()+(v.date||0));
        const total = v.items.reduce((s,it)=>s+it.qty*it.price,0);
        cobros.push({
          id: 'cob-${ds.name}-'+i, cliente_id: v.cliente_id,
          monto: total, metodo: v.pago, fecha: d.toISOString().split('T')[0],
          notas: '', facturas_aplicar: ['cfe-${ds.name}-'+i],
          created_at: d.toISOString(),
        });
      }
    });
    // Historical cobros
    for (let m=5; m>=1; m--) {
      const md = new Date(now); md.setMonth(md.getMonth()-m);
      for (let j=0; j<6; j++) {
        const day = 1+Math.floor(Math.random()*28);
        const id2 = new Date(md.getFullYear(), md.getMonth(), day);
        cobros.push({
          id: 'cob-${ds.name}-h'+m+'-'+j, cliente_id: this.clients[j%this.clients.length]?.id||'c1',
          monto: 5000+Math.floor(Math.random()*30000),
          metodo: j%2===0?'transferencia':'efectivo',
          fecha: id2.toISOString().split('T')[0], notas: '',
          facturas_aplicar: [], created_at: id2.toISOString(),
        });
      }
    }
    return cobros;
  },

  get movements() {
    const now = new Date();
    const movs = [];
    const types = ['delivery','manual_in','order_placed','manual_out'];
    (this.products || []).slice(0,15).forEach((p,i) => {
      const d = new Date(now); d.setDate(d.getDate()-Math.floor(Math.random()*14));
      const tipo = types[i%4];
      const isOut = tipo==='order_placed'||tipo==='manual_out';
      movs.push({
        id: 'mov-${ds.name}-'+i, tipo,
        producto_id: p.sku||p.id, producto_nombre: p.name,
        cantidad: isOut ? -(Math.floor(Math.random()*10)+1) : Math.floor(Math.random()*20)+5,
        referencia: tipo==='delivery'?'PO-'+(100+i):tipo==='order_placed'?'V-'+(i+1):'',
        notas: '', fecha: d.toISOString().split('T')[0],
        timestamp: d.toISOString(),
      });
    });
    return movs;
  },
`;

  // Insert before the closing };
  // Find the last occurrence of "};" which closes the export
  const lastClosing = content.lastIndexOf('};');
  if (lastClosing === -1) {
    console.error(`❌ ${ds.file} — could not find closing };`);
    return;
  }

  content = content.slice(0, lastClosing) + runtimeBlock + content.slice(lastClosing);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${ds.file} — cfes, cobros, movements added`);
});


// ── Patch rutas in each dataset (replace simple format with entregas) ─────

datasets.forEach(ds => {
  const filePath = path.join(ROOT, 'src/demo', ds.file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('entregas:') && content.includes('estado:')) {
    console.log(`⏭  ${ds.file} — rutas already have entregas`);
    return;
  }

  // We need to replace the simple rutas format with one that has entregas
  // The current format is: { id, name, driver, stops: ['c1','c2',...] }
  // We need: { id, vehiculo, zona, dia, entregas: [{clienteId, clienteNombre, ...}], capacidad_kg, capacidad_bultos, creado_en }
  
  // For HORECA specifically:
  if (ds.name === 'horeca') {
    const oldRutas = `rutas: [
    {
      id: 'r1', name: 'Ruta Centro-Pocitos', driver: 'Carlos Méndez', stops: ['c1', 'c2', 'c14', 'c4', 'c5', 'c11'],
    },
    {
      id: 'r2', name: 'Ruta Costa', driver: 'Martín Pereira', stops: ['c8', 'c7', 'c19'],
    },
  ],`;
    
    const newRutas = `rutas: [
    {
      id: 'r1', vehiculo: 'Camión Hyundai HD65', zona: 'Centro-Pocitos', dia: 'Martes',
      capacidad_kg: 500, capacidad_bultos: 60, creado_en: new Date().toISOString(),
      entregas: [
        { clienteId: 'c1', clienteNombre: 'Restaurante El Palenque', direccion: 'Bartolomé Mitre 1381', telefono: '099123001', estado: 'entregado', orden: 1, notas: '', hora: '8:30' },
        { clienteId: 'c2', clienteNombre: 'Bar Arocena', direccion: 'Ciudadela 1180', telefono: '099123002', estado: 'entregado', orden: 2, notas: '', hora: '9:15' },
        { clienteId: 'c14', clienteNombre: 'Cantina del Puerto', direccion: 'Rambla 25 de Agosto 218', telefono: '099123014', estado: 'en_camino', orden: 3, notas: '', hora: null },
        { clienteId: 'c4', clienteNombre: 'Pizzería Trouville', direccion: 'José Ellauri 1349', telefono: '099123004', estado: 'pendiente', orden: 4, notas: '', hora: null },
        { clienteId: 'c5', clienteNombre: 'Café Misterio', direccion: '21 de Setiembre 2895', telefono: '099123005', estado: 'pendiente', orden: 5, notas: '', hora: null },
        { clienteId: 'c11', clienteNombre: 'Sushi Corner', direccion: 'Av. Brasil 2587', telefono: '099123011', estado: 'pendiente', orden: 6, notas: '', hora: null },
      ],
    },
    {
      id: 'r2', vehiculo: 'Renault Master', zona: 'Costa Este', dia: 'Martes',
      capacidad_kg: 700, capacidad_bultos: 80, creado_en: new Date().toISOString(),
      entregas: [
        { clienteId: 'c8', clienteNombre: 'Francis Hotel & Restó', direccion: 'Rambla Rep. de México 6363', telefono: '099123008', estado: 'entregado', orden: 1, notas: '', hora: '8:00' },
        { clienteId: 'c7', clienteNombre: 'Parador La Huella (Punta)', direccion: 'Ruta 10 Km 161', telefono: '099123007', estado: 'en_camino', orden: 2, notas: '', hora: null },
        { clienteId: 'c19', clienteNombre: 'Casino Enjoy - Gastronomía', direccion: 'Rambla Williman, Punta del Este', telefono: '099123019', estado: 'pendiente', orden: 3, notas: '', hora: null },
      ],
    },
    {
      id: 'r3', vehiculo: 'Fiat Ducato', zona: 'Carrasco-Malvín', dia: 'Miércoles',
      capacidad_kg: 400, capacidad_bultos: 45, creado_en: new Date().toISOString(),
      entregas: [
        { clienteId: 'c3', clienteNombre: 'Hotel Palladium - Cocina', direccion: 'Tomás Basáñez 6553', telefono: '099123003', estado: 'pendiente', orden: 1, notas: '', hora: null },
        { clienteId: 'c6', clienteNombre: 'La Perdiz Restaurante', direccion: 'Av. Rivera 4398', telefono: '099123006', estado: 'pendiente', orden: 2, notas: '', hora: null },
        { clienteId: 'c18', clienteNombre: 'Heladería Freddo Punta Carretas', direccion: 'Ellauri 553', telefono: '099123018', estado: 'pendiente', orden: 3, notas: '', hora: null },
        { clienteId: 'c10', clienteNombre: 'Club de Golf del Uruguay', direccion: 'Bvar. Artigas 379', telefono: '099123010', estado: 'pendiente', orden: 4, notas: '', hora: null },
      ],
    },
  ],`;

    if (content.includes(oldRutas)) {
      content = content.replace(oldRutas, newRutas);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${ds.file} — rutas upgraded with entregas`);
    } else {
      console.log(`⚠️  ${ds.file} — could not find exact rutas block to replace (may need manual update)`);
    }
  }
  // For other datasets, we'd need to see their rutas format
  // For now, just log
  if (ds.name !== 'horeca') {
    console.log(`ℹ️  ${ds.file} — check rutas manually (may need entregas format)`);
  }
});


console.log('\n══════════════════════════════════════════════');
console.log('Done! Next steps:');
console.log('  1. cd ~/Downloads/aryes-stock');
console.log('  2. npm run build');
console.log('  3. If build passes → open demo mode and take screenshots');
console.log('  4. npx vercel --prod');
console.log('══════════════════════════════════════════════');
