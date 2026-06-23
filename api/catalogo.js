// Public catalog API — no auth required from client side.
import { setCorsHeaders } from './_cors.js';
import { getBearerToken, validatePortalSession } from './_session.js';
// Núcleo compartido de resolución de precios (misma fuente de verdad que el bot WhatsApp).
import { getCatalogoCliente } from './_catalog.js';

// PRIVATE mode (?cliente=) requires a valid portal session. org_id and cliente_id
// are derived from the validated session — query params are IGNORED for that path
// to prevent IDOR / cross-tenant data access.

// GET /api/catalogo?org=aryes              — all products (public catalog)
// GET /api/catalogo?org=aryes&cliente=UUID — products with client's prices applied

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

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

  let org        = (req.query.org      || 'aryes').replace(/[^a-z0-9_-]/gi, '');
  const reqCliente = (req.query.cliente || '').replace(/[^a-z0-9_-]/gi, '');

  // PRIVATE mode: a ?cliente= request asks for negotiated prices + purchase-based
  // recommendations — both are tenant-private data. Require a valid portal session
  // and DERIVE identity from it. Never trust the query param (IDOR defense).
  let clienteId = '';
  if (reqCliente) {
    const session = await validatePortalSession(getBearerToken(req));
    if (!session) {
      setHeaders(res);
      return res.status(401).json({ error: 'Sesión requerida para ver precios personalizados' });
    }
    // Override query identity with the authenticated session's identity.
    clienteId = String(session.cliente_id || '');
    org       = String(session.org_id || org).replace(/[^a-z0-9_-]/gi, '');
    if (!clienteId) {
      setHeaders(res);
      return res.status(401).json({ error: 'Sesión inválida' });
    }
  }

  try {
    // ── Carga del catálogo + precios via núcleo compartido (misma fuente que el bot) ──
    let catalogo;
    try {
      catalogo = await getCatalogoCliente({ org, clienteId });
    } catch (e) {
      console.error('[catalogo] load failed:', e.message);
      return res.status(502).json({ error: 'Database error' });
    }
    const { items, categorias, hasLista, descGlobal, horarioDesde, horarioHasta, portalActivo, portalCfg } = catalogo;

    setHeaders(res, { 'Cache-Control': clienteId
      ? 'private, max-age=60'                          // personalized — don't cache in CDN
      : 'public, s-maxage=60, stale-while-revalidate=300' });

    // If catalog is disabled globally, return empty
    if (portalCfg.portalCatalogo === false) {
      setHeaders(res);
      return res.status(200).json({
        items: [], categorias: [], org,
        portalDisabled: true,
        portalCfg,
      });
    }

    // ── Cross-sell recommendations (only when clienteId is provided) ──────────
    let recommended = [];
    let buyAgain = [];
    let coBuy = {};
    if (clienteId) {
      let allOrders = [];
      try {
        const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_KEY;
        const svcHeaders = { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' };

        // Historial de compras del cliente para "Volver a pedir". Combina dos
        // fuentes para que aparezca apenas el cliente hace su primer pedido por
        // el portal, sin esperar a que el admin lo importe a ventas:
        //   - ventas       (pedidos ya importados/confirmados desde el admin)
        //   - b2b_orders   (pedidos hechos por el cliente desde el portal)
        // Los items de ventas usan { productoId }; los de b2b_orders usan
        // { productId }. Normalizamos a productoId para tratarlos igual.
        const [myVentasRes, myPortalRes] = await Promise.all([
          fetch(
            SB_URL + '/rest/v1/ventas?cliente_id=eq.' + clienteId + '&estado=neq.cancelada&select=items&limit=50',
            { headers: svcHeaders }
          ),
          fetch(
            SB_URL + '/rest/v1/b2b_orders?cliente_id=eq.' + clienteId + '&estado=neq.cancelada&select=items&limit=50',
            { headers: svcHeaders }
          ),
        ]);
        const myPurchased = new Set();
        const myFreq = {};  // productoId -> nº de pedidos que lo incluyen
        const normItems = function(arr) {
          return (arr || []).map(function(o) {
            return { items: (o.items || []).map(function(it) {
              return { productoId: it.productoId || it.productId || '' };
            }) };
          });
        };
        let myOrders = [];
        if (myVentasRes.ok) myOrders = myOrders.concat(normItems(await myVentasRes.json()));
        if (myPortalRes.ok) myOrders = myOrders.concat(normItems(await myPortalRes.json()));
        allOrders = allOrders.concat(myOrders);
        myOrders.forEach(function(v) {
          (v.items || []).forEach(function(it) {
            if (it.productoId) {
              myPurchased.add(it.productoId);
              myFreq[it.productoId] = (myFreq[it.productoId] || 0) + 1;
            }
          });
        });

        // "Volver a pedir": productos propios más pedidos, que sigan en el catálogo actual
        buyAgain = Object.entries(myFreq)
          .sort(function(a, b) { return b[1] - a[1]; })
          .map(function(e) { return items.find(function(p) { return p.id === e[0]; }); })
          .filter(Boolean)
          .slice(0, 8)
          .map(function(p) {
            return { id: p.id, nombre: p.nombre, precio: p.precio, unidad: p.unidad, categoria: p.categoria, iva_rate: p.iva_rate };
          });

        // Get ventas from OTHER clients in the same org (last 100 ventas)
        const otherVentasRes = await fetch(
          SB_URL + '/rest/v1/ventas?org_id=eq.' + org + '&cliente_id=neq.' + clienteId + '&estado=neq.cancelada&select=items,cliente_id&order=created_at.desc&limit=100',
          { headers: svcHeaders }
        );
        if (otherVentasRes.ok) {
          const otherVentas = await otherVentasRes.json();
          allOrders = allOrders.concat(otherVentas || []);
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

        // ── Co-ocurrencia: "quien compra X también lleva Y" ──────────────────
        // Sobre todos los pedidos vistos (propios + del resto de la org), cuenta
        // qué productos aparecen juntos en el mismo pedido. El portal lo usa en
        // el carrito para sugerir complementos según lo que el cliente ya cargó.
        const catalogIds = new Set(items.map(function(p) { return p.id; }));
        const coMap = {};  // a -> { b: vecesJuntos }
        allOrders.forEach(function(v) {
          const ids = Array.from(new Set((v.items || [])
            .map(function(it) { return it.productoId; })
            .filter(Boolean)));
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              const a = ids[i], b = ids[j];
              (coMap[a] || (coMap[a] = {}))[b] = (coMap[a][b] || 0) + 1;
              (coMap[b] || (coMap[b] = {}))[a] = (coMap[b][a] || 0) + 1;
            }
          }
        });
        Object.keys(coMap).forEach(function(a) {
          if (!catalogIds.has(a)) return;
          const ranked = Object.entries(coMap[a])
            .filter(function(e) { return catalogIds.has(e[0]); })
            .sort(function(x, y) { return y[1] - x[1]; })
            .slice(0, 6)
            .map(function(e) { return e[0]; });
          if (ranked.length) coBuy[a] = ranked;
        });
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
      buyAgain,
      coBuy,
      hasLista,
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
