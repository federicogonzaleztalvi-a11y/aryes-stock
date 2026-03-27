// Public catalog API â no auth required from client side.
// GET /api/catalogo?org=aryes              â all products (public catalog)
// GET /api/catalogo?org=aryes&cliente=UUID â products with client's prices applied

const SB_URL  = process.env.SUPABASE_URL     || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setHeaders(res, extra = {}) {
  Object.entries({ ...CORS, ...extra }).forEach(([k, v]) => res.setHeader(k, v));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setHeaders(res);
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_ANON)              return res.status(500).json({ error: 'Server misconfigured' });

  const org      = (req.query.org      || 'aryes').replace(/[^a-z0-9_-]/gi, '');
  const clienteId = (req.query.cliente || '').replace(/[^a-z0-9_-]/gi, '');

  const headers = {
    'apikey':        SB_ANON,
    'Authorization': `Bearer ${SB_ANON}`,
    'Accept':        'application/json',
  };

  try {
    // ââ 1. Load products ââââââââââââââââââââââââââââââââââââââââââââââââââââ
    const prodQuery = [
      'select=uuid,name,unit,category,brand,precio_venta,stock,min_stock',
      `org_id=eq.${org}`,
            'order=category.asc,name.asc',
      'limit=500',
    ].join('&');

    const prodRes = await fetch(`${SB_URL}/rest/v1/products?${prodQuery}`, { headers });
    if (!prodRes.ok) return res.status(502).json({ error: 'Database error' });
    const products = await prodRes.json();

    // ââ 2. Load client's price list if clienteId provided âââââââââââââââââââ
    let listaId   = null;
    let descGlobal = 0;       // % global discount for the list
    let itemMap   = {};       // productUuid â precio especÃ­fico

    if (clienteId) {
      // Get the client's lista_id
      const cliRes = await fetch(
        `${SB_URL}/rest/v1/clients?id=eq.${clienteId}&select=id,lista_id&limit=1`,
        { headers }
      );
      if (cliRes.ok) {
        const cliData = await cliRes.json();
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

        return {
          id:        p.uuid,
          nombre:    p.name,
          unidad:    p.unit,
          categoria: p.category || 'General',
          marca:     p.brand    || '',
          precio,
          precioBase: base,
          stock:     Number(p.stock) || 0,
        };
      });

    const categorias = [...new Set(items.map(i => i.categoria))].sort();

    setHeaders(res, { 'Cache-Control': clienteId
      ? 'private, max-age=60'                          // personalized â don't cache in CDN
      : 'public, s-maxage=60, stale-while-revalidate=300' });

    return res.status(200).json({
      items,
      categorias,
      org,
      clienteId: clienteId || null,
      hasLista: !!listaId,
      descGlobal,
    });

  } catch (err) {
    console.error('[catalogo] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
