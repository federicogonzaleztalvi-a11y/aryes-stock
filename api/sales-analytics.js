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
      const rows = await fetchAll(org, 'fecha,razon_social');
      if (!rows.length) return res.status(200).json({ lines: 0, clientes: 0 });
      const clientes = new Set(rows.map(r => r.razon_social)).size;
      return res.status(200).json({
        lines: rows.length, clientes,
        desde: rows[0].fecha, hasta: rows[rows.length - 1].fecha,
      });
    }

    // ── overview: ranking + KPIs + mensual + familias ──
    if (action === 'overview') {
      const rows = await fetchAll(org, 'fecha,razon_social,nombre,familia,importe,cantidad');
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

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    console.error('[sales-analytics] error:', e.message);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
