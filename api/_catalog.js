// api/_catalog.js — resolución del catálogo del cliente (núcleo compartido)
// ============================================================================
// Quién lo usa:
//   - api/catalogo.js  → endpoint público del portal (agrega recomendaciones + HTTP)
//   - api/_wa-bot.js   → bot de WhatsApp (necesita el MISMO catálogo/precios)
//
// Por qué existe:
//   El precio que ve un cliente depende de su lista (precio fijo por producto >
//   descuento por categoría > descuento global) y de overrides cliente-producto.
//   Esa matemática tiene que ser IDÉNTICA en el portal y en el bot — si divergen,
//   el cliente vería un precio en la web y otro por WhatsApp. Extraído acá para
//   tener una sola fuente de verdad.
// ============================================================================

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Normaliza la unidad para mostrar: saca el "/" y el "." del importador legado
// ("/kg." → "kg"), trimea y cae a 'un' si queda vacía.
export function normalizeUnit(unit) {
  const clean = String(unit || '').replace(/^[/\s]+/, '').replace(/[.\s]+$/, '').trim();
  return clean || 'un';
}

// Escalas de descuento por volumen: [{ min, dto }]. Saneamos para no confiar en la
// forma cruda de la DB; siempre array ordenado por cantidad mínima.
export function sanitizeVolumeTiers(raw) {
  let arr = raw;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(t => ({ min: Math.floor(Number(t?.min)), dto: Number(t?.dto) }))
    .filter(t => Number.isFinite(t.min) && t.min > 1 && Number.isFinite(t.dto) && t.dto > 0 && t.dto <= 100)
    .sort((a, b) => a.min - b.min);
}

/**
 * Devuelve el catálogo de una org con los precios resueltos para un cliente.
 * Sin clienteId → catálogo público (precio_venta base).
 *
 * @returns {{ items, categorias, hasLista, descGlobal, horarioDesde, horarioHasta,
 *             portalActivo, portalCfg }}
 *   items: [{ id, nombre, unidad, categoria, marca, precio, precioBase, stock,
 *             available_stock, reserved_stock, iva_rate, imagen_url, min_order_qty,
 *             descripcion, volume_tiers }]
 */
