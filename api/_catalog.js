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

// Sanea las reglas de descuento v2 de un price_list_item.
// Forma: [{ condicion:'siempre'|'caja'|'cantidad', dto, min_unidades? }].
// Devuelve SIEMPRE un array (vacío si no hay reglas válidas), así que un producto
// "usa v2" solo si acá sale al menos una regla válida. Datos crudos o inválidos
// se descartan sin romper.
export function sanitizeReglas(raw) {
  let arr = raw;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(r => {
      const condicion = String(r?.condicion || '').trim();
      const dto = Number(r?.dto);
      if (!['siempre', 'caja', 'cantidad'].includes(condicion)) return null;
      if (!Number.isFinite(dto) || dto <= 0 || dto > 100) return null;
      if (condicion === 'cantidad') {
        const min = Math.floor(Number(r?.min_unidades));
        if (!Number.isFinite(min) || min <= 1) return null;
        return { condicion, dto, min_unidades: min };
      }
      return { condicion, dto };
    })
    .filter(Boolean);
}

// A partir de reglas saneadas, deriva los componentes que consume el carrito
// (calcLinea): descuento "siempre" (S), descuento de caja (C) y escalas por
// cantidad (mismo formato que volume_tiers). Se toma el MAYOR de cada tipo.
export function reglasToComponentes(reglas) {
  let siempre = 0;
  let caja = 0;
  const tiers = [];
  for (const r of reglas) {
    if (r.condicion === 'siempre') siempre = Math.max(siempre, r.dto);
    else if (r.condicion === 'caja') caja = Math.max(caja, r.dto);
    else if (r.condicion === 'cantidad') tiers.push({ min: r.min_unidades, dto: r.dto });
  }
  tiers.sort((a, b) => a.min - b.min);
  return { siempre, caja, tiers };
}

