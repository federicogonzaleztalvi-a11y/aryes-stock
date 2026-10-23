// api/sales-analytics.js — Inteligencia de clientes (lee sales_lines).
// ----------------------------------------------------------------------------
// Calcula, server-side, lo que el panel de ClientesTab muestra: ranking ABC de
// la cartera, cuántos clientes crecen / decrecen / dejaron de comprar, ventas
// mensuales de toda la cartera (12m vs 12m anteriores) y ventas por familia.
// El detalle por cliente (ficha) lo sirve action=ficha.
//
// Identidad: access_token del admin → org del servidor. Solo admin.
//
// GET /api/sales-analytics?action=status             → { lines, clientes, desde, hasta }
// GET /api/sales-analytics?action=overview           → ranking ABC + KPIs + mensual + familias
// GET /api/sales-analytics?action=ficha&rs=RAZON     → detalle de un cliente

import { setCorsHeaders } from './_cors.js';

const SB_URL  = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE = 1000;  // PostgREST devuelve de a 1000; paginamos por Range.

async function resolveAdmin(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const svcKey = SB_SVC || SB_ANON;
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: svcKey, Authorization: 'Bearer ' + token },
  });
  if (!userRes.ok) return null;
  const email = (await userRes.json())?.email;
  if (!email) return null;
  const uRes = await fetch(
    `${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=role,org_id&limit=1`,
    { headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey, Accept: 'application/json' } }
  );
  if (!uRes.ok) return null;
  const u = (await uRes.json())?.[0];
  if (!u || u.role !== 'admin') return null;
  return { org: u.org_id };
}