export async function getCatalogoCliente({ org, clienteId = '' }) {
  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    Accept: 'application/json',
  };

  // ── 1. Productos + reservas activas (ATP) + overrides del cliente ──────────
  const prodQuery = [
    'select=uuid,name,unit,category,brand,precio_venta,stock,min_stock,imagen_url,descripcion,iva_rate,min_order_qty,volume_tiers',
    `org_id=eq.${org}`,
    'order=category.asc,name.asc',
    'limit=500',
  ].join('&');

  const now = new Date().toISOString();
  const resQuery = [
    'select=product_id,quantity',
    `org_id=eq.${org}`,
    'status=eq.active',
    `expires_at=gte.${now}`,
  ].join('&');

  const ovQuery = clienteId
    ? `select=producto_uuid,descuento_pct,precio_override&org_id=eq.${org}&cliente_id=eq.${clienteId}`
    : null;

  const promises = [
    fetch(`${SB_URL}/rest/v1/products?${prodQuery}`, { headers }),
    fetch(`${SB_URL}/rest/v1/stock_reservations?${resQuery}`, { headers }),
  ];
  if (ovQuery) promises.push(fetch(`${SB_URL}/rest/v1/client_product_overrides?${ovQuery}`, { headers }));

  const [prodRes, resRes, ovRes] = await Promise.all(promises);
  if (!prodRes.ok) throw new Error('products fetch failed: ' + prodRes.status);
  const products = await prodRes.json();

  const reservedMap = {};
  if (resRes.ok) {
    for (const r of (await resRes.json()) || []) {
      reservedMap[r.product_id] = (reservedMap[r.product_id] || 0) + Number(r.quantity);
    }
  }

  const overrideMap = {};
  if (ovRes && ovRes.ok) {
    for (const o of (await ovRes.json()) || []) {
      overrideMap[o.producto_uuid] = {
        descuento_pct: o.descuento_pct != null ? Number(o.descuento_pct) : null,
        precio_override: o.precio_override != null ? Number(o.precio_override) : null,
      };
    }
  }

  // ── 2. Lista de precios del cliente ────────────────────────────────────────
  let listaId = null;
  let horarioDesde = null;
  let horarioHasta = null;
  let portalActivo = true;
  let descGlobal = 0;
  let dtosCategoria = {};
  let itemMap = {};

  if (clienteId) {
    const cliRes = await fetch(
      `${SB_URL}/rest/v1/clients?id=eq.${clienteId}&select=id,lista_id,horario_desde,horario_hasta,portal_activo&limit=1`,
      { headers }
    );
    if (cliRes.ok) {
      const cliData = await cliRes.json();
      horarioDesde = cliData?.[0]?.horario_desde || null;
      horarioHasta = cliData?.[0]?.horario_hasta || null;
      portalActivo = cliData?.[0]?.portal_activo !== false;
      if (cliData?.[0]?.lista_id) {
        listaId = cliData[0].lista_id;

        const listRes = await fetch(
          `${SB_URL}/rest/v1/price_lists?id=eq.${listaId}&select=id,descuento,descuentos_categoria&limit=1`,
          { headers }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          descGlobal = Number(listData?.[0]?.descuento || 0);
          dtosCategoria = listData?.[0]?.descuentos_categoria || {};
        }

        const itemsRes = await fetch(
          `${SB_URL}/rest/v1/price_list_items?lista_id=eq.${listaId}&select=product_uuid,precio`,
          { headers }
        );
        if (itemsRes.ok) {
          (await itemsRes.json()).forEach(it => {
            if (it.precio > 0) itemMap[it.product_uuid] = Number(it.precio);
          });
        }
      }
    }
  }

  // ── 3. Armar items con el precio resuelto ──────────────────────────────────
  const items = products.map(p => {
    const base = Number(p.precio_venta) || 0;
    let precio = base;

    if (clienteId && listaId) {
      const dtoCat = Number(dtosCategoria[p.category || ''] || 0);
      if (itemMap[p.uuid] !== undefined) {
        precio = itemMap[p.uuid];                                  // 1. precio fijo del producto en la lista
      } else if (dtoCat > 0) {
        precio = Math.round(base * (1 - dtoCat / 100) * 100) / 100; // 2. dto por categoría
      } else if (descGlobal > 0) {
        precio = Math.round(base * (1 - descGlobal / 100) * 100) / 100; // 3. dto global
      } else {
        precio = 0;                                                // 4. sin precio deliberado → "consultar"
      }
    }

    if (clienteId && overrideMap[p.uuid]) {
      const ov = overrideMap[p.uuid];
      if (ov.precio_override != null) precio = ov.precio_override;
      else if (ov.descuento_pct != null) precio = Math.round(precio * (1 - ov.descuento_pct / 100) * 100) / 100;
    }

    const physicalStock = Number(p.stock) || 0;
    const reservedStock = reservedMap[p.uuid] || 0;
    const availableStock = Math.max(0, physicalStock - reservedStock);

    return {
      id: p.uuid,
      nombre: p.name,
      unidad: normalizeUnit(p.unit),
      categoria: p.category || 'General',
      marca: p.brand || '',
      precio,
      precioBase: base,
      stock: physicalStock,
      available_stock: availableStock,
      reserved_stock: reservedStock,
      iva_rate: p.iva_rate != null ? Number(p.iva_rate) : null,
      imagen_url: p.imagen_url || null,
      min_order_qty: p.min_order_qty != null ? Number(p.min_order_qty) : 1,
      descripcion: p.descripcion || '',
      volume_tiers: sanitizeVolumeTiers(p.volume_tiers),
    };
  });

  const categorias = [...new Set(items.map(i => i.categoria))].sort();

  // ── 4. Config del portal (brandcfg) de la org ──────────────────────────────
  let portalCfg = { portalCatalogo: true, portalPedidos: true };
  try {
    const cfgRes = await fetch(
      `${SB_URL}/rest/v1/app_config?key=eq.brandcfg&org_id=eq.${org}&limit=1`,
      { headers }
    );
    if (cfgRes.ok) {
      const cfgData = await cfgRes.json();
      if (cfgData?.[0]?.value) portalCfg = { ...portalCfg, ...cfgData[0].value };
    }
  } catch { /* config load failed — defaults */ }

  return {
    items,
    categorias,
    hasLista: !!listaId,
    descGlobal,
    horarioDesde,
    horarioHasta,
    portalActivo,
    portalCfg,
  };
}
