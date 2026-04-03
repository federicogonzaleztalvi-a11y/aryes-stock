// Demo dataset: Construcción — MatCon Distribuidora S.A.
// Materiales de construcción y ferretería, 420 SKUs representados con 40 productos clave

export const demoConstruccion = {
  org: {
    name: 'MatCon Distribuidora S.A.',
    rut: '219876540019',
    address: 'Ruta 5 Km 16.500, Las Piedras, Canelones',
    phone: '23650800',
    ownerPhone: '59899345678',
    logo: null,
    moneda: 'UYU',
    iva_default: 22,
    horario: 'Lun a Vie 7:00 - 17:00 · Sáb 7:00 - 12:00',
  },

  suppliers: [
    { id: 's1', name: 'ANCAP (Pórtland)', phone: '29021024', email: 'comercial@ancap.com.uy', lead_time_days: 3, category: 'Cemento' },
    { id: 's2', name: 'Gerdau (Laisa)', phone: '24021500', email: 'ventas@gerdau.com.uy', lead_time_days: 4, category: 'Hierro y acero' },
    { id: 's3', name: 'Pinturas Inca', phone: '23545800', email: 'distribuidores@inca.com.uy', lead_time_days: 3, category: 'Pinturas' },
    { id: 's4', name: 'Arenera del Plata', phone: '23688900', email: 'pedidos@areneradelplata.com.uy', lead_time_days: 2, category: 'Áridos' },
    { id: 's5', name: 'Cerámicas del Uruguay', phone: '43222800', email: 'comercial@ceramicasdel.com.uy', lead_time_days: 5, category: 'Cerámicas' },
    { id: 's6', name: 'Stanley / Dewalt (Importador)', phone: '26014200', email: 'pedidos@toolsuy.com', lead_time_days: 7, category: 'Herramientas' },
    { id: 's7', name: 'Sanitarios del Este', phone: '42271500', email: 'ventas@sanitariosdel.com.uy', lead_time_days: 5, category: 'Sanitaria' },
  ],

  products: [
    // Cemento — ANCAP
    { id: 'n1', name: 'Pórtland normal 50kg', sku: 'CEM-001', category: 'Cemento', supplier_id: 's1', unit: 'bolsa', price: 420, cost: 315, stock: 300, min_stock: 80, iva_rate: 22, imagen_url: null },
    { id: 'n2', name: 'Pórtland puzolánico 50kg', sku: 'CEM-002', category: 'Cemento', supplier_id: 's1', unit: 'bolsa', price: 450, cost: 335, stock: 200, min_stock: 50, iva_rate: 22, imagen_url: null },
    { id: 'n3', name: 'Cal hidráulica 25kg', sku: 'CEM-003', category: 'Cemento', supplier_id: 's1', unit: 'bolsa', price: 280, cost: 210, stock: 150, min_stock: 40, iva_rate: 22, imagen_url: null },
    { id: 'n4', name: 'Pegamento cerámico 25kg', sku: 'CEM-004', category: 'Cemento', supplier_id: 's1', unit: 'bolsa', price: 350, cost: 260, stock: 80, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'n5', name: 'Revoque fino 30kg', sku: 'CEM-005', category: 'Cemento', supplier_id: 's1', unit: 'bolsa', price: 320, cost: 240, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'n6', name: 'Hormigón elaborado H25 x m³', sku: 'CEM-006', category: 'Cemento', supplier_id: 's1', unit: 'm³', price: 5200, cost: 3900, stock: 0, min_stock: 0, iva_rate: 22, imagen_url: null },

    // Hierro y acero — Gerdau
    { id: 'n7', name: 'Hierro 6mm barra 12m', sku: 'HIE-001', category: 'Hierro y acero', supplier_id: 's2', unit: 'barra', price: 280, cost: 210, stock: 250, min_stock: 60, iva_rate: 22, imagen_url: null },
    { id: 'n8', name: 'Hierro 8mm barra 12m', sku: 'HIE-002', category: 'Hierro y acero', supplier_id: 's2', unit: 'barra', price: 480, cost: 360, stock: 200, min_stock: 50, iva_rate: 22, imagen_url: null },
    { id: 'n9', name: 'Hierro 10mm barra 12m', sku: 'HIE-003', category: 'Hierro y acero', supplier_id: 's2', unit: 'barra', price: 720, cost: 540, stock: 150, min_stock: 40, iva_rate: 22, imagen_url: null },
    { id: 'n10', name: 'Hierro 12mm barra 12m', sku: 'HIE-004', category: 'Hierro y acero', supplier_id: 's2', unit: 'barra', price: 1050, cost: 790, stock: 100, min_stock: 25, iva_rate: 22, imagen_url: null },
    { id: 'n11', name: 'Malla electrosoldada 15x15 2.40x6m', sku: 'HIE-005', category: 'Hierro y acero', supplier_id: 's2', unit: 'paño', price: 3200, cost: 2400, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'n12', name: 'Alambre negro Nº16 x 25kg', sku: 'HIE-006', category: 'Hierro y acero', supplier_id: 's2', unit: 'rollo', price: 2800, cost: 2100, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Pinturas — Inca
    { id: 'n13', name: 'Látex interior blanco 20L', sku: 'PIN-001', category: 'Pinturas', supplier_id: 's3', unit: 'balde', price: 4200, cost: 3150, stock: 35, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'n14', name: 'Látex exterior blanco 20L', sku: 'PIN-002', category: 'Pinturas', supplier_id: 's3', unit: 'balde', price: 5800, cost: 4350, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'n15', name: 'Esmalte sintético blanco 4L', sku: 'PIN-003', category: 'Pinturas', supplier_id: 's3', unit: 'lata', price: 2100, cost: 1575, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'n16', name: 'Impermeabilizante Inca 20L', sku: 'PIN-004', category: 'Pinturas', supplier_id: 's3', unit: 'balde', price: 6500, cost: 4875, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'n17', name: 'Fijador sellador 20L', sku: 'PIN-005', category: 'Pinturas', supplier_id: 's3', unit: 'balde', price: 3800, cost: 2850, stock: 20, min_stock: 5, iva_rate: 22, imagen_url: null },
    { id: 'n18', name: 'Enduido plástico 25kg', sku: 'PIN-006', category: 'Pinturas', supplier_id: 's3', unit: 'balde', price: 1200, cost: 900, stock: 45, min_stock: 12, iva_rate: 22, imagen_url: null },

    // Áridos — Arenera del Plata
    { id: 'n19', name: 'Arena gruesa x m³', sku: 'ARI-001', category: 'Áridos', supplier_id: 's4', unit: 'm³', price: 850, cost: 635, stock: 50, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'n20', name: 'Arena fina x m³', sku: 'ARI-002', category: 'Áridos', supplier_id: 's4', unit: 'm³', price: 900, cost: 675, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'n21', name: 'Pedregullo x m³', sku: 'ARI-003', category: 'Áridos', supplier_id: 's4', unit: 'm³', price: 1100, cost: 825, stock: 35, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'n22', name: 'Tosca x m³', sku: 'ARI-004', category: 'Áridos', supplier_id: 's4', unit: 'm³', price: 650, cost: 485, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },
    { id: 'n23', name: 'Ladrillo de campo x 1000', sku: 'ARI-005', category: 'Áridos', supplier_id: 's4', unit: 'millar', price: 8500, cost: 6375, stock: 15, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'n24', name: 'Block de hormigón 12x19x39 x 100', sku: 'ARI-006', category: 'Áridos', supplier_id: 's4', unit: 'pallet', price: 4200, cost: 3150, stock: 25, min_stock: 5, iva_rate: 22, imagen_url: null },

    // Cerámicas — Cerámicas del Uruguay
    { id: 'n25', name: 'Piso cerámico 45x45 beige x m²', sku: 'CER-001', category: 'Cerámicas', supplier_id: 's5', unit: 'm²', price: 680, cost: 510, stock: 120, min_stock: 30, iva_rate: 22, imagen_url: null },
    { id: 'n26', name: 'Azulejo blanco 20x30 x m²', sku: 'CER-002', category: 'Cerámicas', supplier_id: 's5', unit: 'm²', price: 520, cost: 390, stock: 90, min_stock: 20, iva_rate: 22, imagen_url: null },
    { id: 'n27', name: 'Porcelanato gris 60x60 x m²', sku: 'CER-003', category: 'Cerámicas', supplier_id: 's5', unit: 'm²', price: 1200, cost: 900, stock: 60, min_stock: 15, iva_rate: 22, imagen_url: null },
    { id: 'n28', name: 'Pastina color gris 5kg', sku: 'CER-004', category: 'Cerámicas', supplier_id: 's5', unit: 'bolsa', price: 320, cost: 240, stock: 50, min_stock: 12, iva_rate: 22, imagen_url: null },

    // Herramientas — Stanley/Dewalt
    { id: 'n29', name: 'Taladro percutor Dewalt 13mm', sku: 'HER-001', category: 'Herramientas', supplier_id: 's6', unit: 'un', price: 8500, cost: 6375, stock: 8, min_stock: 2, iva_rate: 22, imagen_url: null },
    { id: 'n30', name: 'Amoladora angular Dewalt 4.5"', sku: 'HER-002', category: 'Herramientas', supplier_id: 's6', unit: 'un', price: 6200, cost: 4650, stock: 10, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'n31', name: 'Cinta métrica Stanley 8m', sku: 'HER-003', category: 'Herramientas', supplier_id: 's6', unit: 'un', price: 890, cost: 665, stock: 25, min_stock: 6, iva_rate: 22, imagen_url: null },
    { id: 'n32', name: 'Set llaves combinadas Stanley x 12', sku: 'HER-004', category: 'Herramientas', supplier_id: 's6', unit: 'set', price: 3500, cost: 2625, stock: 12, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'n33', name: 'Nivel magnético Stanley 60cm', sku: 'HER-005', category: 'Herramientas', supplier_id: 's6', unit: 'un', price: 1800, cost: 1350, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'n34', name: 'Disco corte metal 4.5" x 25', sku: 'HER-006', category: 'Herramientas', supplier_id: 's6', unit: 'caja', price: 1650, cost: 1240, stock: 30, min_stock: 8, iva_rate: 22, imagen_url: null },

    // Sanitaria — Sanitarios del Este
    { id: 'n35', name: 'Caño PVC 110mm x 4m', sku: 'SAN-001', category: 'Sanitaria', supplier_id: 's7', unit: 'caño', price: 1450, cost: 1090, stock: 40, min_stock: 10, iva_rate: 22, imagen_url: null },
    { id: 'n36', name: 'Caño PVC 50mm x 4m', sku: 'SAN-002', category: 'Sanitaria', supplier_id: 's7', unit: 'caño', price: 680, cost: 510, stock: 55, min_stock: 14, iva_rate: 22, imagen_url: null },
    { id: 'n37', name: 'Inodoro blanco con mochila', sku: 'SAN-003', category: 'Sanitaria', supplier_id: 's7', unit: 'un', price: 5800, cost: 4350, stock: 12, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'n38', name: 'Lavatorio blanco con columna', sku: 'SAN-004', category: 'Sanitaria', supplier_id: 's7', unit: 'un', price: 4200, cost: 3150, stock: 10, min_stock: 3, iva_rate: 22, imagen_url: null },
    { id: 'n39', name: 'Grifería monocomando cocina', sku: 'SAN-005', category: 'Sanitaria', supplier_id: 's7', unit: 'un', price: 3800, cost: 2850, stock: 15, min_stock: 4, iva_rate: 22, imagen_url: null },
    { id: 'n40', name: 'Tanque agua 500L', sku: 'SAN-006', category: 'Sanitaria', supplier_id: 's7', unit: 'un', price: 6500, cost: 4875, stock: 6, min_stock: 2, iva_rate: 22, imagen_url: null },
  ],

  clients: [
    // Empresas constructoras
    { id: 'c1', name: 'Constructora Saceem', phone: '099345001', address: 'Ruta 1 Km 24, Santiago Vázquez', zone: 'Oeste', lista_id: 'mayorista', portal_activo: true, credit_limit: 800000, balance: 320000 },
    { id: 'c2', name: 'Stiler Construcciones', phone: '099345002', address: 'Bvar. Artigas 2580, Tres Cruces', zone: 'Tres Cruces', lista_id: 'mayorista', portal_activo: true, credit_limit: 500000, balance: 185000 },
    { id: 'c3', name: 'Campiglia Construcciones', phone: '099345003', address: 'Av. Italia 6280, Carrasco', zone: 'Carrasco', lista_id: 'premium', portal_activo: true, credit_limit: 1000000, balance: 420000 },
    { id: 'c4', name: 'Ing. Martínez (Obras menores)', phone: '099345004', address: 'Constituyente 1680, Cordón', zone: 'Cordón', lista_id: 'general', portal_activo: true, credit_limit: 150000, balance: 45000 },
    // Ferreterías
    { id: 'c5', name: 'Ferretería El Clavo', phone: '099345005', address: 'Av. Millán 3450, La Teja', zone: 'La Teja', lista_id: 'general', portal_activo: true, credit_limit: 80000, balance: 22000 },
    { id: 'c6', name: 'Ferretería Industrial Norte', phone: '099345006', address: 'Cno. Maldonado 6280, Manga', zone: 'Manga', lista_id: 'mayorista', portal_activo: true, credit_limit: 200000, balance: 65000 },
    { id: 'c7', name: 'Casa Soler (Materiales)', phone: '099345007', address: 'Bvar. Batlle y Ordóñez 3890, La Unión', zone: 'La Unión', lista_id: 'mayorista', portal_activo: true, credit_limit: 250000, balance: 88000 },
    { id: 'c8', name: 'Barraca Éxito', phone: '099345008', address: 'Ruta 8 Km 22, Pando', zone: 'Canelones', lista_id: 'mayorista', portal_activo: true, credit_limit: 300000, balance: 115000 },
    // Arquitectos y proyectos
    { id: 'c9', name: 'Estudio Arq. Viñoly (Montevideo)', phone: '099345009', address: 'Plaza Independencia 848, Centro', zone: 'Centro', lista_id: 'premium', portal_activo: true, credit_limit: 400000, balance: 0 },
    { id: 'c10', name: 'Proyecto Harbour Tower', phone: '099345010', address: 'Rambla Rep. del Perú, Buceo', zone: 'Buceo', lista_id: 'premium', portal_activo: true, credit_limit: 600000, balance: 280000 },
    // Pintores y contratistas
    { id: 'c11', name: 'Pinturas Hernández', phone: '099345011', address: 'Grecia 2480, Buceo', zone: 'Buceo', lista_id: 'general', portal_activo: true, credit_limit: 60000, balance: 18000 },
    { id: 'c12', name: 'Sanitarios López', phone: '099345012', address: 'Rivera 4650, Malvín', zone: 'Malvín', lista_id: 'general', portal_activo: true, credit_limit: 50000, balance: 12500 },
    { id: 'c13', name: 'Electricidad y Obras SRL', phone: '099345013', address: 'Carlos Ma. Ramírez 2180, La Teja', zone: 'La Teja', lista_id: 'general', portal_activo: true, credit_limit: 70000, balance: 25000 },
    // Sector público
    { id: 'c14', name: 'Intendencia de Montevideo (Obras)', phone: '099345014', address: '18 de Julio 1360, Centro', zone: 'Centro', lista_id: 'mayorista', portal_activo: false, credit_limit: 500000, balance: 180000 },
    { id: 'c15', name: 'OSE (Obras Sanitarias)', phone: '099345015', address: 'Carlos Roxlo 1275, Centro', zone: 'Centro', lista_id: 'mayorista', portal_activo: true, credit_limit: 400000, balance: 95000 },
    // Más ferreterías y barracas
    { id: 'c16', name: 'Barraca Central Las Piedras', phone: '099345016', address: 'Av. Artigas 820, Las Piedras', zone: 'Canelones', lista_id: 'mayorista', portal_activo: true, credit_limit: 180000, balance: 52000 },
    { id: 'c17', name: 'Materiales El Constructor', phone: '099345017', address: 'Ruta 5 Km 25, Las Piedras', zone: 'Canelones', lista_id: 'general', portal_activo: true, credit_limit: 120000, balance: 38000 },
    { id: 'c18', name: 'Ferretería Pocitos', phone: '099345018', address: '26 de Marzo 1180, Pocitos', zone: 'Pocitos', lista_id: 'general', portal_activo: true, credit_limit: 90000, balance: 15000 },
    { id: 'c19', name: 'Obra Privada Torres Nuevocentro', phone: '099345019', address: 'Av. Libertador 1680, Aguada', zone: 'Aguada', lista_id: 'premium', portal_activo: true, credit_limit: 350000, balance: 145000 },
    { id: 'c20', name: 'Cooperativa FUCVAM (Malvín)', phone: '099345020', address: 'Santiago de Chile 1280, Malvín Norte', zone: 'Malvín Norte', lista_id: 'general', portal_activo: true, credit_limit: 200000, balance: 78000 },
  ],

  ventas: [
    { id: 'v1', cliente_id: 'c1', date: -1, items: [{ product_id: 'n1', qty: 100, price: 420 }, { product_id: 'n8', qty: 80, price: 480 }, { product_id: 'n9', qty: 40, price: 720 }, { product_id: 'n19', qty: 10, price: 850 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v2', cliente_id: 'c3', date: -1, items: [{ product_id: 'n1', qty: 200, price: 420 }, { product_id: 'n9', qty: 100, price: 720 }, { product_id: 'n10', qty: 60, price: 1050 }, { product_id: 'n11', qty: 20, price: 3200 }, { product_id: 'n19', qty: 20, price: 850 }, { product_id: 'n21', qty: 15, price: 1100 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v3', cliente_id: 'c5', date: -1, items: [{ product_id: 'n1', qty: 30, price: 420 }, { product_id: 'n3', qty: 20, price: 280 }, { product_id: 'n7', qty: 30, price: 280 }, { product_id: 'n18', qty: 10, price: 1200 }], estado: 'en_ruta', pago: 'cuenta_corriente' },
    { id: 'v4', cliente_id: 'c10', date: -2, items: [{ product_id: 'n27', qty: 80, price: 1200 }, { product_id: 'n4', qty: 30, price: 350 }, { product_id: 'n28', qty: 20, price: 320 }, { product_id: 'n37', qty: 8, price: 5800 }, { product_id: 'n38', qty: 8, price: 4200 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v5', cliente_id: 'c7', date: -2, items: [{ product_id: 'n1', qty: 50, price: 420 }, { product_id: 'n13', qty: 5, price: 4200 }, { product_id: 'n15', qty: 10, price: 2100 }], estado: 'entregada', pago: 'cuenta_corriente' },
    { id: 'v6', cliente_id: 'c11', date: -2, items: [{ product_id: 'n13', qty: 8, price: 4200 }, { product_id: 'n14', qty: 5, price: 5800 }, { product_id: 'n17', qty: 3, price: 3800 }, { product_id: 'n18', qty: 6, price: 1200 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v7', cliente_id: 'c2', date: -3, items: [{ product_id: 'n1', qty: 80, price: 420 }, { product_id: 'n8', qty: 60, price: 480 }, { product_id: 'n11', qty: 10, price: 3200 }, { product_id: 'n35', qty: 15, price: 1450 }], estado: 'entregada', pago: 'transferencia' },
    { id: 'v8', cliente_id: 'c18', date: -3, items: [{ product_id: 'n31', qty: 5, price: 890 }, { product_id: 'n34', qty: 3, price: 1650 }, { product_id: 'n15', qty: 4, price: 2100 }], estado: 'entregada', pago: 'efectivo' },
    { id: 'v9', cliente_id: 'c19', date: 0, items: [{ product_id: 'n1', qty: 150, price: 420 }, { product_id: 'n2', qty: 80, price: 450 }, { product_id: 'n9', qty: 60, price: 720 }, { product_id: 'n10', qty: 40, price: 1050 }, { product_id: 'n19', qty: 15, price: 850 }], estado: 'preparada', pago: 'transferencia' },
    { id: 'v10', cliente_id: 'c8', date: 0, items: [{ product_id: 'n1', qty: 40, price: 420 }, { product_id: 'n7', qty: 50, price: 280 }, { product_id: 'n25', qty: 30, price: 680 }, { product_id: 'n4', qty: 15, price: 350 }], estado: 'confirmada', pago: 'cuenta_corriente' },
    { id: 'v11', cliente_id: 'c15', date: 0, items: [{ product_id: 'n35', qty: 30, price: 1450 }, { product_id: 'n36', qty: 40, price: 680 }, { product_id: 'n39', qty: 10, price: 3800 }], estado: 'pendiente', pago: 'transferencia' },
    { id: 'v12', cliente_id: 'c17', date: -4, items: [{ product_id: 'n1', qty: 20, price: 420 }, { product_id: 'n3', qty: 10, price: 280 }, { product_id: 'n25', qty: 15, price: 680 }], estado: 'entregada', pago: 'efectivo' },
  ],

  rutas: [
    {
      id: 'r1', name: 'Ruta Montevideo Centro', driver: 'Washington Núñez', stops: ['c4', 'c11', 'c13', 'c18', 'c5'],
    },
    {
      id: 'r2', name: 'Ruta Canelones', driver: 'Julio Rodríguez', stops: ['c16', 'c17', 'c8'],
    },
    {
      id: 'r3', name: 'Ruta Obras grandes', driver: 'Washington Núñez', stops: ['c1', 'c3', 'c10', 'c19'],
    },
  ],

  deposit_zones: [
    { id: 'z1', name: 'Cemento y áridos', temp: 'Cubierto seco', products: ['n1','n2','n3','n4','n5','n23','n24'] },
    { id: 'z2', name: 'Hierro y acero', temp: 'Cubierto', products: ['n7','n8','n9','n10','n11','n12'] },
    { id: 'z3', name: 'Pinturas y químicos', temp: 'Ambiente ventilado', products: ['n13','n14','n15','n16','n17','n18'] },
    { id: 'z4', name: 'Playa de áridos', temp: 'Intemperie', products: ['n19','n20','n21','n22'] },
    { id: 'z5', name: 'Cerámicas y sanitaria', temp: 'Cubierto', products: ['n25','n26','n27','n28','n35','n36','n37','n38','n39','n40'] },
    { id: 'z6', name: 'Herramientas', temp: 'Ambiente cerrado', products: ['n29','n30','n31','n32','n33','n34'] },
  ],
};