// Normaliza el JSONB `variants` del producto. Forma esperada:
//   { label: "Color", options: [{ id, label, sku?, color_hex? }, ...] }
// Las variantes comparten precio/IVA/stock del padre; sólo aportan etiqueta+SKU.
// Devuelve null si no hay opciones válidas (producto simple) para que el portal
// trate el producto como antes.
export function sanitizeVariants(raw) {
  let obj = raw;
  if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { return null; } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const rawOpts = Array.isArray(obj.options) ? obj.options : [];
  const seen = new Set();
  const options = rawOpts
    .map(o => {
      const label = String(o?.label ?? '').trim();
      if (!label) return null;
      const id = String(o?.id ?? label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || label;
      return {
        id,
        label,
        sku: o?.sku != null ? String(o.sku).trim() : '',
        color_hex: /^#[0-9a-fA-F]{6}$/.test(String(o?.color_hex || '')) ? o.color_hex : '',
      };
    })
    .filter(o => o && !seen.has(o.id) && seen.add(o.id));
  if (options.length === 0) return null;
  const label = String(obj.label ?? '').trim() || 'Variante';
  return { label, options };
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
    'select=uuid,name,unit,category,brand,precio_venta,stock,min_stock,imagen_url,descripcion,iva_rate,min_order_qty,volume_tiers,variants,unidades_por_caja,descuento_caja',
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
  let cajaCerrada = false; // ¿la lista del cliente habilita el descuento por caja cerrada?
  let dtosCategoria = {};
  let itemMap = {};      // product_uuid -> precio fijo de la lista
  let itemDtoMap = {};   // product_uuid -> % de descuento del producto en la lista
  let reglasMap = {};    // product_uuid -> reglas v2 saneadas (si las hay, gana v2)

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
          `${SB_URL}/rest/v1/price_lists?id=eq.${listaId}&select=id,descuento,descuentos_categoria,habilitar_caja_cerrada&limit=1`,
          { headers }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          descGlobal = Number(listData?.[0]?.descuento || 0);
          dtosCategoria = listData?.[0]?.descuentos_categoria || {};
          cajaCerrada = listData?.[0]?.habilitar_caja_cerrada === true;
        }

        const itemsRes = await fetch(
          `${SB_URL}/rest/v1/price_list_items?lista_id=eq.${listaId}&select=product_uuid,precio,descuento,reglas`,
          { headers }
        );
        if (itemsRes.ok) {
          (await itemsRes.json()).forEach(it => {
            // v2: si el ítem trae reglas válidas, ese producto usa el motor nuevo.
            const reglas = sanitizeReglas(it.reglas);
            if (reglas.length > 0) reglasMap[it.product_uuid] = reglas;
            // Precio fijo tiene prioridad; si no hay, guardamos el % de descuento
            // del producto. El editor del admin usa esta misma jerarquía (calcFinal).
            if (it.precio > 0) itemMap[it.product_uuid] = Number(it.precio);
            else if (Number(it.descuento) > 0) itemDtoMap[it.product_uuid] = Number(it.descuento);
          });
        }
      }
    }
  }

  // ── 3. Armar items con el precio resuelto ──────────────────────────────────
  const items = products.map(p => {
    const base = Number(p.precio_venta) || 0;
    const reglas = reglasMap[p.uuid];
    const usaReglas = !!(clienteId && listaId && Array.isArray(reglas) && reglas.length > 0);

    // Campos que consume el carrito (calcLinea). Por defecto: valores del camino
    // viejo. Solo el motor v2 (abajo) los reemplaza, y solo para productos con
    // reglas cargadas — por eso lo que hoy no tiene reglas no cambia en nada.
    let precio = base;
    let precioBase = base;
    let descGlobalItem;   // undefined => calcLinea usa item.precio (comportamiento viejo)
    let volTiers = sanitizeVolumeTiers(p.volume_tiers);
    let cajaUnidItem = cajaCerrada ? (Number(p.unidades_por_caja) || 0) : 0;
    let cajaDtoItem  = cajaCerrada ? (Number(p.descuento_caja) || 0) : 0;
    let reglasV2 = false;

    if (usaReglas) {
      // ── Motor v2 (opt-in por producto con reglas) ──────────────────────────
      // El PRECIO BASE va sin descontar; los descuentos van por separado y el
      // carrito (calcLinea) toma el MAYOR que aplica por unidad — nunca suma.
      reglasV2 = true;
      const especial = itemMap[p.uuid];  // precio fijo de la lista (si hay)
      if (especial !== undefined && especial > 0) {
        // Precio especial fijo: ES el precio final, sin ningún descuento encima.
        precioBase = especial; precio = especial;
        descGlobalItem = 0; volTiers = []; cajaUnidItem = 0; cajaDtoItem = 0;
      } else {
        const { siempre, caja, tiers } = reglasToComponentes(reglas);
        // PISO de compatibilidad: un producto con reglas v2 nunca puede quedar
        // peor que con el modelo viejo. El descuento "siempre" efectivo es el
        // MAYOR entre el de las reglas y los descuentos heredados de la lista:
        // el dto por producto (que cargó el importador en price_list_items),
        // el dto por categoría y el dto global de la lista. Es MAX, nunca suma.
        // Así el 30% que trae la lista se respeta aunque el producto tenga además
        // una escala por cantidad menor (ej. 15%) — el cliente paga el mayor.
        const dtoCatLegacy = Number(dtosCategoria[p.category || ''] || 0);
        const dtoItemLegacy = Number(itemDtoMap[p.uuid] || 0);
        precioBase = base;
        descGlobalItem = Math.max(siempre, dtoItemLegacy, dtoCatLegacy, descGlobal);
        precio = descGlobalItem > 0 ? Math.round(base * (1 - descGlobalItem / 100) * 100) / 100 : base; // sticker qty=1
        volTiers = tiers;
        // Caja: si las reglas no traen "caja" pero la lista tiene la caja cerrada
        // habilitada, se respeta el descuento_caja del producto (modelo viejo),
        // así los múltiplos de caja siguen teniendo su precio distribuidor.
        const cajaDtoEff = Math.max(caja, cajaCerrada ? (Number(p.descuento_caja) || 0) : 0);
        cajaUnidItem = cajaDtoEff > 0 ? (Number(p.unidades_por_caja) || 0) : 0;
        cajaDtoItem = cajaDtoEff;
      }
      // Override cliente-producto: precio fijo gana; dto puntual se toma como
      // "siempre" (el mayor entre el de la regla y el del override).
      if (overrideMap[p.uuid]) {
        const ov = overrideMap[p.uuid];
        if (ov.precio_override != null) {
          precioBase = ov.precio_override; precio = ov.precio_override;
          descGlobalItem = 0; volTiers = []; cajaUnidItem = 0; cajaDtoItem = 0;
        } else if (ov.descuento_pct != null) {
          descGlobalItem = Math.max(descGlobalItem || 0, ov.descuento_pct);
          precio = Math.round(precioBase * (1 - descGlobalItem / 100) * 100) / 100;
        }
      }
    } else if (clienteId && listaId) {
      // ── Camino viejo (byte por byte) ───────────────────────────────────────
      const dtoCat = Number(dtosCategoria[p.category || ''] || 0);
      const dtoItem = Number(itemDtoMap[p.uuid] || 0);
      if (itemMap[p.uuid] !== undefined) {
        precio = itemMap[p.uuid];                                  // 1. precio fijo del producto en la lista
      } else if (dtoItem > 0) {
        precio = Math.round(base * (1 - dtoItem / 100) * 100) / 100; // 2. dto por producto en la lista
      } else if (dtoCat > 0) {
        precio = Math.round(base * (1 - dtoCat / 100) * 100) / 100; // 3. dto por categoría
      } else if (descGlobal > 0) {
        precio = Math.round(base * (1 - descGlobal / 100) * 100) / 100; // 4. dto global
      } else {
        precio = base;                                             // 5. sin precio especial → precio general
      }
      if (overrideMap[p.uuid]) {
        const ov = overrideMap[p.uuid];
        if (ov.precio_override != null) precio = ov.precio_override;
        else if (ov.descuento_pct != null) precio = Math.round(precio * (1 - ov.descuento_pct / 100) * 100) / 100;
      }
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
      precioBase,
      stock: physicalStock,
      available_stock: availableStock,
      reserved_stock: reservedStock,
      iva_rate: p.iva_rate != null ? Number(p.iva_rate) : null,
      imagen_url: p.imagen_url || null,
      min_order_qty: p.min_order_qty != null ? Number(p.min_order_qty) : 1,
      descripcion: p.descripcion || '',
      volume_tiers: volTiers,
      variants: sanitizeVariants(p.variants),
      // Caja cerrada: en el camino viejo solo si la lista lo habilita; en v2 la
      // habilita la regla 'caja'. Si va en 0, el carrito no aplica descuento por caja.
      unidades_por_caja: cajaUnidItem,
      descuento_caja: cajaDtoItem,
      // v2: le avisa a calcLinea que use precioBase (sin descontar) + descGlobal.
      ...(reglasV2 ? { reglasV2: true, descGlobal: descGlobalItem } : {}),
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
    cajaCerrada,
    horarioDesde,
    horarioHasta,
    portalActivo,
    portalCfg,
  };
}
