// Public catalog API — no auth required from client side.
// Returns products with stock > 0 and precioVenta > 0 for a given org.
// This runs server-side so the Supabase anon key stays private.

const SB_URL     = process.env.SUPABASE_URL     || 'https://mrotnqybqvmvlexncvno.supabase.co';
const SB_ANON    = process.env.SUPABASE_ANON_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SB_ANON) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // org_id filter — defaults to 'aryes' if not provided
  const org = (req.query.org || 'aryes').replace(/[^a-z0-9_-]/gi, '');

  try {
    const query = [
      'select=uuid,name,unit,category,brand,precio_venta,stock,min_stock',
      `org_id=eq.${org}`,
      'stock=gt.0',
      'precio_venta=gt.0',
      'order=category.asc,name.asc',
      'limit=500',
    ].join('&');

    const r = await fetch(`${SB_URL}/rest/v1/products?${query}`, {
      headers: {
        'apikey':        SB_ANON,
        'Authorization': `Bearer ${SB_ANON}`,
        'Accept':        'application/json',
      },
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[catalogo] Supabase error:', r.status, err);
      return res.status(502).json({ error: 'Database error' });
    }

    const products = await r.json();

    // Shape the response — only expose what clients need
    const items = products.map(p => ({
      id:         p.uuid,
      nombre:     p.name,
      unidad:     p.unit,
      categoria:  p.category  || 'General',
      marca:      p.brand     || '',
      precio:     Number(p.precio_venta) || 0,
      stock:      Number(p.stock)        || 0,
    }));

    // Derive categories list
    const categorias = [...new Set(items.map(i => i.categoria))].sort();

    Object.entries({ ...CORS, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).json({ items, categorias, org });

  } catch (err) {
    console.error('[catalogo] Error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
