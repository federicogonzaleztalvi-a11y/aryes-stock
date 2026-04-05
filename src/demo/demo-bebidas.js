// Demo dataset: Bebidas — Bebidas Express S.A.
// Mayorista de bebidas uruguayo, 180 SKUs representados con 40 productos clave

export const demoBebidas = {
  org: {
    name: 'Bebidas Express S.A.',
    rut: '218456780012',
    address: 'Av. Gral. Flores 4890, Sayago, Montevideo',
    phone: '23591200',
    ownerPhone: '59899456789',
    logo: null,
    moneda: 'UYU',
    iva_default: 22,
    horario: 'Lun a Vie 7:30 - 17:00 · Sáb 8:00 - 12:00',
  },

  suppliers: [
    { id: 's1', name: 'FNC (Fábricas Nacionales de Cerveza)', phone: '26009000', email: 'distribuidores@fnc.com.uy', lead_time_days: 2, category: 'Cervezas' },
    { id: 's2', name: 'Coca-Cola FEMSA Uruguay', phone: '26001500', email: 'comercial@coca-cola.com.uy', lead_time_days: 2, category: 'Refrescos' },
    { id: 's3', name: 'Salus (Danone)', phone: '43422000', email: 'pedidos@salus.com.uy', lead_time_days: 3, category: 'Aguas y jugos' },
    { id: 's4', name: 'Bodega Garzón', phone: '44102000', email: 'ventas@bodegagarzon.com', lead_time_days: 5, category: 'Vinos premium' },
    { id: 's5', name: 'Establecimiento Juanicó', phone: '43380238', email: 'comercial@juanico.com', lead_time_days: 4, category: 'Vinos' },
    { id: 's6', name: 'Destilería Achar', phone: '29241800', email: 'ventas@achar.com.uy', lead_time_days: 5, category: 'Espirituosas' },
    { id: 's7', name: 'Importadora Sacra', phone: '26004200', email: 'pedidos@sacra.com.uy', lead_time_days: 7, category: 'Importados' },
  ],

  products: [
    // Cervezas — FNC
    { id: 'b1', name: 'Pilsen 1L retornable x 12', sku: 'CER-001', category: 'Cervezas', supplier_id: 's1', unit: 'cajón', price: 1680, cost: 1260, stock: 150, min_stock: 40, iva_rate: 22, imagen_url: null },
    { id: 'b2', name: 'Pilsen 970ml lata x 6', sku: 'CER-002', category: 'Cervezas', supplier_id: 's1', unit: 'pack', price: 890, cost: 660, stock: 200, min_stock: 50, iva_rate: 22, imagen_url: null },
    { id: 'b3', name: 'Patricia 1L retornable x 12', sku: 'CER-003', category: 'Cervezas', supplier_id: 's1', unit: 'cajón', price: 1750, cost: 1310, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'b4', name: 'Zillertal 1L retornable x 12', sku: 'CER-004', category: 'Cervezas', supplier_id: 's1', unit: 'cajón', price: 1720, cost: 1285, stock: 80, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'b5', name: 'Pilsen 330ml lata x 24', sku: 'CER-005', category: 'Cervezas', supplier_id: 's1', unit: 'pack', price: 2100, cost: 1580, stock: 95, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'b6', name: 'Norteña 1L retornable x 12', sku: 'CER-006', category: 'Cervezas', supplier_id: 's1', unit: 'cajón', price: 1650, cost: 1230, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'b7', name: 'Patricia lata 473ml x 24', sku: 'CER-007', category: 'Cervezas', supplier_id: 's1', unit: 'pack', price: 2400, cost: 1800, stock: 70, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'b8', name: 'Stella Artois 330ml x 24', sku: 'CER-008', category: 'Cervezas', supplier_id: 's1', unit: 'pack', price: 2850, cost: 2140, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },

    // Refrescos — Coca-Cola FEMSA
    { id: 'b9', name: 'Coca-Cola 2.25L x 6', sku: 'REF-001', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 680, cost: 510, stock: 180, min_stock: 50, iva_rate: 22, imagen_url: null },
    { id: 'b10', name: 'Coca-Cola Zero 2.25L x 6', sku: 'REF-002', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 680, cost: 510, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'b11', name: 'Sprite 2.25L x 6', sku: 'REF-003', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 650, cost: 485, stock: 90, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'b12', name: 'Fanta naranja 2.25L x 6', sku: 'REF-004', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 650, cost: 485, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'b13', name: 'Coca-Cola 350ml lata x 24', sku: 'REF-005', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 1450, cost: 1090, stock: 85, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'b14', name: 'Powerade 500ml x 12', sku: 'REF-006', category: 'Refrescos', supplier_id: 's2', unit: 'pack', price: 720, cost: 540, stock: 45, min_stock: 12, iva_rate: 22, imagen_url: null },

    // Aguas y jugos — Salus
    { id: 'b15', name: 'Salus 2.25L sin gas x 6', sku: 'AGU-001', category: 'Aguas y jugos', supplier_id: 's3', unit: 'pack', price: 420, cost: 310, stock: 200, min_stock: 60, iva_rate: 22, imagen_url: null },
    { id: 'b16', name: 'Salus 2.25L con gas x 6', sku: 'AGU-002', category: 'Aguas y jugos', supplier_id: 's3', unit: 'pack', price: 420, cost: 310, stock: 150, min_stock: 40, iva_rate: 22, imagen_url: null },
    { id: 'b17', name: 'Salus Frutté 1.5L x 6', sku: 'AGU-003', category: 'Aguas y jugos', supplier_id: 's3', unit: 'pack', price: 480, cost: 355, stock: 70, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'b18', name: 'Jugo Cepita 1L x 12', sku: 'AGU-004', category: 'Aguas y jugos', supplier_id: 's3', unit: 'pack', price: 890, cost: 665, stock: 55, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'b19', name: 'Salus 500ml sin gas x 24', sku: 'AGU-005', category: 'Aguas y jugos', supplier_id: 's3', unit: 'pack', price: 780, cost: 580, stock: 110, min_stock: 30, iva_rate: 22, imagen_url: null },

    // Vinos premium — Bodega Garzón
    { id: 'b20', name: 'Garzón Reserva Tannat x 6', sku: 'VIN-001', category: 'Vinos premium', supplier_id: 's4', unit: 'caja', price: 5400, cost: 4050, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'b21', name: 'Garzón Single Vineyard Albariño x 6', sku: 'VIN-002', category: 'Vinos premium', supplier_id: 's4', unit: 'caja', price: 6200, cost: 4650, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'b22', name: 'Garzón Petit Clos x 6', sku: 'VIN-003', category: 'Vinos premium', supplier_id: 's4', unit: 'caja', price: 3600, cost: 2700, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Vinos — Juanicó
    { id: 'b23', name: 'Don Pascual Reserva Tannat x 6', sku: 'VIN-004', category: 'Vinos', supplier_id: 's5', unit: 'caja', price: 2400, cost: 1800, stock: 45, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'b24', name: 'Don Pascual Bivarietal x 6', sku: 'VIN-005', category: 'Vinos', supplier_id: 's5', unit: 'caja', price: 1800, cost: 1340, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'b25', name: 'Familia Deicas Atlántico Sur x 6', sku: 'VIN-006', category: 'Vinos', supplier_id: 's5', unit: 'caja', price: 4800, cost: 3600, stock: 12, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'b26', name: 'Pueblo del Sol Rosé x 6', sku: 'VIN-007', category: 'Vinos', supplier_id: 's5', unit: 'caja', price: 1200, cost: 890, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Espirituosas — Destilería Achar
    { id: 'b27', name: 'Espinillar Grappa x 12', sku: 'ESP-001', category: 'Espirituosas', supplier_id: 's6', unit: 'caja', price: 3600, cost: 2700, stock: 20, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'b28', name: 'Caña Maní Achar x 12', sku: 'ESP-002', category: 'Espirituosas', supplier_id: 's6', unit: 'caja', price: 2400, cost: 1800, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'b29', name: 'Medio y Medio x 12', sku: 'ESP-003', category: 'Espirituosas', supplier_id: 's6', unit: 'caja', price: 2100, cost: 1570, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Importados — Importadora Sacra
    { id: 'b30', name: 'Heineken 330ml x 24', sku: 'IMP-001', category: 'Importados', supplier_id: 's7', unit: 'pack', price: 3200, cost: 2400, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'b31', name: 'Corona 355ml x 24', sku: 'IMP-002', category: 'Importados', supplier_id: 's7', unit: 'pack', price: 3400, cost: 2550, stock: 28, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'b32', name: 'Red Bull 250ml x 24', sku: 'IMP-003', category: 'Importados', supplier_id: 's7', unit: 'pack', price: 4200, cost: 3150, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'b33', name: 'Johnnie Walker Red Label 750ml x 6', sku: 'IMP-004', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 7800, cost: 5850, stock: 12, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'b34', name: 'Absolut Vodka 750ml x 6', sku: 'IMP-005', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 6600, cost: 4950, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'b35', name: 'Havana Club 3 Años 750ml x 6', sku: 'IMP-006', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 5400, cost: 4050, stock: 18, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'b36', name: 'Campari 750ml x 6', sku: 'IMP-007', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 4800, cost: 3600, stock: 10, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'b37', name: 'Fernet Branca 750ml x 6', sku: 'IMP-008', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 5100, cost: 3820, stock: 22, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'b38', name: 'Chandon Brut 750ml x 6', sku: 'IMP-009', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 5800, cost: 4350, stock: 8, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'b39', name: 'Aperol 750ml x 6', sku: 'IMP-010', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 5200, cost: 3900, stock: 14, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'b40', name: 'Jack Daniels 750ml x 6', sku: 'IMP-011', category: 'Importados', supplier_id: 's7', unit: 'caja', price: 8400, cost: 6300, stock: 8, min_stock: 2, iva_rate: 22, imagen_url: null },
  ],

  clients: [
    // Almacenes y autoservicios
    { id: 'c1', name: 'Autoservicio El Gaucho', phone: '099456001', address: 'Av. Millán 3280, Paso Molino', zone: 'Paso Molino', lista_id: 'general', portal_activo: true, credit_limit: 120000, balance: 28000 },
    { id: 'c2', name: 'Almacén Don José', phone: '099456002', address: 'Camino Maldonado 5890, Malvín Norte', zone: 'Malvín Norte', lista_id: 'general', portal_activo: true, credit_limit: 60000, balance: 15200 },
    { id: 'c3', name: 'Super 25 (Sucursal Centro)', phone: '099456003', address: '25 de Mayo 580, Centro', zone: 'Centro', lista_id: 'mayorista', portal_activo: true, credit_limit: 250000, balance: 82000 },
    { id: 'c4', name: 'Maxiconsumo Sayago', phone: '099456004', address: 'Av. Sayago 1420, Sayago', zone: 'Sayago', lista_id: 'mayorista', portal_activo: true, credit_limit: 350000, balance: 145000 },
    // Bares y restaurantes
    { id: 'c5', name: 'Bar Fun Fun', phone: '099456005', address: 'Soriano 922, Centro', zone: 'Centro', lista_id: 'general', portal_activo: true, credit_limit: 45000, balance: 8500 },
    { id: 'c6', name: 'Philomène Café', phone: '099456006', address: 'Chaná 2103, Cordón', zone: 'Cordón', lista_id: 'general', portal_activo: true, credit_limit: 35000, balance: 0 },
    { id: 'c7', name: 'El Lobizón del Plata', phone: '099456007', address: 'Rambla 25 de Agosto 356, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'premium', portal_activo: true, credit_limit: 80000, balance: 22000 },
    { id: 'c8', name: 'La Ronda - Bar de tapas', phone: '099456008', address: 'Ciudadela 1182, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 50000, balance: 12800 },
    // Hoteles
    { id: 'c9', name: 'Hyatt Centric Montevideo', phone: '099456009', address: 'Rambla Rep. del Perú 1473, Parque Rodó', zone: 'Parque Rodó', lista_id: 'premium', portal_activo: true, credit_limit: 400000, balance: 95000 },
    { id: 'c10', name: 'Sofitel Montevideo Casino', phone: '099456010', address: 'Rambla Rep. de México, Carrasco', zone: 'Carrasco', lista_id: 'premium', portal_activo: true, credit_limit: 500000, balance: 180000 },
    // Kioscos y distribuidores menores
    { id: 'c11', name: 'Kiosco La Esquina (Unión)', phone: '099456011', address: 'Av. 8 de Octubre 4120, La Unión', zone: 'La Unión', lista_id: 'general', portal_activo: true, credit_limit: 25000, balance: 4200 },
    { id: 'c12', name: 'Kiosco 24hs Pocitos', phone: '099456012', address: 'Bvar. España 2780, Pocitos', zone: 'Pocitos', lista_id: 'general', portal_activo: true, credit_limit: 30000, balance: 7800 },
    { id: 'c13', name: 'Distribuidora Norte', phone: '099456013', address: 'Cno. Castro 2450, Peñarol', zone: 'Peñarol', lista_id: 'mayorista', portal_activo: true, credit_limit: 200000, balance: 65000 },
    { id: 'c14', name: 'Estación de Servicio ANCAP Ruta 1', phone: '099456014', address: 'Ruta 1 Km 18, Santiago Vázquez', zone: 'Oeste', lista_id: 'general', portal_activo: true, credit_limit: 80000, balance: 18500 },
    // Eventos y catering
    { id: 'c15', name: 'Catering Gourmet MVD', phone: '099456015', address: 'Luis de la Torre 468, Punta Carretas', zone: 'Punta Carretas', lista_id: 'general', portal_activo: true, credit_limit: 100000, balance: 32000 },
    { id: 'c16', name: 'Club Atlético Peñarol (Cantina)', phone: '099456016', address: 'Av. César Mayo Gutiérrez, Peñarol', zone: 'Peñarol', lista_id: 'mayorista', portal_activo: true, credit_limit: 150000, balance: 0 },
    { id: 'c17', name: 'Supermercado La Cadena', phone: '099456017', address: 'Av. Italia 5765, Malvín', zone: 'Malvín', lista_id: 'mayorista', portal_activo: true, credit_limit: 300000, balance: 110000 },
    { id: 'c18', name: 'Vinoteca Del Puerto', phone: '099456018', address: 'Pérez Castellanos 1550, Mercado del Puerto', zone: 'Ciudad Vieja', lista_id: 'premium', portal_activo: true, credit_limit: 120000, balance: 42000 },
    { id: 'c19', name: 'Disco Center (proveedor local)', phone: '099456019', address: 'Bvar. Artigas 1825, Tres Cruces', zone: 'Tres Cruces', lista_id: 'mayorista', portal_activo: false, credit_limit: 500000, balance: 220000 },
    { id: 'c20', name: 'Almacén El Trébol', phone: '099456020', address: 'Grecia 3480, Buceo', zone: 'Buceo', lista_id: 'general', portal_activo: true, credit_limit: 40000, balance: 6500 },
  ],

  ventas: [
    { id: 'v1', cliente_id: 'c1', date: -1, items: [{ product_id: 'b1', qty: 10, price: 1680 }, { product_id: 'b9', qty: 8, price: 680 }, { product_id: 'b15', qty: 6, price: 420 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v2', cliente_id: 'c4', date: -1, items: [{ product_id: 'b1', qty: 30, price: 1680 }, { product_id: 'b3', qty: 20, price: 1750 }, { product_id: 'b9', qty: 20, price: 680 }, { product_id: 'b10', qty: 15, price: 680 }, { product_id: 'b15', qty: 20, price: 420 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v3', cliente_id: 'c9', date: -1, items: [{ product_id: 'b8', qty: 5, price: 2850 }, { product_id: 'b20', qty: 3, price: 5400 }, { product_id: 'b33', qty: 2, price: 7800 }, { product_id: 'b34', qty: 2, price: 6600 }, { product_id: 'b38', qty: 2, price: 5800 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v4', cliente_id: 'c5', date: -2, items: [{ product_id: 'b1', qty: 5, price: 1680 }, { product_id: 'b37', qty: 1, price: 5100 }, { product_id: 'b29', qty: 2, price: 2100 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v5', cliente_id: 'c7', date: -2, items: [{ product_id: 'b20', qty: 2, price: 5400 }, { product_id: 'b23', qty: 3, price: 2400 }, { product_id: 'b36', qty: 1, price: 4800 }, { product_id: 'b39', qty: 1, price: 5200 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v6', cliente_id: 'c10', date: -2, items: [{ product_id: 'b21', qty: 4, price: 6200 }, { product_id: 'b25', qty: 3, price: 4800 }, { product_id: 'b33', qty: 3, price: 7800 }, { product_id: 'b40', qty: 2, price: 8400 }, { product_id: 'b38', qty: 3, price: 5800 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v7', cliente_id: 'c13', date: -3, items: [{ product_id: 'b1', qty: 40, price: 1680 }, { product_id: 'b5', qty: 15, price: 2100 }, { product_id: 'b9', qty: 25, price: 680 }, { product_id: 'b11', qty: 15, price: 650 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v8', cliente_id: 'c12', date: -3, items: [{ product_id: 'b2', qty: 5, price: 890 }, { product_id: 'b13', qty: 3, price: 1450 }, { product_id: 'b32', qty: 2, price: 4200 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v9', cliente_id: 'c17', date: 0, items: [{ product_id: 'b1', qty: 25, price: 1680 }, { product_id: 'b3', qty: 15, price: 1750 }, { product_id: 'b9', qty: 30, price: 680 }, { product_id: 'b15', qty: 25, price: 420 }, { product_id: 'b23', qty: 8, price: 2400 }], estado: 'preparada', pago: 'transferencia' },
    { id: 'v10', cliente_id: 'c18', date: 0, items: [{ product_id: 'b20', qty: 4, price: 5400 }, { product_id: 'b21', qty: 2, price: 6200 }, { product_id: 'b25', qty: 2, price: 4800 }, { product_id: 'b22', qty: 3, price: 3600 }], estado: 'confirmada', pago: 'cuenta_corriente' },
    { id: 'v11', cliente_id: 'c16', date: 0, items: [{ product_id: 'b1', qty: 50, price: 1680 }, { product_id: 'b5', qty: 20, price: 2100 }, { product_id: 'b9', qty: 40, price: 680 }, { product_id: 'b15', qty: 30, price: 420 }], estado: 'pendiente', pago: 'cuenta_corriente' },
    { id: 'v12', cliente_id: 'c11', date: -4, items: [{ product_id: 'b2', qty: 3, price: 890 }, { product_id: 'b9', qty: 4, price: 680 }, { product_id: 'b15', qty: 3, price: 420 }], estado: 'entregada', pago: 'efectivo' },
  ],

  rutas: [
    {
      id: 'r1', name: 'Ruta Centro-Ciudad Vieja', driver: 'Diego Fernández', stops: ['c3', 'c5', 'c8', 'c7', 'c18'],
    },
    {
      id: 'r2', name: 'Ruta Oeste-Peñarol', driver: 'Andrés Silva', stops: ['c4', 'c13', 'c16', 'c14', 'c1'],
    },
    {
      id: 'r3', name: 'Ruta Este-Costa', driver: 'Diego Fernández', stops: ['c17', 'c9', 'c10', 'c15'],
    },
  ],

  deposit_zones: [
    { id: 'z1', name: 'Cámara fría', temp: '4-6°C', products: ['b1','b2','b3','b4','b5','b6','b7','b8','b30','b31'] },
    { id: 'z2', name: 'Refrescos y aguas', temp: 'Ambiente', products: ['b9','b10','b11','b12','b13','b14','b15','b16','b17','b18','b19','b32'] },
    { id: 'z3', name: 'Vinos', temp: '14-16°C', products: ['b20','b21','b22','b23','b24','b25','b26','b38'] },
    { id: 'z4', name: 'Espirituosas e importados', temp: 'Ambiente', products: ['b27','b28','b29','b33','b34','b35','b36','b37','b39','b40'] },
  ],


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
        id: 'cfe-bebidas-'+i, numero: 'E-'+String(1000+i).padStart(4,'0'),
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
          id: 'cfe-bebidas-h'+m+'-'+j, numero: 'E-'+String(800+m*20+j).padStart(4,'0'),
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
          id: 'cob-bebidas-'+i, cliente_id: v.cliente_id,
          monto: total, metodo: v.pago, fecha: d.toISOString().split('T')[0],
          notas: '', facturas_aplicar: ['cfe-bebidas-'+i],
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
          id: 'cob-bebidas-h'+m+'-'+j, cliente_id: this.clients[j%this.clients.length]?.id||'c1',
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
        id: 'mov-bebidas-'+i, tipo,
        producto_id: p.sku||p.id, producto_nombre: p.name,
        cantidad: isOut ? -(Math.floor(Math.random()*10)+1) : Math.floor(Math.random()*20)+5,
        referencia: tipo==='delivery'?'PO-'+(100+i):tipo==='order_placed'?'V-'+(i+1):'',
        notas: '', fecha: d.toISOString().split('T')[0],
        timestamp: d.toISOString(),
      });
    });
    return movs;
  },
};