// AnalyticsTab — Panel de analítica web del portal B2B (admin).
// Lee api/analytics (que agrega web_events scopeado al org) y muestra cómo se
// comportan los clientes en el portal: visitas, tiempo, productos vistos,
// búsquedas y embudo de pedido. Mismo lenguaje visual que KPIs/Dashboard.
import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../lib/constants.js';

const T = {
  green: '#059669', greenBg: '#f0fdf4', border: '#f0ede8',
  text: '#1a1a18', textSm: '#5a5a58', textXs: '#9a9a98',
  blue: '#2563eb', amber: '#d97706', card: '#ffffff', bg: '#faf9f6',
};

const fmtDur = (seg) => {
  if (!seg || seg < 1) return '0s';
  if (seg < 60) return seg + 's';
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + s + 's' : '');
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
};

function Card({ label, value, sub, accent = T.border }) {
  return (
    <div style={{ position: 'relative', background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 11, color: T.textXs, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.text, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textSm, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function BarList({ title, rows, unit, accent = T.green }) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return (
    <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>{title}</div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: T.textXs, padding: '8px 0' }}>Sin datos todavía.</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.text, marginBottom: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>{r.k}</span>
            <span style={{ fontWeight: 700, color: T.textSm }}>{r.v}{unit ? ' ' + unit : ''}{r.seg != null ? ' · ' + fmtDur(r.seg) : ''}</span>
          </div>
          <div style={{ height: 7, background: T.greenBg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: (r.v / max * 100) + '%', height: '100%', background: accent, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(null);   // En vivo (Live View): se refresca solo cada 10s

  // Polling liviano del "En vivo" — independiente del rango de días. Pega a un
  // endpoint aparte que sólo mira los últimos minutos, así no pesa.
  useEffect(() => {
    let alive = true;
    const loadLive = async () => {
      try {
        const r = await fetch('/api/analytics-live', { headers: getAuthHeaders() });
        if (r.ok && alive) setLive(await r.json());
      } catch { /* silencioso: el panel en vivo es best-effort */ }
    };
    loadLive();
    const id = setInterval(loadLive, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/analytics?days=' + days, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error('http ' + r.status);
      setData(await r.json());
    } catch (e) {
      setErr('No se pudo cargar la analítica. ' + (e?.message || ''));
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const [exporting, setExporting] = useState(false);

  // Exportar a Excel (exceljs, estilo profesional Pazque). Import dinámico para
  // no sumar exceljs al bundle de la pestaña: sólo se baja al tocar Exportar.
  const descargarExcel = async () => {
    if (!data || data.pendingSetup || exporting) return;
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Pazque';
      const GREEN = 'FF059669', GREY = 'FF595959';
      const NUM = '#,##0', MONEY = '"$ "#,##0';
      const fillH = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      const border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }, left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      const headerRow = (ws, cells, r) => {
        const row = ws.getRow(r);
        cells.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v; c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = fillH; c.border = border; c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'center', wrapText: true };
        });
        row.height = 24;
      };
      const titulo = (ws, text, sub) => {
        ws.getCell('A1').value = text;
        ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: GREEN } };
        if (sub) { ws.getCell('A2').value = sub; ws.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: GREY } }; }
      };
      const dataRow = (ws, r, cells, fmts) => {
        const row = ws.getRow(r);
        cells.forEach((v, i) => {
          const c = row.getCell(i + 1);
          c.value = v; c.border = border; c.font = { name: 'Arial', size: 10 };
          c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'center' };
          if (fmts && fmts[i]) c.numFmt = fmts[i];
        });
      };
      const hoy = new Date().toLocaleDateString('es-UY');
      const sub = `Últimos ${days} días · portal de pedidos · generado ${hoy}`;

      const R = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
      R.columns = [{ width: 32 }, { width: 20 }];
      titulo(R, 'Analítica del portal', sub);
      let r = 4;
      headerRow(R, ['Métrica', 'Valor'], r); r++;
      const rs = data.resumen || {};
      [
        ['Visitas (sesiones)', rs.visitas ?? 0, NUM],
        ['Clientes activos', rs.clientesActivos ?? 0, NUM],
        ['Pedidos confirmados', rs.pedidos ?? 0, NUM],
        ['Tiempo medio por visita', fmtDur(rs.duracionMediaSeg), null],
        ['Productos vistos', rs.productosVistos ?? 0, NUM],
        ['Agregados al carrito', rs.productosAgregados ?? 0, NUM],
        ['Búsquedas', rs.busquedas ?? 0, NUM],
        ['Búsquedas sin resultado', rs.busquedasSin ?? 0, NUM],
      ].forEach(([l, v, fmt]) => { dataRow(R, r, [l, v], [null, fmt]); r++; });

      const E = wb.addWorksheet('Embudo', { views: [{ showGridLines: false }] });
      E.columns = [{ width: 24 }, { width: 16 }, { width: 16 }];
      titulo(E, 'Embudo de pedido', 'Visitas distintas que llegaron a cada paso. El % es sobre el paso anterior.');
      r = 4; headerRow(E, ['Paso', 'Visitas', 'Conversión'], r); r++;
      const fn = data.embudo || {};
      const steps = [
        ['Vio el catálogo', fn.catalogo || 0],
        ['Vio un producto', fn.productoVisto || 0],
        ['Agregó al carrito', fn.agregado || 0],
        ['Confirmó pedido', fn.pedido || 0],
      ];
      steps.forEach((s, i) => {
        const prev = i > 0 ? steps[i - 1][1] : s[1];
        const conv = i === 0 ? '' : (prev > 0 ? Math.round(s[1] / prev * 100) + '%' : '0%');
        dataRow(E, r, [s[0], s[1], conv], [null, NUM, null]); r++;
      });

      const SS = wb.addWorksheet('Sin resultado', { views: [{ showGridLines: false }] });
      SS.columns = [{ width: 40 }, { width: 14 }];
      titulo(SS, 'Búsquedas sin resultado', 'Lo que tus clientes buscaron y no estaba. Mercadería que podrías vender.');
      r = 4; headerRow(SS, ['Término buscado', 'Veces'], r); r++;
      const sinRes = data.busquedasSinResultado || [];
      if (!sinRes.length) { dataRow(SS, r, ['(sin huecos en este rango)', '']); r++; }
      sinRes.forEach((x) => { dataRow(SS, r, [x.k, x.v], [null, NUM]); r++; });

      const BQ = wb.addWorksheet('Búsquedas', { views: [{ showGridLines: false }] });
      BQ.columns = [{ width: 40 }, { width: 14 }];
      titulo(BQ, 'Búsquedas más frecuentes', sub);
      r = 4; headerRow(BQ, ['Término buscado', 'Veces'], r); r++;
      (data.busquedas || []).forEach((x) => { dataRow(BQ, r, [x.k, x.v], [null, NUM]); r++; });

      const P = wb.addWorksheet('Productos', { views: [{ showGridLines: false }] });
      P.columns = [{ width: 40 }, { width: 14 }];
      titulo(P, 'Productos', sub);
      r = 4;
      headerRow(P, ['Más vistos', 'Veces'], r); r++;
      (data.topProductos || []).forEach((x) => { dataRow(P, r, [x.k, x.v], [null, NUM]); r++; });
      r++;
      headerRow(P, ['Más agregados al carrito', 'Veces'], r); r++;
      (data.topAgregados || []).forEach((x) => { dataRow(P, r, [x.k, x.v], [null, NUM]); r++; });

      const V = wb.addWorksheet('Vendedor digital', { views: [{ showGridLines: false }] });
      V.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 10 }];
      const reco = data.recomendaciones || { porOrigen: [] };
      titulo(V, '¿Vende el vendedor digital?', `El portal vendió $ ${Number(reco.recoRevenuePedido || 0).toLocaleString('es-UY')} de más (en ${reco.pedidosConReco || 0} pedidos).`);
      r = 4; headerRow(V, ['Origen del agregado', 'Agregados', 'Mercadería', '¿Portal?'], r); r++;
      (reco.porOrigen || []).forEach((o) => { dataRow(V, r, [o.label, o.adds, o.revenue, o.esReco ? 'Sí' : ''], [null, NUM, MONEY, null]); r++; });

      const D = wb.addWorksheet('Visitas por día', { views: [{ showGridLines: false }] });
      D.columns = [{ width: 14 }, { width: 14 }, { width: 14 }];
      titulo(D, 'Visitas por día', sub);
      r = 4; headerRow(D, ['Día', 'Visitas', 'Pedidos'], r); r++;
      (data.porDia || []).forEach((d) => { dataRow(D, r, [d.dia, d.visitas, d.pedidos], [null, NUM, NUM]); r++; });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Analitica_portal_' + days + 'd_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr('No se pudo exportar el Excel. ' + (e?.message || ''));
    } finally { setExporting(false); }
  };

  const wrap = { padding: '8px 4px 40px', maxWidth: 1100 };
  const headRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 };

  return (
    <div style={wrap}>
      <div style={headRow}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Analítica web</h1>
          <p style={{ fontSize: 13, color: T.textSm, margin: '4px 0 0' }}>Cómo usan tus clientes el portal de pedidos.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid ' + (days === d ? T.green : T.border),
                background: days === d ? T.green : T.card, color: days === d ? '#fff' : T.textSm }}>
              {d} días
            </button>
          ))}
          <button onClick={descargarExcel} disabled={!data || data.pendingSetup || exporting}
            style={{ marginLeft: 4, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: (!data || data.pendingSetup || exporting) ? 'default' : 'pointer',
              border: '1px solid ' + T.green, background: T.card, color: T.green,
              opacity: (!data || data.pendingSetup) ? 0.5 : 1 }}>
            {exporting ? 'Generando…' : '↓ Exportar a Excel'}
          </button>
        </div>
      </div>

      {/* En vivo (Live View) — quién está en el portal ahora mismo. Se refresca
         solo cada 10s. Sólo se muestra si hay alguien, para no ocupar lugar vacío. */}
      {live && live.total > 0 && (
        <div style={{ background: T.card, border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.green, boxShadow: '0 0 0 4px #dcfce7' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>En vivo</span>
            <span style={{ fontSize: 13, color: T.textSm }}>
              {live.total} {live.total === 1 ? 'persona' : 'personas'} en el portal ahora
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {live.activos.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid ' + T.border }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.text, overflow: 'hidden' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px', color: a.logueado ? '#166534' : T.textSm, background: a.logueado ? '#dcfce7' : T.bg }}>
                    {a.logueado ? 'Cliente' : 'Visitante'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.accion}</span>
                </span>
                <span style={{ fontSize: 12, color: T.textXs, whiteSpace: 'nowrap' }}>
                  {a.haceSeg < 10 ? 'ahora' : 'hace ' + fmtDur(a.haceSeg)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.textXs }}>Cargando…</div>}
      {err && !loading && <div style={{ padding: 16, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, fontSize: 13 }}>{err}</div>}

      {!loading && !err && data?.pendingSetup && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Falta un paso para activar la analítica</div>
          <p style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.6, margin: 0 }}>
            La tabla de datos todavía no está creada en la base. Pegá el archivo <b>supabase-web-events.sql</b> en
            Supabase → SQL Editor → Run (una sola vez). Apenas esté, los clientes que entren al portal empezarán a
            sumar datos acá automáticamente.
          </p>
        </div>
      )}

      {!loading && !err && data && !data.pendingSetup && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
            <Card label="Visitas" value={data.resumen.visitas ?? 0} accent={T.green} sub="sesiones en el portal" />
            <Card label="Clientes activos" value={data.resumen.clientesActivos ?? 0} accent={T.blue} sub="entraron logueados" />
            <Card label="Pedidos" value={data.resumen.pedidos ?? 0} accent={T.green} sub="confirmados" />
            <Card label="Tiempo medio" value={fmtDur(data.resumen.duracionMediaSeg)} accent={T.amber} sub="por visita" />
            <Card label="Productos vistos" value={data.resumen.productosVistos ?? 0} accent={T.blue} />
            <Card label="Agregados" value={data.resumen.productosAgregados ?? 0} accent={T.green} sub="al carrito" />
            <Card label="Búsquedas" value={data.resumen.busquedas ?? 0} accent={T.amber} />
            {(data.resumen.busquedasSin ?? 0) > 0 && (
              <Card label="Sin resultado" value={data.resumen.busquedasSin} accent="#dc2626" sub="buscaron y no estaba" />
            )}
          </div>

          {/* Embudo de pedido */}
          <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>Embudo de pedido</div>
            <div style={{ fontSize: 12, color: T.textSm, marginBottom: 14 }}>Visitas distintas que llegaron a cada paso. El % es sobre las del paso anterior.</div>
            {(() => {
              const f = data.embudo || {};
              const steps = [
                { k: 'Vio el catálogo', v: f.catalogo || 0 },
                { k: 'Vio un producto', v: f.productoVisto || 0 },
                { k: 'Agregó al carrito', v: f.agregado || 0 },
                { k: 'Confirmó pedido', v: f.pedido || 0 },
              ];
              const top = Math.max(1, steps[0].v);
              return steps.map((s, i) => {
                const prev = i > 0 ? steps[i - 1].v : s.v;
                const conv = prev > 0 ? Math.round(s.v / prev * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.text, marginBottom: 4 }}>
                      <span>{s.k}</span>
                      <span style={{ fontWeight: 700 }}>{s.v}{i > 0 && <span style={{ color: T.textXs, fontWeight: 500, marginLeft: 6 }}>({conv}%)</span>}</span>
                    </div>
                    <div style={{ height: 22, background: T.bg, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: (s.v / top * 100) + '%', height: '100%', background: i === 3 ? T.green : T.blue, borderRadius: 6, transition: 'width .3s' }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Búsquedas sin resultados — huecos de catálogo (señal de plata estilo Shopify).
             Lo que tus clientes buscaron y NO encontraron: mercadería que podrías
             estar vendiendo. Sólo se muestra el panel si hay algo para mostrar. */}
          {(data.busquedasSinResultado || []).length > 0 && (() => {
            const rows = data.busquedasSinResultado;
            const max = Math.max(1, ...rows.map(r => r.v));
            return (
              <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid #fecaca', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Búsquedas sin resultado</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', borderRadius: 5, padding: '2px 7px' }}>hueco de catálogo</span>
                </div>
                <div style={{ fontSize: 12, color: T.textSm, marginBottom: 14 }}>
                  Lo que tus clientes buscaron en el portal y no encontraron. Es mercadería que podrías estar vendiendo: sumala al catálogo o ajustá el nombre si ya la tenés con otro.
                </div>
                {rows.map((r, i) => (
                  <div key={i} style={{ marginBottom: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.text, marginBottom: 4 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '74%' }}>“{r.k}”</span>
                      <span style={{ fontWeight: 700, color: T.textSm }}>{r.v} {r.v === 1 ? 'vez' : 'veces'}</span>
                    </div>
                    <div style={{ height: 7, background: '#fef2f2', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: (r.v / max * 100) + '%', height: '100%', background: '#dc2626', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ¿Vende el vendedor digital? — adds empujados por recomendaciones */}
          {(() => {
            const reco = data.recomendaciones || { porOrigen: [], totalAdds: 0, recoAdds: 0, recoRevenue: 0, recoSharePct: 0 };
            const max = Math.max(1, ...reco.porOrigen.map(o => o.adds));
            const money = (n) => '$ ' + Number(n || 0).toLocaleString('es-UY');
            return (
              <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>¿Vende el vendedor digital?</div>
                <div style={{ fontSize: 12, color: T.textSm, marginBottom: 14 }}>
                  De cada producto que el cliente suma al carrito, cuántos los empujó el portal (sugeridos, volver a comprar) vs. los buscó él solo.
                </div>
                {reco.recoRevenuePedido > 0 && (
                  <div style={{ background: T.green, borderRadius: 12, padding: '16px 18px', marginBottom: 16, color: '#fff' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, opacity: .92, marginBottom: 3 }}>El portal te vendió de más</div>
                    <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{money(reco.recoRevenuePedido)}</div>
                    <div style={{ fontSize: 11.5, opacity: .9, marginTop: 6 }}>
                      en mercadería que sugirió el portal y terminó en {reco.pedidosConReco} pedido{reco.pedidosConReco === 1 ? '' : 's'} confirmado{reco.pedidosConReco === 1 ? '' : 's'} ({reco.recoAddsPedido} producto{reco.recoAddsPedido === 1 ? '' : 's'}).
                    </div>
                  </div>
                )}
                {reco.totalAdds === 0 ? (
                  <div style={{ fontSize: 13, color: T.textXs, padding: '8px 0' }}>Sin datos todavía. Se empieza a medir desde ahora.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div style={{ flex: '1 1 140px', background: T.greenBg, borderRadius: 12, padding: '14px 16px', border: '1px solid #dcfce7' }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: T.green, lineHeight: 1 }}>{reco.recoSharePct}%</div>
                        <div style={{ fontSize: 12, color: T.textSm, marginTop: 5 }}>de los agregados los empujó el portal</div>
                      </div>
                      <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '14px 16px', border: '1px solid ' + T.border }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{reco.recoAdds}</div>
                        <div style={{ fontSize: 12, color: T.textSm, marginTop: 5 }}>agregados desde recomendaciones</div>
                      </div>
                      <div style={{ flex: '1 1 140px', background: T.bg, borderRadius: 12, padding: '14px 16px', border: '1px solid ' + T.border }}>
                        <div style={{ fontSize: 30, fontWeight: 800, color: T.text, lineHeight: 1 }}>{money(reco.recoRevenue)}</div>
                        <div style={{ fontSize: 12, color: T.textSm, marginTop: 5 }}>en mercadería que sugirió el portal</div>
                      </div>
                    </div>
                    {reco.porOrigen.map((o, i) => (
                      <div key={i} style={{ marginBottom: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.text, marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {o.label}
                            {o.esReco && <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenBg, borderRadius: 5, padding: '1px 6px' }}>portal</span>}
                          </span>
                          <span style={{ fontWeight: 700, color: T.textSm }}>{o.adds} · {money(o.revenue)}</span>
                        </div>
                        <div style={{ height: 7, background: T.bg, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: (o.adds / max * 100) + '%', height: '100%', background: o.esReco ? T.green : '#cbd5d0', borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}

          {/* Visitas por día */}
          <div style={{ background: T.card, padding: '18px 20px', borderRadius: 14, border: '1px solid ' + T.border, boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Visitas por día</div>
            {(!data.porDia || data.porDia.length === 0)
              ? <div style={{ fontSize: 13, color: T.textXs }}>Sin datos todavía.</div>
              : (() => {
                const max = Math.max(1, ...data.porDia.map(d => d.visitas));
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, overflowX: 'auto' }}>
                    {data.porDia.map((d, i) => (
                      <div key={i} title={d.dia + ': ' + d.visitas + ' visitas, ' + d.pedidos + ' pedidos'}
                        style={{ flex: '1 0 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', maxWidth: 26, height: (d.visitas / max * 90 + 4) + 'px', background: d.pedidos > 0 ? T.green : '#cbd5d0', borderRadius: '4px 4px 0 0' }} />
                        <span style={{ fontSize: 9, color: T.textXs, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.dia.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            <div style={{ fontSize: 11, color: T.textXs, marginTop: 8 }}>Verde = hubo pedidos ese día.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <BarList title="Productos más vistos" rows={data.topProductos || []} accent={T.blue} />
            <BarList title="Más agregados al carrito" rows={data.topAgregados || []} accent={T.green} />
            <BarList title="Pantallas más usadas" rows={data.topPaginas || []} accent={T.amber} />
            <BarList title="Búsquedas más frecuentes" rows={data.busquedas || []} accent={T.blue} />
          </div>

          {data.rango?.sampled && (
            <div style={{ fontSize: 11, color: T.textXs, marginTop: 14 }}>
              * Mostrando una muestra de los eventos más recientes (hay mucho volumen en este rango).
            </div>
          )}
        </>
      )}
    </div>
  );
}
