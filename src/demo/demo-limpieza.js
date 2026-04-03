// Demo dataset: Limpieza — HigienePro Uruguay S.R.L.
// Distribuidora de productos de limpieza e higiene, 320 SKUs representados con 40 productos clave

export const demoLimpieza = {
  org: {
    name: 'HigienePro Uruguay S.R.L.',
    rut: '219012560015',
    address: 'Camino Cibils 3250, Cerro, Montevideo',
    phone: '23141800',
    ownerPhone: '59899789012',
    logo: null,
    moneda: 'UYU',
    iva_default: 22,
    horario: 'Lun a Vie 8:00 - 17:30 · Sáb 8:00 - 12:00',
  },

  suppliers: [
    { id: 's1', name: 'Nevex (Unilever Uruguay)', phone: '29027300', email: 'distribuidores@unilever.com.uy', lead_time_days: 3, category: 'Limpieza hogar' },
    { id: 's2', name: 'Químicos del Sur', phone: '23148900', email: 'ventas@quimicossur.com.uy', lead_time_days: 2, category: 'Químicos industriales' },
    { id: 's3', name: 'Papelera del Plata', phone: '29246800', email: 'pedidos@papeleradelplata.com.uy', lead_time_days: 3, category: 'Papelería e higiene' },
    { id: 's4', name: 'Conaprole (Línea institucional)', phone: '29161100', email: 'institucional@conaprole.com.uy', lead_time_days: 2, category: 'Jabones' },
    { id: 's5', name: 'Importadora Higiene Total', phone: '26008500', email: 'info@higienetotal.com.uy', lead_time_days: 7, category: 'Importados' },
    { id: 's6', name: 'Bolsas del Uruguay', phone: '22034600', email: 'comercial@bolsasdel.com.uy', lead_time_days: 4, category: 'Bolsas y descartables' },
    { id: 's7', name: 'Proclin S.A.', phone: '24871200', email: 'pedidos@proclin.com.uy', lead_time_days: 3, category: 'Profesional' },
  ],

  products: [
    // Limpieza hogar — Nevex/Unilever
    { id: 'l1', name: 'Lavandina Nevex 5L x 4', sku: 'LIM-001', category: 'Limpieza hogar', supplier_id: 's1', unit: 'pack', price: 580, cost: 430, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'l2', name: 'Detergente Nevex líquido 5L x 4', sku: 'LIM-002', category: 'Limpieza hogar', supplier_id: 's1', unit: 'pack', price: 1250, cost: 940, stock: 80, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'l3', name: 'Suavizante Vívere 5L x 4', sku: 'LIM-003', category: 'Limpieza hogar', supplier_id: 's1', unit: 'pack', price: 1100, cost: 820, stock: 65, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'l4', name: 'CIF crema multiuso 750ml x 12', sku: 'LIM-004', category: 'Limpieza hogar', supplier_id: 's1', unit: 'caja', price: 1450, cost: 1090, stock: 50, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'l5', name: 'Vim limpiador baño 500ml x 12', sku: 'LIM-005', category: 'Limpieza hogar', supplier_id: 's1', unit: 'caja', price: 1380, cost: 1035, stock: 45, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'l6', name: 'Skip líquido 3L x 4', sku: 'LIM-006', category: 'Limpieza hogar', supplier_id: 's1', unit: 'pack', price: 2200, cost: 1650, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'l7', name: 'Jabón en polvo Nevex 10kg', sku: 'LIM-007', category: 'Limpieza hogar', supplier_id: 's1', unit: 'bolsa', price: 890, cost: 665, stock: 55, min_stock: 15, iva_rate: 22, imagen_url: null },

    // Químicos industriales — Químicos del Sur
    { id: 'l8', name: 'Hipoclorito de sodio 10L', sku: 'QUI-001', category: 'Químicos industriales', supplier_id: 's2', unit: 'bidón', price: 420, cost: 310, stock: 90, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'l9', name: 'Desengrasante industrial 5L', sku: 'QUI-002', category: 'Químicos industriales', supplier_id: 's2', unit: 'bidón', price: 680, cost: 510, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'l10', name: 'Alcohol en gel 5L', sku: 'QUI-003', category: 'Químicos industriales', supplier_id: 's2', unit: 'bidón', price: 750, cost: 560, stock: 75, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'l11', name: 'Limpiador multiuso concentrado 20L', sku: 'QUI-004', category: 'Químicos industriales', supplier_id: 's2', unit: 'tambor', price: 1800, cost: 1350, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'l12', name: 'Abrillantador de pisos 5L', sku: 'QUI-005', category: 'Químicos industriales', supplier_id: 's2', unit: 'bidón', price: 620, cost: 465, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'l13', name: 'Ácido muriático 5L', sku: 'QUI-006', category: 'Químicos industriales', supplier_id: 's2', unit: 'bidón', price: 350, cost: 260, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Papelería e higiene — Papelera del Plata
    { id: 'l14', name: 'Papel higiénico Elite 300m x 8', sku: 'PAP-001', category: 'Papelería e higiene', supplier_id: 's3', unit: 'pack', price: 1650, cost: 1240, stock: 100, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'l15', name: 'Toalla interfoliada x 2500', sku: 'PAP-002', category: 'Papelería e higiene', supplier_id: 's3', unit: 'caja', price: 890, cost: 665, stock: 70, min_stock: 18, iva_rate: 22, imagen_url: null },
    { id: 'l16', name: 'Papel higiénico doble hoja x 48', sku: 'PAP-003', category: 'Papelería e higiene', supplier_id: 's3', unit: 'bolsón', price: 2100, cost: 1575, stock: 45, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'l17', name: 'Servilletas x 10000', sku: 'PAP-004', category: 'Papelería e higiene', supplier_id: 's3', unit: 'caja', price: 1250, cost: 935, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'l18', name: 'Bobina industrial 300m x 2', sku: 'PAP-005', category: 'Papelería e higiene', supplier_id: 's3', unit: 'pack', price: 780, cost: 585, stock: 55, min_stock: 14, iva_rate: 22, imagen_url: null },

    // Jabones — Conaprole institucional
    { id: 'l19', name: 'Jabón líquido manos 5L', sku: 'JAB-001', category: 'Jabones', supplier_id: 's4', unit: 'bidón', price: 520, cost: 390, stock: 85, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'l20', name: 'Jabón tocador x 72 unidades', sku: 'JAB-002', category: 'Jabones', supplier_id: 's4', unit: 'caja', price: 1450, cost: 1090, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'l21', name: 'Jabón en pan blanco x 48', sku: 'JAB-003', category: 'Jabones', supplier_id: 's4', unit: 'caja', price: 980, cost: 735, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'l22', name: 'Shampoo institucional 5L', sku: 'JAB-004', category: 'Jabones', supplier_id: 's4', unit: 'bidón', price: 680, cost: 510, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },

    // Importados — Higiene Total
    { id: 'l23', name: 'Guantes látex M x 100 x 10 cajas', sku: 'IMP-001', category: 'Importados', supplier_id: 's5', unit: 'pack', price: 2800, cost: 2100, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'l24', name: 'Barbijo triple capa x 2000', sku: 'IMP-002', category: 'Importados', supplier_id: 's5', unit: 'caja', price: 3200, cost: 2400, stock: 20, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'l25', name: 'Dispensador jabón acero x 6', sku: 'IMP-003', category: 'Importados', supplier_id: 's5', unit: 'caja', price: 4500, cost: 3375, stock: 12, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'l26', name: 'Dispensador papel toalla x 6', sku: 'IMP-004', category: 'Importados', supplier_id: 's5', unit: 'caja', price: 5200, cost: 3900, stock: 8, min_stock: 2, iva_rate: 22, imagen_url: null },
    { id: 'l27', name: 'Aromatizador automático x 12', sku: 'IMP-005', category: 'Importados', supplier_id: 's5', unit: 'caja', price: 3800, cost: 2850, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },

    // Bolsas y descartables — Bolsas del Uruguay
    { id: 'l28', name: 'Bolsa residuo 60L x 1000', sku: 'BOL-001', category: 'Bolsas y descartables', supplier_id: 's6', unit: 'fardo', price: 1450, cost: 1090, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'l29', name: 'Bolsa residuo 100L x 500', sku: 'BOL-002', category: 'Bolsas y descartables', supplier_id: 's6', unit: 'fardo', price: 1680, cost: 1260, stock: 45, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'l30', name: 'Bolsa consorcio 200L x 100', sku: 'BOL-003', category: 'Bolsas y descartables', supplier_id: 's6', unit: 'fardo', price: 890, cost: 665, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'l31', name: 'Film stretch 50cm x 4 rollos', sku: 'BOL-004', category: 'Bolsas y descartables', supplier_id: 's6', unit: 'pack', price: 1200, cost: 900, stock: 20, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'l32', name: 'Vaso descartable 180ml x 2500', sku: 'BOL-005', category: 'Bolsas y descartables', supplier_id: 's6', unit: 'caja', price: 950, cost: 710, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },

    // Profesional — Proclin
    { id: 'l33', name: 'Mopa algodón 60cm x 6', sku: 'PRO-001', category: 'Profesional', supplier_id: 's7', unit: 'pack', price: 2400, cost: 1800, stock: 18, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'l34', name: 'Escurridor profesional 24L', sku: 'PRO-002', category: 'Profesional', supplier_id: 's7', unit: 'un', price: 3500, cost: 2625, stock: 10, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'l35', name: 'Esponja industrial x 10 x 20', sku: 'PRO-003', category: 'Profesional', supplier_id: 's7', unit: 'caja', price: 1800, cost: 1350, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'l36', name: 'Paño multiuso rollo x 300', sku: 'PRO-004', category: 'Profesional', supplier_id: 's7', unit: 'rollo', price: 680, cost: 510, stock: 50, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'l37', name: 'Escoba cerda dura x 12', sku: 'PRO-005', category: 'Profesional', supplier_id: 's7', unit: 'pack', price: 1950, cost: 1460, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'l38', name: 'Balde plástico 12L x 12', sku: 'PRO-006', category: 'Profesional', supplier_id: 's7', unit: 'pack', price: 1350, cost: 1010, stock: 22, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'l39', name: 'Franela amarilla x 12 x 10', sku: 'PRO-007', category: 'Profesional', supplier_id: 's7', unit: 'caja', price: 2100, cost: 1575, stock: 28, min_stock: 7, iva_rate: 22, imagen_url: null },
    { id: 'l40', name: 'Carro de limpieza completo', sku: 'PRO-008', category: 'Profesional', supplier_id: 's7', unit: 'un', price: 12500, cost: 9375, stock: 5, min_stock: 2, iva_rate: 22, imagen_url: null },
  ],

  clients: [
    // Institucional
    { id: 'c1', name: 'Hospital de Clínicas', phone: '099789001', address: 'Av. Italia 2870, Parque Batlle', zone: 'Parque Batlle', lista_id: 'mayorista', portal_activo: true, credit_limit: 500000, balance: 185000 },
    { id: 'c2', name: 'Colegio y Liceo Elbio Fernández', phone: '099789002', address: '18 de Julio 1420, Centro', zone: 'Centro', lista_id: 'general', portal_activo: true, credit_limit: 80000, balance: 22000 },
    { id: 'c3', name: 'Shopping Punta Carretas (Mantenimiento)', phone: '099789003', address: 'José Ellauri 350, Punta Carretas', zone: 'Punta Carretas', lista_id: 'premium', portal_activo: true, credit_limit: 300000, balance: 95000 },
    { id: 'c4', name: 'Edificios Campiglia (Administración)', phone: '099789004', address: 'Bvar. España 2930, Pocitos', zone: 'Pocitos', lista_id: 'mayorista', portal_activo: true, credit_limit: 200000, balance: 48000 },
    // Empresas de limpieza
    { id: 'c5', name: 'Limpiezas Brillamax', phone: '099789005', address: 'Gral. Flores 2680, Reducto', zone: 'Reducto', lista_id: 'mayorista', portal_activo: true, credit_limit: 250000, balance: 72000 },
    { id: 'c6', name: 'Multiservice Limpio Ya', phone: '099789006', address: 'Camino Maldonado 4120, Unión', zone: 'Unión', lista_id: 'mayorista', portal_activo: true, credit_limit: 180000, balance: 55000 },
    { id: 'c7', name: 'CleanPro Servicios', phone: '099789007', address: 'Miguelete 1520, Prado', zone: 'Prado', lista_id: 'mayorista', portal_activo: true, credit_limit: 150000, balance: 38000 },
    // Hoteles y restaurantes
    { id: 'c8', name: 'Sheraton Montevideo', phone: '099789008', address: 'Víctor Soliño 349, Punta Carretas', zone: 'Punta Carretas', lista_id: 'premium', portal_activo: true, credit_limit: 400000, balance: 120000 },
    { id: 'c9', name: 'Radisson Victoria Plaza', phone: '099789009', address: 'Plaza Independencia 759, Centro', zone: 'Centro', lista_id: 'premium', portal_activo: true, credit_limit: 350000, balance: 88000 },
    { id: 'c10', name: 'Mercado del Puerto (Mantenimiento)', phone: '099789010', address: 'Rambla 25 de Agosto, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 60000, balance: 15000 },
    // Almacenes y autoservicios
    { id: 'c11', name: 'Autoservicio El Clon', phone: '099789011', address: 'Av. Millán 2980, La Teja', zone: 'La Teja', lista_id: 'general', portal_activo: true, credit_limit: 45000, balance: 8500 },
    { id: 'c12', name: 'Almacén Economía Total', phone: '099789012', address: 'Propios 1250, Cerro', zone: 'Cerro', lista_id: 'general', portal_activo: true, credit_limit: 35000, balance: 12000 },
    { id: 'c13', name: 'Distribuidora Limpieza Centro', phone: '099789013', address: 'Colonia 1480, Centro', zone: 'Centro', lista_id: 'mayorista', portal_activo: true, credit_limit: 120000, balance: 32000 },
    // Oficinas
    { id: 'c14', name: 'WTC Montevideo (Facilities)', phone: '099789014', address: 'Luis A. de Herrera 1248, Buceo', zone: 'Buceo', lista_id: 'premium', portal_activo: true, credit_limit: 250000, balance: 65000 },
    { id: 'c15', name: 'Zonamerica (Mantenimiento)', phone: '099789015', address: 'Ruta 8 Km 17.500', zone: 'Zonamerica', lista_id: 'premium', portal_activo: true, credit_limit: 300000, balance: 110000 },
    // Gimnasios y deportes
    { id: 'c16', name: 'Smart Fit Uruguay (5 sedes)', phone: '099789016', address: 'Av. 18 de Julio 1885, Centro', zone: 'Centro', lista_id: 'mayorista', portal_activo: true, credit_limit: 180000, balance: 42000 },
    { id: 'c17', name: 'Club Nacional de Football', phone: '099789017', address: 'Av. 8 de Octubre 2847, La Blanqueada', zone: 'La Blanqueada', lista_id: 'mayorista', portal_activo: true, credit_limit: 120000, balance: 0 },
    // Residenciales y condominios
    { id: 'c18', name: 'Torres del Puerto (Administración)', phone: '099789018', address: 'Rambla 25 de Agosto, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 80000, balance: 18000 },
    { id: 'c19', name: 'Forum Montevideo (Mantenimiento)', phone: '099789019', address: 'Rambla Rep. del Perú, Parque Rodó', zone: 'Parque Rodó', lista_id: 'general', portal_activo: true, credit_limit: 90000, balance: 25000 },
    { id: 'c20', name: 'Clínica Médica Las Piedras', phone: '099789020', address: 'Av. Artigas 780, Las Piedras', zone: 'Canelones', lista_id: 'general', portal_activo: true, credit_limit: 70000, balance: 19500 },
  ],

  ventas: [
    { id: 'v1', cliente_id: 'c1', date: -1, items: [{ product_id: 'l8', qty: 20, price: 420 }, { product_id: 'l10', qty: 10, price: 750 }, { product_id: 'l14', qty: 15, price: 1650 }, { product_id: 'l23', qty: 5, price: 2800 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v2', cliente_id: 'c5', date: -1, items: [{ product_id: 'l8', qty: 30, price: 420 }, { product_id: 'l9', qty: 15, price: 680 }, { product_id: 'l28', qty: 10, price: 1450 }, { product_id: 'l33', qty: 3, price: 2400 }, { product_id: 'l36', qty: 8, price: 680 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v3', cliente_id: 'c8', date: -1, items: [{ product_id: 'l14', qty: 20, price: 1650 }, { product_id: 'l15', qty: 15, price: 890 }, { product_id: 'l19', qty: 10, price: 520 }, { product_id: 'l27', qty: 4, price: 3800 }], estado: 'en_ruta', pago: 'transferencia' },
    { id: 'v4', cliente_id: 'c3', date: -2, items: [{ product_id: 'l11', qty: 5, price: 1800 }, { product_id: 'l14', qty: 10, price: 1650 }, { product_id: 'l28', qty: 8, price: 1450 }, { product_id: 'l25', qty: 2, price: 4500 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v5', cliente_id: 'c6', date: -2, items: [{ product_id: 'l1', qty: 15, price: 580 }, { product_id: 'l9', qty: 10, price: 680 }, { product_id: 'l36', qty: 6, price: 680 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v6', cliente_id: 'c14', date: -2, items: [{ product_id: 'l14', qty: 12, price: 1650 }, { product_id: 'l15', qty: 10, price: 890 }, { product_id: 'l19', qty: 8, price: 520 }, { product_id: 'l28', qty: 5, price: 1450 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v7', cliente_id: 'c16', date: -3, items: [{ product_id: 'l10', qty: 20, price: 750 }, { product_id: 'l14', qty: 8, price: 1650 }, { product_id: 'l19', qty: 15, price: 520 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v8', cliente_id: 'c11', date: -3, items: [{ product_id: 'l1', qty: 6, price: 580 }, { product_id: 'l2', qty: 4, price: 1250 }, { product_id: 'l7', qty: 3, price: 890 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v9', cliente_id: 'c15', date: 0, items: [{ product_id: 'l8', qty: 15, price: 420 }, { product_id: 'l11', qty: 3, price: 1800 }, { product_id: 'l14', qty: 25, price: 1650 }, { product_id: 'l15', qty: 20, price: 890 }, { product_id: 'l28', qty: 12, price: 1450 }], estado: 'preparada', pago: 'transferencia' },
    { id: 'v10', cliente_id: 'c9', date: 0, items: [{ product_id: 'l14', qty: 15, price: 1650 }, { product_id: 'l19', qty: 10, price: 520 }, { product_id: 'l27', qty: 3, price: 3800 }], estado: 'confirmada', pago: 'transferencia' },
    { id: 'v11', cliente_id: 'c7', date: 0, items: [{ product_id: 'l8', qty: 10, price: 420 }, { product_id: 'l9', qty: 8, price: 680 }, { product_id: 'l33', qty: 2, price: 2400 }, { product_id: 'l28', qty: 6, price: 1450 }], estado: 'pendiente', pago: 'cuenta_corriente' },
    { id: 'v12', cliente_id: 'c12', date: -4, items: [{ product_id: 'l1', qty: 4, price: 580 }, { product_id: 'l28', qty: 3, price: 1450 }, { product_id: 'l32', qty: 2, price: 950 }], estado: 'entregada', pago: 'efectivo' },
  ],

  rutas: [
    {
      id: 'r1', name: 'Ruta Centro-Punta Carretas', driver: 'Roberto Acosta', stops: ['c2', 'c9', 'c13', 'c3', 'c8'],
    },
    {
      id: 'r2', name: 'Ruta Oeste-Cerro', driver: 'Nelson Cabrera', stops: ['c5', 'c12', 'c7', 'c11', 'c6'],
    },
    {
      id: 'r3', name: 'Ruta Este-Buceo', driver: 'Roberto Acosta', stops: ['c14', 'c4', 'c16', 'c15'],
    },
  ],

  deposit_zones: [
    { id: 'z1', name: 'Químicos y líquidos', temp: 'Ambiente ventilado', products: ['l1','l2','l3','l5','l6','l7','l8','l9','l10','l11','l12','l13'] },
    { id: 'z2', name: 'Papelería', temp: 'Ambiente seco', products: ['l14','l15','l16','l17','l18'] },
    { id: 'z3', name: 'Jabones y higiene personal', temp: 'Ambiente', products: ['l4','l19','l20','l21','l22','l23','l24','l25','l26','l27'] },
    { id: 'z4', name: 'Bolsas y descartables', temp: 'Ambiente', products: ['l28','l29','l30','l31','l32'] },
    { id: 'z5', name: 'Equipamiento profesional', temp: 'Ambiente', products: ['l33','l34','l35','l36','l37','l38','l39','l40'] },
  ],
};