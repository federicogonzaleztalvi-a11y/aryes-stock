// Public catalog API â no auth required from client side.
import { setCorsHeaders } from './_cors.js';

// GET /api/catalogo?org=aryes              â all products (public catalog)
// GET /api/catalogo?org=aryes&cliente=UUID â products with client's prices applied

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;



// ── Rate limiting: max 60 requests per IP per 1 min ──
const _rl_cat = new Map();
function _checkRate_cat(ip) {
  const now = Date.now();
  const entry = _rl_cat.get(ip) || [];
  const recent = entry.filter(t => now - t < 60000);
  if (recent.length >= 60) return false;
  recent.push(now);
  _rl_cat.set(ip, recent);
  return true;
}
function setHeaders(res, extra = {}) {
  setCorsHeaders({ headers: {} }, res);
  Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(res);
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_cat(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });

  if (!SB_KEY)              return res.status(500).json({ error: 'Server misconfigured' });

  const org      = (req.query.org      || 'aryes').replace(/[^a-z0-9_-]/gi, '');
  const clienteId = (req.query.cliente || '').replace(/[^a-z0-9_-]/gi, '');

  const headers = {
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Accept':        'application/json',
  };

  try {
    // ââ 1. Load products ââââââââââââââââââââââââââââââââââââââââââââââââââââ
    const prodQuery = [
      'select=uuid,name,unit,category,brand,precio_venta,stock,min_stock,imagen_url,descripcion',
      `org_id=eq.${org}`,
            'order=category.asc,name.asc',
      'limit=500',
    ].join('&');

    // Parallel: products + active B2B reservations for ATP
    const now = new Date().toISOString();
    const resQuery = [
      'select=product_id,quantity',
      `org_id=eq.${org}`,
      'status=eq.active',
      `expires_at=gte.${now}`,
    ].join('&');

    const [prodRes, resRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/products?${prodQuery}`, { headers }),
      fetch(`${SB_URL}/rest/v1/stock_reservations?${resQuery}`, { headers }),
    ]);

    if (!prodRes.ok) return res.status(502).json({ error: 'Database error' });
    const products = await prodRes.json();

    // Build reserved_qty map: productId -> total reserved
    const reservedMap = {};
    if (resRes.ok) {
      const reservations = await resRes.json();
      for (const r of (reservations || [])) {
        reservedMap[r.product_id] = (reservedMap[r.product_id] || 0) + Number(r.quantity);
      }
    }

    // ââ 2. Load client's price list if clienteId provided âââââââââââââââââââ
    let listaId   = null;
  let horarioDesde = null;
  let horarioHasta = null;
  let portalActivo = true;
    let descGlobal = 0;       // % global discount for the list
    let itemMap   = {};       // productUuid â precio especÃ­fico

    if (clienteId) {
      // Get the client's lista_id
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

          // Get the list's global discount
          const listRes = await fetch(
            `${SB_URL}/rest/v1/price_lists?id=eq.${listaId}&select=id,descuento&limit=1`,
            { headers }
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            descGlobal = Number(listData?.[0]?.descuento || 0);
          }

          // Get per-product prices for this list
          const itemsRes = await fetch(
            `${SB_URL}/rest/v1/price_list_items?lista_id=eq.${listaId}&select=product_uuid,precio`,
            { headers }
          );
          if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            itemsData.forEach(it => {
              if (it.precio > 0) itemMap[it.product_uuid] = Number(it.precio);
            });
          }
        }
      }
    }

    // ââ 3. Build response â only expose what clients need âââââââââââââââââââ
    const items = products
      // Public catalog (no cliente) still requires precio_venta > 0
      .filter(p => true) // show all products — precio 0 = consultar precio
      .map(p => {
        const base = Number(p.precio_venta) || 0;
        let precio = base;

        if (clienteId && listaId) {
          if (itemMap[p.uuid] !== undefined) {
            // Specific per-product price for this client
            precio = itemMap[p.uuid];
          } else if (descGlobal > 0) {
            // Apply global list discount
            precio = Math.round(base * (1 - descGlobal / 100) * 100) / 100;
          }
        }

        const physicalStock  = Number(p.stock) || 0;
        const reservedStock  = reservedMap[p.uuid] || 0;
        const availableStock = Math.max(0, physicalStock - reservedStock);

        return {
          id:             p.uuid,
          nombre:         p.name,
          unidad:         p.unit,
          categoria:      p.category || 'General',
          marca:          p.brand    || '',
          precio,
          precioBase:     base,
          stock:          physicalStock,    // physical (unchanged — used by internal ops)
          available_stock: availableStock,  // available for B2B orders (ATP)
          reserved_stock:  reservedStock,   // informational
        };
      });

    const categorias = [...new Set(items.map(i => i.categoria))].sort();

    setHeaders(res, { 'Cache-Control': clienteId
      ? 'private, max-age=60'                          // personalized â don't cache in CDN
      : 'public, s-maxage=60, stale-while-revalidate=300' });

    // Load portal config (brandcfg) for this org
    let portalCfg = { portalCatalogo: true, portalPedidos: true };
    try {
      const cfgRes = await fetch(
        \`\${SB_URL}/rest/v1/app_config?key=eq.brandcfg&org_id=eq.\${org}&limit=1\`,
        { headers }
      );
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData?.[0]?.value) {
          portalCfg = { ...portalCfg, ...cfgData[0].value };
        }
      }
    } catch(e) { /* config load failed — use defaults */ }

    // If catalog is disabled globally, return empty
    if (portalCfg.portalCatalogo === false) {
      setHeaders(res);
      return res.status(200).json({
        items: [], categorias: [], org,
        portalDisabled: true,
        portalCfg,
      });
    }

    // ── 4. Cross-sell recommendations (only when clienteId is provided) ──────
    let recommended = [];
    if (clienteId) {
      try {
        const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_KEY;
        const svcHeaders = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

        // 4a. Get this client's purchased product IDs from ventas
        const myVentasRes = await fetch(
          SB_URL + '/rest/v1/ventas?cliente_id=eq.' + clienteId + '&estado=neq.cancelada&select=items&limit=50',
          { headers: svcHeaders }
        );
        const myPurchased = new Set();
        if (myVentasRes.ok) {
          const myVentas = await myVentasRes.json();
          (myVentas || []).forEach(function(v) {
            (v.items || []).forEach(function(it) {
              if (it.productoId) myPurchased.add(it.productoId);
            });
          });
        }

        // 4b. Get ventas from OTHER clients in the same org (last 100 ventas)
        const otherVentasRes = await fetch(
          SB_URL + '/rest/v1/ventas?org_id=eq.' + org + '&cliente_id=neq.' + clienteId + '&estado=neq.cancelada&select=items,cliente_id&order=created_at.desc&limit=100',
          { headers: svcHeaders }
        );
        if (otherVentasRes.ok) {
          const otherVentas = await otherVentasRes.json();
          // Count how many OTHER clients buy each product
          var prodClients = {};  // productId -> Set of clienteIds
          (otherVentas || []).forEach(function(v) {
            (v.items || []).forEach(function(it) {
              if (it.productoId && !myPurchased.has(it.productoId)) {
                if (!prodClients[it.productoId]) prodClients[it.productoId] = new Set();
                prodClients[it.productoId].add(v.cliente_id);
              }
            });
          });

          // Sort by number of clients who buy it (popularity among peers)
          var ranked = Object.entries(prodClients)
            .map(function(e) { return { id: e[0], clientCount: e[1].size }; })
            .sort(function(a, b) { return b.clientCount - a.clientCount; })
            .slice(0, 6);

          // Match with catalog items to get full product data
          ranked.forEach(function(r) {
            var match = items.find(function(p) { return p.id === r.id; });
            if (match) {
              recommended.push({
                id: match.id,
                nombre: match.nombre,
                precio: match.precio,
                unidad: match.unidad,
                categoria: match.categoria,
                marca: match.marca,
                clientCount: r.clientCount,
                reason: r.clientCount + ' cliente' + (r.clientCount > 1 ? 's' : '') + ' similar' + (r.clientCount > 1 ? 'es' : '') + ' lo compra' + (r.clientCount > 1 ? 'n' : '')
              });
            }
          });
        }
      } catch (recErr) {
        console.error('[catalogo] Recommendation error (non-fatal):', recErr.message);
        // Non-fatal — continue without recommendations
      }
    }

    return res.status(200).json({
      items,
      categorias,
      org,
      clienteId: clienteId || null,
      recommended,
      hasLista: !!listaId,
      descGlobal,
      horarioDesde,
      horarioHasta,
      portalActivo,
      portalCfg,
    });

  } catch (err) {
    console.error('[catalogo] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