// Trae TODAS las filas de sales_lines de la org (paginado), con las columnas pedidas.
async function fetchAll(org, select, extra = '') {
  const svcH = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(
      `${SB_URL}/rest/v1/sales_lines?org_id=eq.${encodeURIComponent(org)}${extra}&select=${select}&order=fecha.asc`,
      { headers: { ...svcH, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } }
    );
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

// Explota los pedidos del portal (tabla `ventas`) a filas con la misma forma que
// sales_lines, marcadas canal='portal'. Es el "Caño B": la segunda fuente del
// panel, junto al informe de Mercado (canal='mercado'). No hace falta migración
// ni trigger — leemos `ventas` en vivo cada vez.
//   razon_social ← cliente_nombre   fecha ← creado_en (día)
//   producto ← item.nombre          familia ← products.category (por productoId)
//   cantidad ← item.cantidad        importe ← cantidad × precioUnit
// Se excluyen las ventas canceladas. (El importe del portal puede traer IVA según
// cómo guarde la org sus precios; Mercado es neto. La diferencia es menor.)
async function fetchPortalRows(org) {
  const svcH = { apikey: SB_SVC, Authorization: 'Bearer ' + SB_SVC, Accept: 'application/json' };

  // Mapa productoId → familia (category) para clasificar cada ítem.
  const prodMap = new Map();
  {
    let from = 0;
    for (;;) {
      const r = await fetch(
        `${SB_URL}/rest/v1/products?org_id=eq.${encodeURIComponent(org)}&select=uuid,category`,
        { headers: { ...svcH, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } }
      );
      if (!r.ok) break;              // sin productos no es fatal: familia queda vacía
      const rows = await r.json();
      for (const p of rows) prodMap.set(p.uuid, p.category || '');
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  // Ventas no canceladas de la org.
  const ventas = [];
  {
    let from = 0;
    for (;;) {
      const r = await fetch(
        `${SB_URL}/rest/v1/ventas?org_id=eq.${encodeURIComponent(org)}` +
          `&estado=neq.cancelada&select=cliente_nombre,items,creado_en&order=creado_en.asc`,
        { headers: { ...svcH, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' } }
      );
      if (!r.ok) return [];          // sin tabla/permiso: el panel sigue con Mercado
      const rows = await r.json();
      ventas.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }

  const out = [];
  for (const v of ventas) {
    const rs = String(v.cliente_nombre || '').trim();
    if (!rs) continue;
    const fecha = String(v.creado_en || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    const items = Array.isArray(v.items) ? v.items : [];
    for (const it of items) {
      const cantidad = Number(it.cantidad) || 0;
      if (cantidad <= 0) continue;
      const precio = Number(it.precioUnit) || 0;
      out.push({
        fecha, razon_social: rs, nombre: '',
        producto: String(it.nombre || '').trim(),
        familia: prodMap.get(it.productoId) || '',
        cantidad, importe: cantidad * precio, canal: 'portal',
      });
    }
  }
  return out;
}

// Capa de ventas unificada: sales_lines (Mercado) + pedidos del portal. Para no
// contar dos veces lo que el ERP ya incluye, descartamos las filas del portal con
// fecha ≤ al último día del informe Mercado (se asume que a esa altura la venta ya
// quedó facturada en el ERP). Las orgs sin informe Mercado cuentan todo el portal.
async function loadRows(org) {
  const mercado = await fetchAll(org, 'fecha,razon_social,nombre,familia,producto,importe,cantidad,canal');
  const portal = await fetchPortalRows(org);
  if (!portal.length) return mercado;
  const mercadoMax = mercado.reduce((m, r) => (r.fecha > m ? r.fecha : m), '');
  const extra = mercadoMax ? portal.filter(r => r.fecha > mercadoMax) : portal;
  const all = mercado.concat(extra);
  all.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return all;
}

// ── helpers de fecha (todo en UTC, fechas 'YYYY-MM-DD') ──
const ymd  = (d) => d.toISOString().slice(0, 10);
const addMonths = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const monthKey  = (iso) => iso.slice(0, 7);           // 'YYYY-MM'

// Fecha de corte por defecto: último día del último mes COMPLETO del informe.
function cortePorDefecto(maxIso) {
  const d = new Date(maxIso + 'T00:00:00Z');
  const finMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  // si el informe llega justo a fin de mes, ese mes está completo; si no, mes anterior
  if (ymd(d) === ymd(finMes)) return finMes;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
}

// Ranking ABC sobre las ventas de los últimos 12 meses (clave = razón social).
function rankingABC(rows, corte) {
  const a12 = addMonths(corte, -12);
  const v = new Map();              // rs -> ventas 12m
  const nombre = new Map();         // rs -> nombre de fantasía (el más frecuente)
  const nombreCount = new Map();
  for (const r of rows) {
    const f = new Date(r.fecha + 'T00:00:00Z');
    if (r.nombre) {
      const kk = r.razon_social + '|' + r.nombre;
      nombreCount.set(kk, (nombreCount.get(kk) || 0) + 1);
      const best = nombreCount.get(kk);
      if (!nombre.has(r.razon_social) || best > (nombre.get(r.razon_social)?.c || 0)) {
        nombre.set(r.razon_social, { n: r.nombre, c: best });
      }
    }
    if (f > a12 && f <= corte) v.set(r.razon_social, (v.get(r.razon_social) || 0) + Number(r.importe || 0));
  }
  // asegurar que todos los clientes existan aunque no tengan venta en 12m
  for (const r of rows) if (!v.has(r.razon_social)) v.set(r.razon_social, 0);

  const arr = [...v.entries()].map(([rs, ventas12]) => ({ rs, ventas12 }))
    .sort((a, b) => b.ventas12 - a.ventas12);
  const tot = arr.reduce((s, x) => s + (x.ventas12 > 0 ? x.ventas12 : 0), 0);
  let acum = 0;
  arr.forEach((x, i) => {
    const prev = acum / (tot || 1);
    if (x.ventas12 <= 0) x.clase = 'C';
    else if (prev < 0.80) x.clase = 'A';
    else if (prev < 0.95) x.clase = 'B';
    else x.clase = 'C';
    acum += x.ventas12 > 0 ? x.ventas12 : 0;
    x.puesto = i + 1;
    x.nombre = nombre.get(x.rs)?.n || '';
  });
  return arr;
}

// ── helpers de la ficha por cliente ──
const MES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const nfmt = (x) => Math.round(Number(x) || 0).toLocaleString('es-UY');
const pctChange = (a, b) => { const r = a / b - 1; return (r >= 0 ? '+' : '') + Math.round(r * 100) + '%'; };

// Unidad aproximada del producto (para los textos del análisis).
function unidad(prod) {
  const s = String(prod).toLowerCase();
  if (/\b\d+([.,]\d+)?\s*(cc|ml)\b/.test(s)) return 'un.';
  if (/\b\d+([.,]\d+)?\s*(l|lt|lts|litros?)\b\.?/.test(s)) return 'L';
  return 'kg';
}
const qtyStr = (prod, q) => nfmt(q) + ' ' + unidad(prod);

// Limpia el nombre de producto del ERP para mostrarlo lindo.
function pretty(p) {
  let s = String(p || '').trim();
  s = s.replace(/RELLENO Y COBERT\.\s*SABOR/ig, 'RELLENO Y COBERTURA');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  s = s.replace(/grs\./g, 'g').replace(/gr\./g, 'g');
  s = s.replace(/(\d),(\d)\s*kgs?\.?/g, '$1,$2 kg').replace(/(\d)\s*kgs?\.?/g, '$1 kg');
  s = s.replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Suma de importe por cliente en una ventana [desde, hasta].
function sumByClient(rows, desde, hasta) {
  const m = new Map();
  for (const r of rows) {
    const f = new Date(r.fecha + 'T00:00:00Z');
    if (f > desde && f <= hasta) m.set(r.razon_social, (m.get(r.razon_social) || 0) + Number(r.importe || 0));
  }
  return m;
}

export default async function handler(req, res) {
  await setCorsHeaders(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_SVC) return res.status(500).json({ error: 'Server misconfigured' });

  const auth = await resolveAdmin(req);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  const { org } = auth;
  const action = req.query.action || 'status';

  try {
    // ── status: ¿hay datos importados? (para mostrar u ocultar el panel) ──
    if (action === 'status') {
      const rows = await loadRows(org);
      if (!rows.length) return res.status(200).json({ lines: 0, clientes: 0 });
      const clientes = new Set(rows.map(r => r.razon_social)).size;
      return res.status(200).json({
        lines: rows.length, clientes,
        desde: rows[0].fecha, hasta: rows[rows.length - 1].fecha,
      });
    }

    // ── overview: ranking + KPIs + mensual + familias ──
    if (action === 'overview') {
      const rows = await loadRows(org);
      if (!rows.length) return res.status(200).json({ empty: true });

      const maxIso = rows[rows.length - 1].fecha;
      const corte = req.query.corte ? new Date(req.query.corte + 'T00:00:00Z') : cortePorDefecto(maxIso);
      const a12 = addMonths(corte, -12), a24 = addMonths(corte, -24);

      const rk = rankingABC(rows, corte);
      const v12 = sumByClient(rows, a12, corte);
      const v0  = sumByClient(rows, a24, a12);

      // KPIs: crece / decrece / dejó de comprar / nuevos
      let crecen = 0, decrecen = 0, perdidos = 0, nuevos = 0;
      for (const { rs } of rk) {
        const a = v12.get(rs) || 0, b = v0.get(rs) || 0;
        if (b <= 0 && a > 0) nuevos++;
        else if (b > 0 && a <= 0) perdidos++;
        else if (b > 0 && a > b * 1.1) crecen++;
        else if (b > 0 && a < b * 0.9) decrecen++;
      }

      // Ventas mensuales: últimos 12 meses vs mismos meses del año anterior
      const meses = [];
      for (let i = 11; i >= 0; i--) {
        const m = addMonths(corte, -i);
        meses.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
      }
      const mesActual = Object.fromEntries(meses.map(m => [m, 0]));
      const mesPrev   = Object.fromEntries(meses.map(m => [m, 0]));
      const prevKeys = new Set(meses.map(m => {
        const d = new Date(m + '-01T00:00:00Z'); return monthKey(ymd(addMonths(d, -12))) + '|' + m;
      }));
      const prevMap = new Map([...prevKeys].map(x => { const [p, cur] = x.split('|'); return [p, cur]; }));
      for (const r of rows) {
        const mk = monthKey(r.fecha);
        if (mk in mesActual) mesActual[mk] += Number(r.importe || 0);
        if (prevMap.has(mk)) mesPrev[prevMap.get(mk)] += Number(r.importe || 0);
      }

      // Ventas por familia (12m vs 12m anteriores)
      const famC = new Map(), famP = new Map();
      for (const r of rows) {
        const f = new Date(r.fecha + 'T00:00:00Z');
        const fam = r.familia || '(sin familia)';
        if (f > a12 && f <= corte) famC.set(fam, (famC.get(fam) || 0) + Number(r.importe || 0));
        else if (f > a24 && f <= a12) famP.set(fam, (famP.get(fam) || 0) + Number(r.importe || 0));
      }
      const familias = [...new Set([...famC.keys(), ...famP.keys()])]
        .map(fam => ({ familia: fam, actual: famC.get(fam) || 0, previo: famP.get(fam) || 0 }))
        .sort((a, b) => (b.actual + b.previo) - (a.actual + a.previo));

      return res.status(200).json({
        corte: ymd(corte),
        totalClientes: rk.length,
        kpi: { crecen, decrecen, perdidos, nuevos,
               ventas12: [...v12.values()].reduce((s, x) => s + x, 0),
               ventas0:  [...v0.values()].reduce((s, x) => s + x, 0) },
        ranking: rk.map(x => ({ ...x, ventas0: v0.get(x.rs) || 0 })),
        meses, mesActual, mesPrev,
        familias,
      });
    }

    // ── ficha: detalle de un cliente (análisis tipo vendedor) ──
    if (action === 'ficha') {
      const rs = String(req.query.rs || '').trim();
      if (!rs) return res.status(400).json({ error: 'Falta razón social (rs)' });

      const rows = await loadRows(org);
      if (!rows.length) return res.status(200).json({ empty: true });

      const maxIso = rows[rows.length - 1].fecha;
      const corte = req.query.corte ? new Date(req.query.corte + 'T00:00:00Z') : cortePorDefecto(maxIso);
      const a12 = addMonths(corte, -12), a24 = addMonths(corte, -24);

      const rk = rankingABC(rows, corte);
      const meInRk = rk.find(x => x.rs === rs);

      const g = rows.filter(r => r.razon_social === rs);
      if (!g.length) return res.status(404).json({ error: 'Cliente no encontrado' });
      const nombre = meInRk?.nombre || g.find(r => r.nombre)?.nombre || '';

      const inRange = (r, d1, d2) => { const f = new Date(r.fecha + 'T00:00:00Z'); return f > d1 && f <= d2; };
      const p12 = g.filter(r => inRange(r, a12, corte));
      const p0  = g.filter(r => inRange(r, a24, a12));
      const v12 = p12.reduce((s, r) => s + Number(r.importe || 0), 0);
      const v0  = p0.reduce((s, r) => s + Number(r.importe || 0), 0);

      const fechasAll = g.map(r => r.fecha).sort();
      const primera = fechasAll[0], ultima = fechasAll[fechasAll.length - 1];
      const diasSinComprar = Math.floor((corte - new Date(ultima + 'T00:00:00Z')) / 86400000);

      // meses del cliente (12m) y mismos meses del año anterior
      const meses = [];
      for (let i = 11; i >= 0; i--) {
        const m = addMonths(corte, -i);
        meses.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
      }
      const mesActual = Object.fromEntries(meses.map(m => [m, 0]));
      const mesPrev   = Object.fromEntries(meses.map(m => [m, 0]));
      const prevMap = new Map(meses.map(m => {
        const d = new Date(m + '-01T00:00:00Z'); return [monthKey(ymd(addMonths(d, -12))), m];
      }));
      for (const r of g) {
        const mk = monthKey(r.fecha);
        if (mk in mesActual) mesActual[mk] += Number(r.importe || 0);
        if (prevMap.has(mk)) mesPrev[prevMap.get(mk)] += Number(r.importe || 0);
      }

      // top productos (12m)
      const prodAgg = new Map();
      for (const r of p12) {
        const o = prodAgg.get(r.producto) || { cantidad: 0, importe: 0 };
        o.cantidad += Number(r.cantidad || 0); o.importe += Number(r.importe || 0);
        prodAgg.set(r.producto, o);
      }
      const topProductos = [...prodAgg.entries()]
        .map(([producto, o]) => ({ producto: pretty(producto), cantidad: o.cantidad, importe: o.importe }))
        .sort((a, b) => b.importe - a.importe).slice(0, 15);

      // familias del cliente (12m vs 12m anteriores)
      const famC = new Map(), famP = new Map();
      for (const r of g) {
        const fam = r.familia || '(sin familia)';
        if (inRange(r, a12, corte)) famC.set(fam, (famC.get(fam) || 0) + Number(r.importe || 0));
        else if (inRange(r, a24, a12)) famP.set(fam, (famP.get(fam) || 0) + Number(r.importe || 0));
      }
      const familias = [...new Set([...famC.keys(), ...famP.keys()])]
        .map(f => ({ familia: f, actual: famC.get(f) || 0, previo: famP.get(f) || 0 }))
        .sort((a, b) => (b.actual + b.previo) - (a.actual + a.previo));

      // pivot producto × periodo → qué bajó / qué subió (excluye líneas sin familia)
      const piv = new Map();
      for (const r of g) {
        if (!(r.familia || '').trim()) continue;
        const f = new Date(r.fecha + 'T00:00:00Z');
        if (!(f > a24 && f <= corte)) continue;
        const o = piv.get(r.producto) || { cant0: 0, cant12: 0, imp0: 0, imp12: 0 };
        if (f > a12) { o.cant12 += Number(r.cantidad || 0); o.imp12 += Number(r.importe || 0); }
        else { o.cant0 += Number(r.cantidad || 0); o.imp0 += Number(r.importe || 0); }
        piv.set(r.producto, o);
      }
      const um = Math.max(1500, Math.min(0.01 * Math.max(v12, v0), 10000));
      const pivArr = [...piv.entries()].map(([producto, o]) => ({ producto, ...o, dif: o.imp12 - o.imp0 }));
      const baja = pivArr
        .filter(x => x.imp0 > 0 && (x.cant12 <= 0 || (x.cant0 > 0 && x.cant12 / x.cant0 - 1 <= -0.3)) && x.dif < -um)
        .sort((a, b) => a.dif - b.dif);
      const sube = pivArr
        .filter(x => x.imp12 > 0 && (x.cant0 <= 0 || (x.cant0 > 0 && x.cant12 / x.cant0 - 1 >= 0.3)) && x.dif > um)
        .sort((a, b) => b.dif - a.dif);
      const perdidos = baja.slice(0, 8).map(x => ({ producto: pretty(x.producto), cant0: x.cant0, cant12: x.cant12, dif: x.dif }));
      const crecidos = sube.slice(0, 8).map(x => ({ producto: pretty(x.producto), cant0: x.cant0, cant12: x.cant12, dif: x.dif }));

      // ── análisis automático (5 líneas, como el vendedor) ──
      const L = [];
      // 1) Tendencia
      let t = v0 > 0
        ? `Tendencia: en los últimos 12 meses compró ${nfmt(v12)} contra ${nfmt(v0)} en los 12 meses anteriores (${pctChange(v12, v0)}).`
        : `Tendencia: cliente nuevo; en los últimos 12 meses compró ${nfmt(v12)}.`;
      const r3  = g.filter(r => inRange(r, addMonths(corte, -3), corte)).reduce((s, r) => s + Number(r.importe || 0), 0);
      const r3a = g.filter(r => inRange(r, addMonths(a12, -3), a12)).reduce((s, r) => s + Number(r.importe || 0), 0);
      if (r3a > 0 && v0 > 0) t += ` Último trimestre: ${nfmt(r3)} contra ${nfmt(r3a)} un año antes (${pctChange(r3, r3a)}).`;
      L.push(t);
      // 2) Frecuencia
      const diasCompra = (arr) => new Set(arr.map(r => r.fecha)).size;
      const d12 = diasCompra(p12), d0 = diasCompra(p0);
      const mesesConCompra = new Set(p12.map(r => monthKey(r.fecha)));
      const sinCompra = meses.filter(m => !mesesConCompra.has(m));
      let fr = `Frecuencia: ${d12} días con compra en los últimos 12 meses` + (d0 ? ` contra ${d0} en el período anterior.` : '.');
      if (sinCompra.length && sinCompra.length < 12) {
        fr += ' Meses sin compras: ' + sinCompra.map(m => { const [y, mm] = m.split('-'); return MES_L[Number(mm) - 1] + ' ' + y; }).join(', ') + '.';
      }
      const [uy, umM, ud] = ultima.split('-'); fr += ` Última compra: ${ud}/${umM}/${uy}.`;
      L.push(fr);
      // 3) Lo que perdimos
      if (baja.length) {
        const it = baja.slice(0, 4).map(x => `${pretty(x.producto)} (` +
          (x.cant12 <= 0 ? 'no volvió a comprar' : `de ${qtyStr(x.producto, x.cant0)} a ${qtyStr(x.producto, x.cant12)}`) +
          `, −${nfmt(-x.dif)})`);
        L.push(`Lo que perdimos (unos ${nfmt(-baja.reduce((s, x) => s + x.dif, 0))} al año): ` + it.join('; ') + '.');
      } else L.push('Lo que perdimos: no dejó de comprar ni bajó fuerte ningún producto.');
      // 4) Lo que creció
      if (sube.length) {
        const it = sube.slice(0, 4).map(x => `${pretty(x.producto)} (` +
          (x.cant0 <= 0 ? 'nuevo' : `de ${qtyStr(x.producto, x.cant0)} a ${qtyStr(x.producto, x.cant12)}`) +
          `, +${nfmt(x.dif)})`);
        L.push(`Lo que creció (unos ${nfmt(sube.reduce((s, x) => s + x.dif, 0))} más al año): ` + it.join('; ') + '.');
      } else L.push('Lo que creció: ningún producto con un aumento importante.');
      // 5) Para la visita
      const v = [];
      if (diasSinComprar > 45) v.push(`no compra desde el ${ud}/${umM}/${uy} (${diasSinComprar} días): confirmar si sigue activo, cerró o cambió de proveedor`);
      if (baja.length) v.push('preguntar qué pasó con ' + baja.slice(0, 2).map(x => pretty(x.producto).toLowerCase()).join(' y ') + ' (¿precio, otro proveedor, cambio de receta?)');
      const tot12 = [...prodAgg.values()].reduce((s, o) => s + o.importe, 0);
      if (tot12 > 0) {
        const maxProd = [...prodAgg.entries()].sort((a, b) => b[1].importe - a[1].importe)[0];
        if (maxProd && maxProd[1].importe / tot12 >= 0.6) {
          v.push(`depende mucho de un solo producto (${pretty(maxProd[0]).toLowerCase()}, ${Math.round(maxProd[1].importe / tot12 * 100)}% de lo comprado en 12 m)`);
        }
      }
      // Oportunidad GENÉRICA: familias top de la cartera que este cliente nunca compró.
      const famsCliente = new Set(g.filter(r => new Date(r.fecha + 'T00:00:00Z') > a24).map(r => r.familia || '(sin familia)'));
      const orgFam = new Map();
      for (const r of rows) {
        if (!inRange(r, a12, corte)) continue;
        const fam = r.familia || '(sin familia)';
        if (!fam || fam === '(sin familia)') continue;
        orgFam.set(fam, (orgFam.get(fam) || 0) + Number(r.importe || 0));
      }
      const faltan = [...orgFam.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([f]) => f).filter(f => !famsCliente.has(f)).slice(0, 3);
      if (faltan.length) {
        v.push('no compra ' + (faltan.length > 1 ? faltan.slice(0, -1).join(', ') + ' ni ' + faltan[faltan.length - 1] : faltan[0]) + ': oportunidad para ofrecer');
      }
      if (!v.length) v.push('cliente estable; mantener la frecuencia y ofrecer novedades de la lista');
      const vs = v.join('; '); L.push('Para la visita: ' + vs[0].toUpperCase() + vs.slice(1) + '.');

      return res.status(200).json({
        rs, nombre,
        clase: meInRk?.clase || 'C', puesto: meInRk?.puesto || null,
        corte: ymd(corte), v12, v0, primera, ultima, diasSinComprar,
        meses, mesActual, mesPrev, topProductos, familias, perdidos, crecidos,
        analisis: L,
      });
    }

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    console.error('[sales-analytics] error:', e.message);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
