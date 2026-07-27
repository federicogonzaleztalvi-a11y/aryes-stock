// Demo dataset: HORECA — Distribuciones Del Sur S.R.L.

// Deterministic random — same numbers every time (no Math.random)
const _seed = {v: 42};
function sRand() { _seed.v = (_seed.v * 16807 + 0) % 2147483647; return (_seed.v & 0x7fffffff) / 2147483647; }
function sRandInt(min, max) { return min + Math.floor(sRand() * (max - min + 1)); }
// Distribuidora gastronómica uruguaya, 250 SKUs, 45 clientes

export const demoHoreca = {
  org: {
    name: 'Distribuciones Del Sur S.R.L.',
    rut: '217890340018',
    address: 'Camino Carrasco 4280, Montevideo',
    phone: '26011234',
    ownerPhone: '59899123456',
    logo: null,
    moneda: 'UYU',
    iva_default: 22,
    horario: 'Lun a Vie 7:00 - 18:00 · Sáb 8:00 - 13:00',
  },

  suppliers: [
    { id: 's1', name: 'Conaprole', phone: '29161100', email: 'ventas@conaprole.com.uy', lead_time_days: 2, category: 'Lácteos' },
    { id: 's2', name: 'Breeders & Packers (BPU)', phone: '29240800', email: 'pedidos@bpu.com.uy', lead_time_days: 3, category: 'Carnes' },
    { id: 's3', name: 'Molino Cañuelas Uruguay', phone: '24008500', email: 'comercial@canuelas.com.uy', lead_time_days: 4, category: 'Harinas y secos' },
    { id: 's4', name: 'Granja Narbona', phone: '45002100', email: 'ventas@narbona.com.uy', lead_time_days: 5, category: 'Aceites y gourmet' },
    { id: 's5', name: 'Frigocerro', phone: '27121500', email: 'comercial@frigocerro.com.uy', lead_time_days: 3, category: 'Embutidos' },
    { id: 's6', name: 'La Abundancia', phone: '29243100', email: 'pedidos@laabundancia.com.uy', lead_time_days: 2, category: 'Fiambres' },
    { id: 's7', name: 'Importadora Del Este', phone: '42251800', email: 'info@importadoradeleste.com.uy', lead_time_days: 7, category: 'Importados' },
  ],

  products: [
    // Lácteos — Conaprole
    { id: 'h1', name: 'Queso Colonia Conaprole x 4kg', sku: 'LAC-001', category: 'Lácteos', supplier_id: 's1', unit: 'kg', price: 420, cost: 310, stock: 85, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'h2', name: 'Queso Dambo Conaprole x 4kg', sku: 'LAC-002', category: 'Lácteos', supplier_id: 's1', unit: 'kg', price: 390, cost: 285, stock: 62, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'h3', name: 'Muzzarella Conaprole x 5kg', sku: 'LAC-003', category: 'Lácteos', supplier_id: 's1', unit: 'kg', price: 350, cost: 260, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'h4', name: 'Crema doble Conaprole x 1L', sku: 'LAC-004', category: 'Lácteos', supplier_id: 's1', unit: 'un', price: 145, cost: 105, stock: 48, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'h5', name: 'Manteca Conaprole x 2kg', sku: 'LAC-005', category: 'Lácteos', supplier_id: 's1', unit: 'un', price: 520, cost: 395, stock: 35, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h6', name: 'Dulce de leche Conaprole x 1kg', sku: 'LAC-006', category: 'Lácteos', supplier_id: 's1', unit: 'un', price: 210, cost: 155, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h7', name: 'Ricotta Conaprole x 1kg', sku: 'LAC-007', category: 'Lácteos', supplier_id: 's1', unit: 'un', price: 175, cost: 128, stock: 28, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'h8', name: 'Yogur natural Conaprole x 5L', sku: 'LAC-008', category: 'Lácteos', supplier_id: 's1', unit: 'un', price: 290, cost: 210, stock: 18, min_stock: 6, iva_rate: 22, imagen_url: null },

    // Carnes — BPU
    { id: 'h9', name: 'Bife angosto sin hueso x kg', sku: 'CAR-001', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 580, cost: 440, stock: 45, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'h10', name: 'Entraña x kg', sku: 'CAR-002', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 520, cost: 390, stock: 30, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h11', name: 'Vacío x kg', sku: 'CAR-003', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 450, cost: 335, stock: 38, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'h12', name: 'Pollo entero x kg', sku: 'CAR-004', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 165, cost: 120, stock: 90, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'h13', name: 'Suprema de pollo x kg', sku: 'CAR-005', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 280, cost: 210, stock: 55, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'h14', name: 'Cerdo bondiola x kg', sku: 'CAR-006', category: 'Carnes', supplier_id: 's2', unit: 'kg', price: 340, cost: 255, stock: 25, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Harinas y secos — Molino Cañuelas
    { id: 'h15', name: 'Harina 000 x 25kg', sku: 'SEC-001', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 680, cost: 490, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h16', name: 'Harina 0000 x 25kg', sku: 'SEC-002', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 720, cost: 530, stock: 35, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h17', name: 'Arroz largo fino x 5kg', sku: 'SEC-003', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 195, cost: 140, stock: 80, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'h18', name: 'Fideos spaghetti x 5kg', sku: 'SEC-004', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 230, cost: 165, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'h19', name: 'Polenta instantánea x 5kg', sku: 'SEC-005', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 210, cost: 150, stock: 25, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'h20', name: 'Azúcar x 25kg', sku: 'SEC-006', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 590, cost: 420, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'h21', name: 'Sal fina x 25kg', sku: 'SEC-007', category: 'Harinas y secos', supplier_id: 's3', unit: 'un', price: 320, cost: 220, stock: 20, min_stock: 5, iva_rate: 22, imagen_url: null },

    // Aceites y gourmet — Granja Narbona
    { id: 'h22', name: 'Aceite oliva extra virgen x 5L', sku: 'ACE-001', category: 'Aceites y gourmet', supplier_id: 's4', unit: 'un', price: 1850, cost: 1380, stock: 18, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'h23', name: 'Aceite girasol x 5L', sku: 'ACE-002', category: 'Aceites y gourmet', supplier_id: 's4', unit: 'un', price: 380, cost: 275, stock: 45, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'h24', name: 'Vinagre balsámico x 1L', sku: 'ACE-003', category: 'Aceites y gourmet', supplier_id: 's4', unit: 'un', price: 420, cost: 310, stock: 22, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'h25', name: 'Aceto balsámico Narbona x 500ml', sku: 'ACE-004', category: 'Aceites y gourmet', supplier_id: 's4', unit: 'un', price: 890, cost: 670, stock: 12, min_stock: 4, iva_rate: 22, imagen_url: null },

    // Embutidos — Frigocerro
    { id: 'h26', name: 'Salchichas tipo Viena x 5kg', sku: 'EMB-001', category: 'Embutidos', supplier_id: 's5', unit: 'un', price: 480, cost: 355, stock: 35, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h27', name: 'Chorizo español x kg', sku: 'EMB-002', category: 'Embutidos', supplier_id: 's5', unit: 'kg', price: 520, cost: 390, stock: 20, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'h28', name: 'Panceta ahumada x kg', sku: 'EMB-003', category: 'Embutidos', supplier_id: 's5', unit: 'kg', price: 490, cost: 365, stock: 18, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'h29', name: 'Bondiola curada x kg', sku: 'EMB-004', category: 'Embutidos', supplier_id: 's5', unit: 'kg', price: 680, cost: 510, stock: 14, min_stock: 4, iva_rate: 22, imagen_url: null },

    // Fiambres — La Abundancia
    { id: 'h30', name: 'Jamón cocido x kg', sku: 'FIA-001', category: 'Fiambres', supplier_id: 's6', unit: 'kg', price: 450, cost: 335, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h31', name: 'Jamón crudo x kg', sku: 'FIA-002', category: 'Fiambres', supplier_id: 's6', unit: 'kg', price: 720, cost: 540, stock: 15, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'h32', name: 'Salame tipo Milán x kg', sku: 'FIA-003', category: 'Fiambres', supplier_id: 's6', unit: 'kg', price: 580, cost: 430, stock: 22, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'h33', name: 'Mortadela x kg', sku: 'FIA-004', category: 'Fiambres', supplier_id: 's6', unit: 'kg', price: 290, cost: 210, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Conservas y importados
    { id: 'h34', name: 'Tomate triturado x 2.5kg', sku: 'CON-001', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 185, cost: 130, stock: 90, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'h35', name: 'Atún en aceite x 1kg', sku: 'CON-002', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 420, cost: 310, stock: 35, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'h36', name: 'Aceitunas negras x 2kg', sku: 'CON-003', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 380, cost: 275, stock: 28, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'h37', name: 'Palmitos x 2.5kg', sku: 'CON-004', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 520, cost: 395, stock: 15, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'h38', name: 'Mostaza Dijon x 1kg', sku: 'CON-005', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 340, cost: 250, stock: 20, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'h39', name: 'Mayonesa x 2.5kg', sku: 'CON-006', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 290, cost: 205, stock: 45, min_stock: 12, iva_rate: 22, imagen_url: null },
    { id: 'h40', name: 'Ketchup x 2.5kg', sku: 'CON-007', category: 'Conservas', supplier_id: 's7', unit: 'un', price: 260, cost: 185, stock: 38, min_stock: 10, iva_rate: 22, imagen_url: null },
  ],

  clients: [
    // Ciudad Vieja / Centro
    { id: 'c1', name: 'Restaurante El Palenque', phone: '099123001', address: 'Bartolomé Mitre 1381, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 80000, balance: 12500 },
    { id: 'c2', name: 'Bar Arocena', phone: '099123002', address: 'Ciudadela 1180, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 45000, balance: 8200 },
    { id: 'c3', name: 'Hotel Palladium - Cocina', phone: '099123003', address: 'Tomás Basáñez 6553, Buceo', zone: 'Buceo', lista_id: 'mayorista', portal_activo: true, credit_limit: 200000, balance: 45000 },
    { id: 'c4', name: 'Pizzería Trouville', phone: '099123004', address: 'José Ellauri 1349, Pocitos', zone: 'Pocitos', lista_id: 'general', portal_activo: true, credit_limit: 60000, balance: 0 },
    { id: 'c5', name: 'Café Misterio', phone: '099123005', address: '21 de Setiembre 2895, Pocitos', zone: 'Pocitos', lista_id: 'general', portal_activo: true, credit_limit: 35000, balance: 5800 },
    { id: 'c6', name: 'La Perdiz Restaurante', phone: '099123006', address: 'Av. Rivera 4398, Malvín', zone: 'Malvín', lista_id: 'general', portal_activo: true, credit_limit: 50000, balance: 15200 },
    { id: 'c7', name: 'Parador La Huella (Punta)', phone: '099123007', address: 'Ruta 10 Km 161, José Ignacio', zone: 'Costa', lista_id: 'premium', portal_activo: true, credit_limit: 300000, balance: 82000 },
    { id: 'c8', name: 'Francis Hotel & Restó', phone: '099123008', address: 'Rambla Rep. de México 6363, Carrasco', zone: 'Carrasco', lista_id: 'premium', portal_activo: true, credit_limit: 150000, balance: 28000 },
    { id: 'c9', name: 'Rotisería Don Pepe', phone: '099123009', address: 'Bvar. España 2482, Parque Rodó', zone: 'Parque Rodó', lista_id: 'general', portal_activo: true, credit_limit: 30000, balance: 4500 },
    { id: 'c10', name: 'Club de Golf del Uruguay', phone: '099123010', address: 'Bvar. Artigas 379, Punta Carretas', zone: 'Punta Carretas', lista_id: 'premium', portal_activo: true, credit_limit: 250000, balance: 0 },

    // Más clientes para completar 20
    { id: 'c11', name: 'Sushi Corner', phone: '099123011', address: 'Av. Brasil 2587, Pocitos', zone: 'Pocitos', lista_id: 'general', portal_activo: true, credit_limit: 40000, balance: 9800 },
    { id: 'c12', name: 'Bodegón El Viejo Ombú', phone: '099123012', address: 'Reconquista 464, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: false, credit_limit: 25000, balance: 18500 },
    { id: 'c13', name: 'Panadería La Unión', phone: '099123013', address: 'Av. 8 de Octubre 3285, La Unión', zone: 'La Unión', lista_id: 'general', portal_activo: true, credit_limit: 45000, balance: 0 },
    { id: 'c14', name: 'Cantina del Puerto', phone: '099123014', address: 'Rambla 25 de Agosto 218, Ciudad Vieja', zone: 'Ciudad Vieja', lista_id: 'general', portal_activo: true, credit_limit: 55000, balance: 7200 },
    { id: 'c15', name: 'Comedor Industrial SACEEM', phone: '099123015', address: 'Ruta 1 Km 24, Santiago Vázquez', zone: 'Oeste', lista_id: 'mayorista', portal_activo: true, credit_limit: 180000, balance: 62000 },
    { id: 'c16', name: 'Almacén Naturista Prado', phone: '099123016', address: 'Bvar. José B. y Ordóñez 4515, Prado', zone: 'Prado', lista_id: 'general', portal_activo: false, credit_limit: 20000, balance: 3200 },
    { id: 'c17', name: 'Burger Lab MVD', phone: '099123017', address: 'Constituyente 1890, Cordón', zone: 'Cordón', lista_id: 'general', portal_activo: true, credit_limit: 35000, balance: 0 },
    { id: 'c18', name: 'Heladería Freddo Punta Carretas', phone: '099123018', address: 'Ellauri 553, Punta Carretas', zone: 'Punta Carretas', lista_id: 'general', portal_activo: true, credit_limit: 60000, balance: 11000 },
    { id: 'c19', name: 'Casino Enjoy - Gastronomía', phone: '099123019', address: 'Rambla Williman, Punta del Este', zone: 'Costa', lista_id: 'premium', portal_activo: true, credit_limit: 400000, balance: 125000 },
    { id: 'c20', name: 'Empanadas Calientes MVD', phone: '099123020', address: 'San José 1208, Centro', zone: 'Centro', lista_id: 'general', portal_activo: true, credit_limit: 25000, balance: 2800 },
  ],

  // Ventas recientes (últimos 7 días) — para dashboard y KPIs
  ventas: [
    { id: 'v1', cliente_id: 'c1', date: -1, items: [{ product_id: 'h3', qty: 10, price: 350 }, { product_id: 'h34', qty: 6, price: 185 }, { product_id: 'h30', qty: 3, price: 450 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v2', cliente_id: 'c3', date: -1, items: [{ product_id: 'h1', qty: 8, price: 420 }, { product_id: 'h9', qty: 5, price: 580 }, { product_id: 'h22', qty: 2, price: 1850 }, { product_id: 'h5', qty: 4, price: 520 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v3', cliente_id: 'c7', date: -1, items: [{ product_id: 'h9', qty: 15, price: 580 }, { product_id: 'h10', qty: 10, price: 520 }, { product_id: 'h22', qty: 4, price: 1850 }, { product_id: 'h25', qty: 6, price: 890 }, { product_id: 'h31', qty: 5, price: 720 }], estado: 'en_ruta', pago: 'cuenta_corriente' },
    { id: 'v4', cliente_id: 'c4', date: -2, items: [{ product_id: 'h3', qty: 15, price: 350 }, { product_id: 'h34', qty: 10, price: 185 }, { product_id: 'h15', qty: 2, price: 680 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v5', cliente_id: 'c11', date: -2, items: [{ product_id: 'h13', qty: 8, price: 280 }, { product_id: 'h17', qty: 3, price: 195 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v6', cliente_id: 'c8', date: -2, items: [{ product_id: 'h1', qty: 5, price: 420 }, { product_id: 'h9', qty: 8, price: 580 }, { product_id: 'h28', qty: 3, price: 490 }, { product_id: 'h24', qty: 4, price: 420 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v7', cliente_id: 'c15', date: -3, items: [{ product_id: 'h12', qty: 30, price: 165 }, { product_id: 'h17', qty: 10, price: 195 }, { product_id: 'h34', qty: 15, price: 185 }, { product_id: 'h39', qty: 8, price: 290 }, { product_id: 'h40', qty: 8, price: 260 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v8', cliente_id: 'c5', date: -3, items: [{ product_id: 'h6', qty: 4, price: 210 }, { product_id: 'h4', qty: 6, price: 145 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v9', cliente_id: 'c19', date: 0, items: [{ product_id: 'h9', qty: 20, price: 580 }, { product_id: 'h11', qty: 15, price: 450 }, { product_id: 'h1', qty: 10, price: 420 }, { product_id: 'h3', qty: 20, price: 350 }, { product_id: 'h22', qty: 6, price: 1850 }], estado: 'preparada', pago: 'transferencia' },
    { id: 'v10', cliente_id: 'c10', date: 0, items: [{ product_id: 'h9', qty: 10, price: 580 }, { product_id: 'h13', qty: 10, price: 280 }, { product_id: 'h1', qty: 6, price: 420 }], estado: 'confirmada', pago: 'cuenta_corriente' },
    { id: 'v11', cliente_id: 'c14', date: 0, items: [{ product_id: 'h3', qty: 8, price: 350 }, { product_id: 'h26', qty: 3, price: 480 }, { product_id: 'h34', qty: 5, price: 185 }], estado: 'pendiente', pago: 'efectivo' },
    { id: 'v12', cliente_id: 'c17', date: -4, items: [{ product_id: 'h11', qty: 5, price: 450 }, { product_id: 'h3', qty: 8, price: 350 }, { product_id: 'h39', qty: 3, price: 290 }], estado: 'entregada', pago: 'efectivo' },
  ],

  // Rutas del día
  rutas: [
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
  ],

  // Deposit zones
  deposit_zones: [
    { id: 'z1', name: 'Cámara fría 1', temp: '2-4°C', products: ['h1','h2','h3','h4','h5','h7','h8','h30','h31','h32','h33'] },
    { id: 'z2', name: 'Cámara fría 2', temp: '0-2°C', products: ['h9','h10','h11','h12','h13','h14','h26','h27','h28','h29'] },
    { id: 'z3', name: 'Secos', temp: 'Ambiente', products: ['h15','h16','h17','h18','h19','h20','h21','h34','h35','h36','h37','h38','h39','h40'] },
    { id: 'z4', name: 'Aceites y gourmet', temp: 'Ambiente', products: ['h22','h23','h24','h25'] },
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
        id: 'cfe-horeca-'+i, numero: 'E-'+String(1000+i).padStart(4,'0'),
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
        const day = 1+Math.floor(sRand()*28);
        const id2 = new Date(md.getFullYear(), md.getMonth(), day);
        const ci = Math.floor(sRand()*this.clients.length);
        const t = 5000+Math.floor(sRand()*45000);
        const iv = Math.round(t*0.22);
        cfes.push({
          id: 'cfe-horeca-h'+m+'-'+j, numero: 'E-'+String(800+m*20+j).padStart(4,'0'),
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
          id: 'cob-horeca-'+i, cliente_id: v.cliente_id,
          monto: total, metodo: v.pago, fecha: d.toISOString().split('T')[0],
          notas: '', facturas_aplicar: ['cfe-horeca-'+i],
          created_at: d.toISOString(),
        });
      }
    });
    // Historical cobros
    for (let m=5; m>=1; m--) {
      const md = new Date(now); md.setMonth(md.getMonth()-m);
      for (let j=0; j<6; j++) {
        const day = 1+Math.floor(sRand()*28);
        const id2 = new Date(md.getFullYear(), md.getMonth(), day);
        cobros.push({
          id: 'cob-horeca-h'+m+'-'+j, cliente_id: this.clients[j%this.clients.length]?.id||'c1',
          monto: 5000+Math.floor(sRand()*30000),
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
      const d = new Date(now); d.setDate(d.getDate()-Math.floor(sRand()*14));
      const tipo = types[i%4];
      const isOut = tipo==='order_placed'||tipo==='manual_out';
      movs.push({
        id: 'mov-horeca-'+i, tipo,
        producto_id: p.sku||p.id, producto_nombre: p.name,
        cantidad: isOut ? -(Math.floor(sRand()*10)+1) : Math.floor(sRand()*20)+5,
        referencia: tipo==='delivery'?'PO-'+(100+i):tipo==='order_placed'?'V-'+(i+1):'',
        notas: '', fecha: d.toISOString().split('T')[0],
        timestamp: d.toISOString(),
      });
    });
    return movs;
  },
};