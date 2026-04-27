/**
 * GeneradorRuta — Modal para generar rutas automáticamente desde ventas pendientes.
 *
 * Flujo:
 *  1. Usuario elige fecha y vehículo (con capacidad)
 *  2. Sistema busca ventas confirmadas/preparadas de esa fecha
 *  3. Calcula peso/bultos estimados por parada
 *  4. Avisa si supera la capacidad del camión
 *  5. Geocodifica direcciones (Nominatim, async)
 *  6. Corre nearestNeighborTSP con ventanas horarias
 *  7. Muestra preview ordenado para confirmar o ajustar
 *  8. Crea la ruta en Supabase
 */

import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { db, getOrgId } from '../lib/constants.js';

const G   = '#059669';
const AMB = '#d97706';
const RED = '#dc2626';

// ── Haversine (km) ──────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nearest-Neighbor TSP con ventanas horarias ──────────────────────────────
function nearestNeighborTSP(paradas, clientes) {
  const toMins = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const withCoords = paradas.map(p => {
    const cli = clientes.find(c => c.id === p.clienteId);
    return {
      ...p,
      lat:     cli?.lat     ?? null,
      lng:     cli?.lng     ?? null,
      winFrom: toMins(p.horarioDesde || cli?.horarioDesde),
      winTo:   toMins(p.horarioHasta || cli?.horarioHasta),
    };
  });

  const geo   = withCoords.filter(p => p.lat !== null && p.lng !== null);
  const nogeo = withCoords.filter(p => p.lat === null || p.lng === null);

  if (geo.length <= 1) {
    return withCoords.map(({ lat: _l, lng: _g, winFrom: _f, winTo: _t, ...rest }) => rest);
  }

  // Greedy nearest-neighbor
  const visited = new Array(geo.length).fill(false);
  const ordered = [];
  let current = 0;
  visited[0] = true; ordered.push(geo[0]);

  for (let step = 1; step < geo.length; step++) {
    let nearest = -1, minDist = Infinity;
    for (let j = 0; j < geo.length; j++) {
      if (visited[j]) continue;
      const d = haversine(geo[current].lat, geo[current].lng, geo[j].lat, geo[j].lng);
      if (d < minDist) { minDist = d; nearest = j; }
    }
    visited[nearest] = true;
    ordered.push(geo[nearest]);
    current = nearest;
  }

  // Respetar ventanas horarias
  const MINS_PER_STOP = 12; // 12 min promedio por parada en Montevideo/interior UY
  const startMins = new Date().getHours() * 60 + new Date().getMinutes();

  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    if (stop.winFrom === null && stop.winTo === null) continue;
    const arrival = startMins + i * MINS_PER_STOP;
    const tooEarly = stop.winFrom !== null && arrival < stop.winFrom;
    const tooLate  = stop.winTo   !== null && arrival > stop.winTo;
    if (!tooEarly && !tooLate) continue;
    let bestPos = i;
    for (let j = i; j < ordered.length; j++) {
      const arr = startMins + j * MINS_PER_STOP;
      if ((stop.winFrom === null || arr >= stop.winFrom) && (stop.winTo === null || arr <= stop.winTo)) {
        bestPos = j; break;
      }
    }
    if (bestPos !== i) { ordered.splice(i, 1); ordered.splice(bestPos, 0, stop); }
  }

  const clean = ({ lat: _l, lng: _g, winFrom: _f, winTo: _t, ...rest }) => rest;
  return [...ordered.map(clean), ...nogeo.map(clean)];
}

// ── Geocoder (Nominatim / OpenStreetMap — gratis, sin API key) ──────────────
async function geocodeCliente(cli) {
  if (cli.lat && cli.lng) return { lat: cli.lat, lng: cli.lng };
  const q = [cli.direccion, cli.ciudad, 'Uruguay'].filter(Boolean).join(', ');
  if (!q.trim()) return null;
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'Pazque/1.0' } }
    );
    const data = await res.json();
    if (data?.length > 0) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch { /* silent */ }
  return null;
}

// ── Estimar peso/bultos desde items de la venta ─────────────────────────────
function estimarCarga(venta, products) {
  const items = venta.items || [];
  let pesoKg  = 0;
  let bultos  = 0;

  items.forEach(it => {
    const prod = products.find(p => p.id === it.productoId || p.name === it.nombre);
    const qty  = Number(it.cantidad || 0);
    // Si el producto tiene peso definido, usarlo; si no, estimación por unidad
    const pesoUnit = prod?.pesoKg || prod?.peso_kg || (prod?.unit === 'kg' ? 1 : 0.5);
    pesoKg += qty * pesoUnit;
    bultos += Math.ceil(qty / 10); // 1 bulto cada 10 unidades como referencia
  });

  // Mínimo 1 bulto si hay items
  if (items.length > 0 && bultos === 0) bultos = 1;
  return { pesoKg: Math.round(pesoKg * 10) / 10, bultos: Math.max(bultos, 1) };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function GeneradorRuta({ onClose, onCreada }) {
  const { ventas, clientes, rutas, setRutas, products } = useApp();

  // Estado del wizard
  const [paso,        setPaso]        = useState(1); // 1=config, 2=preview, 3=done
  const [fechaSel,    setFechaSel]    = useState(new Date().toISOString().split('T')[0]);
  const [vehiculo,    setVehiculo]    = useState('');
  const [zona,        setZona]        = useState('');
  const [capKg,       setCapKg]       = useState('');
  const [capBultos,   setCapBultos]   = useState('');
  const [estadosFilt, setEstadosFilt] = useState(['confirmada', 'preparada']);
  const [geocodState, setGeocodState] = useState('idle'); // idle | running | done
  const [geocodLog,   setGeocodLog]   = useState('');
  const [paradas,     setParadas]     = useState([]); // resultado final ordenado
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState('');

  // Ventas candidatas (del día seleccionado con los estados elegidos)
  const ventasCandidatas = useMemo(() => {
    return ventas.filter(v => {
      const fecha = (v.fecha || v.creadoEn || '').split('T')[0];
      return fecha === fechaSel && estadosFilt.includes(v.estado) && v.clienteId;
    });
  }, [ventas, fechaSel, estadosFilt]);

  // Paradas brutas (antes de geocodificar y ordenar)
  const paradasBrutas = useMemo(() => {
    // Agrupar por cliente (un cliente puede tener varias ventas del día)
    const byCliente = {};
    ventasCandidatas.forEach(v => {
      if (!byCliente[v.clienteId]) {
        const cli = clientes.find(c => c.id === v.clienteId);
        byCliente[v.clienteId] = {
          clienteId:     v.clienteId,
          clienteNombre: v.clienteNombre || cli?.nombre || '?',
          ciudad:        cli?.ciudad || '',
          telefono:      cli?.telefono || '',
          direccion:     cli?.direccion || '',
          horarioDesde:  cli?.horarioDesde || '',
          horarioHasta:  cli?.horarioHasta || '',
          estado:        'pendiente',
          hora: '', nota: '', foto: '',
          ventas:        [],
          pesoKg:        0,
          bultos:        0,
        };
      }
      const carga = estimarCarga(v, products);
      byCliente[v.clienteId].ventas.push(v.nroVenta || v.id);
      byCliente[v.clienteId].pesoKg  += carga.pesoKg;
      byCliente[v.clienteId].bultos  += carga.bultos;
    });
    return Object.values(byCliente);
  }, [ventasCandidatas, clientes, products]);

  // Totales de carga
  const totalKg     = paradasBrutas.reduce((a, p) => a + (p.pesoKg || 0), 0);
  const totalBultos = paradasBrutas.reduce((a, p) => a + (p.bultos || 0), 0);
  const capKgNum    = Number(capKg)    || 0;
  const capBulNum   = Number(capBultos) || 0;
  const superaKg    = capKgNum  > 0 && totalKg     > capKgNum;
  const superaBul   = capBulNum > 0 && totalBultos > capBulNum;
  const superaCap   = superaKg || superaBul;

  // ── Paso 1→2: geocodificar y ordenar ────────────────────────────────────
  const generarPreview = useCallback(async () => {
    if (!vehiculo.trim()) { setMsg('Ingresá el vehículo'); return; }
    if (paradasBrutas.length === 0) { setMsg('No hay ventas para esa fecha y estado'); return; }
    setMsg('');
    setGeocodState('running');
    setGeocodLog('Iniciando geocodificación...');
    setPaso(2);

    // Geocodificar clientes que no tienen coords
    const clientesActualizados = [...clientes];
    let geocodOk = 0, geocodFail = 0;

    for (let i = 0; i < paradasBrutas.length; i++) {
      const p   = paradasBrutas[i];
      const idx = clientesActualizados.findIndex(c => c.id === p.clienteId);
      if (idx === -1) continue;
      const cli = clientesActualizados[idx];

      if (!cli.lat || !cli.lng) {
        setGeocodLog(`Geocodificando ${i + 1}/${paradasBrutas.length}: ${p.clienteNombre}...`);
        const coords = await geocodeCliente(cli);
        if (coords) {
          clientesActualizados[idx] = { ...cli, ...coords };
          // Persistir coords en Supabase para que la próxima vez sea inmediato
          db.patch('clients', { lat: coords.lat, lng: coords.lng }, { id: cli.id }).catch(() => {});
          geocodOk++;
        } else {
          geocodFail++;
        }
        await new Promise(r => setTimeout(r, 300)); // respetar rate limit de Nominatim
      } else {
        geocodOk++;
      }
    }

    setGeocodLog(`Geocodificación: ${geocodOk} OK, ${geocodFail} sin ubicación. Ordenando ruta...`);

    // Correr TSP
    const ordenadas = nearestNeighborTSP(paradasBrutas, clientesActualizados);
    setParadas(ordenadas);
    setGeocodState('done');
    setGeocodLog(`✓ Ruta optimizada — ${ordenadas.length} paradas en orden`);
  }, [vehiculo, paradasBrutas, clientes]);

  // ── Paso 2→3: crear la ruta en Supabase ─────────────────────────────────
  const crearRuta = async () => {
    setSaving(true);
    const nueva = {
      id:              crypto.randomUUID(),
      vehiculo:        vehiculo.trim(),
      zona:            zona.trim() || 'General',
      dia:             fechaSel,
      notas:           `Generada automáticamente desde ${ventasCandidatas.length} venta(s)`,
      entregas:        paradas,
      creadoEn:        new Date().toISOString(),
      capacidadKg:     capKgNum,
      capacidadBultos: capBulNum,
    };

    setRutas(prev => [nueva, ...prev]);

    try {
      await db.upsert('rutas', {
        id:               nueva.id,
        vehiculo:         nueva.vehiculo,
        zona:             nueva.zona,
        dia:              nueva.dia,
        notas:            nueva.notas,
        entregas:         nueva.entregas,
        capacidad_kg:     nueva.capacidadKg,
        capacidad_bultos: nueva.capacidadBultos,
        creado_en:        nueva.creadoEn,
        updated_at:       nueva.creadoEn,
      }, 'id');
    } catch (e) {
      console.warn('[GeneradorRuta] upsert failed:', e?.message);
    }

    setSaving(false);
    setPaso(3);
    onCreada?.(nueva);
  };

  const inp = {
    padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', background: '#fff',
  };

  const fmtHora = t => t ? t.substring(0, 5) : '—';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.48)', zIndex: 9100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680,
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.22)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Generador automático de ruta
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {paso === 1 ? 'Paso 1 — Configurar fecha y vehículo'
               : paso === 2 ? 'Paso 2 — Preview y confirmación'
               : 'Ruta creada ✓'}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ── PASO 1: configuración ── */}
          {paso === 1 && (
            <div style={{ display: 'grid', gap: 20 }}>

              {/* Fecha */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                  Fecha de entrega
                </label>
                <input type="date" value={fechaSel} onChange={e => setFechaSel(e.target.value)} style={{ ...inp, width: 200 }} />
              </div>

              {/* Estados a incluir */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 8 }}>
                  Estados de venta a incluir
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['confirmada', 'preparada', 'pendiente'].map(est => (
                    <label key={est} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      padding: '7px 14px', borderRadius: 20,
                      border: `2px solid ${estadosFilt.includes(est) ? G : '#e5e7eb'}`,
                      background: estadosFilt.includes(est) ? '#f0fdf4' : '#fff',
                      fontSize: 13, fontWeight: 600, color: estadosFilt.includes(est) ? G : '#6b7280',
                    }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={estadosFilt.includes(est)}
                        onChange={() => setEstadosFilt(prev =>
                          prev.includes(est) ? prev.filter(e => e !== est) : [...prev, est]
                        )}
                      />
                      {est.charAt(0).toUpperCase() + est.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Vehículo y zona */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                    Vehículo *
                  </label>
                  <input value={vehiculo} onChange={e => setVehiculo(e.target.value)}
                    placeholder='Ej: Kangoo ABC 1234' style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                    Zona
                  </label>
                  <input value={zona} onChange={e => setZona(e.target.value)}
                    placeholder='Ej: Montevideo Norte' style={inp} />
                </div>
              </div>

              {/* Capacidad */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 8 }}>
                  Capacidad del camión (opcional — para detectar sobrecarga)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <input type="number" value={capKg} onChange={e => setCapKg(e.target.value)}
                      placeholder='Máx kg (ej: 600)' style={inp} min="0" />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Capacidad en kg</div>
                  </div>
                  <div>
                    <input type="number" value={capBultos} onChange={e => setCapBultos(e.target.value)}
                      placeholder='Máx bultos (ej: 80)' style={inp} min="0" />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Capacidad en bultos</div>
                  </div>
                </div>
              </div>

              {/* Resumen de ventas encontradas */}
              {ventasCandidatas.length > 0 ? (
                <div style={{
                  background: superaCap ? '#fef3c7' : '#f0fdf4',
                  border: `1px solid ${superaCap ? '#fde68a' : '#bbf7d0'}`,
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: superaCap ? AMB : G, marginBottom: 10 }}>
                    {superaCap ? '⚠️' : '✓'} {ventasCandidatas.length} venta{ventasCandidatas.length !== 1 ? 's' : ''} encontrada{ventasCandidatas.length !== 1 ? 's' : ''} — {paradasBrutas.length} parada{paradasBrutas.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Paradas', valor: paradasBrutas.length, sub: 'clientes únicos' },
                      { label: 'Peso estimado', valor: `${Math.round(totalKg)} kg`, sub: capKgNum > 0 ? `cap: ${capKgNum} kg${superaKg ? ' ⚠️' : ''}` : 'sin límite', alert: superaKg },
                      { label: 'Bultos estimados', valor: totalBultos, sub: capBulNum > 0 ? `cap: ${capBulNum}${superaBul ? ' ⚠️' : ''}` : 'sin límite', alert: superaBul },
                    ].map(kpi => (
                      <div key={kpi.label} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: `1px solid ${kpi.alert ? '#fde68a' : '#e5e7eb'}` }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{kpi.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: kpi.alert ? AMB : G }}>{kpi.valor}</div>
                        <div style={{ fontSize: 11, color: kpi.alert ? AMB : '#9ca3af' }}>{kpi.sub}</div>
                      </div>
                    ))}
                  </div>
                  {superaCap && (
                    <div style={{ marginTop: 12, fontSize: 12, color: AMB, fontWeight: 600 }}>
                      La carga estimada supera la capacidad del vehículo. Podés continuar igual o ajustar la selección.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#f9fafb', borderRadius: 12, padding: '20px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  Sin ventas {estadosFilt.join('/')} para el {new Date(fechaSel + 'T12:00:00').toLocaleDateString('es')}
                </div>
              )}

              {msg && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: RED, fontWeight: 600 }}>
                  ⚠️ {msg}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: preview ── */}
          {paso === 2 && (
            <div>
              {/* Log de geocodificación */}
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12,
                background: geocodState === 'done' ? '#f0fdf4' : '#eff6ff',
                border: `1px solid ${geocodState === 'done' ? '#bbf7d0' : '#bfdbfe'}`,
                color: geocodState === 'done' ? G : '#1d4ed8', fontWeight: 600,
              }}>
                {geocodState === 'running' && <span style={{ marginRight: 8 }}>⏳</span>}
                {geocodLog}
              </div>

              {/* Tabla de paradas ordenadas */}
              {paradas.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'flex', gap: 16 }}>
                    <span style={{ width: 24 }}>#</span>
                    <span style={{ flex: 1 }}>Cliente</span>
                    <span style={{ width: 80 }}>Horario</span>
                    <span style={{ width: 80 }}>Carga</span>
                    <span style={{ width: 60 }}>Ventas</span>
                  </div>
                  {paradas.map((p, i) => (
                    <div key={p.clienteId} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px',
                      borderBottom: i < paradas.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                    }}>
                      <span style={{ width: 24, fontSize: 13, fontWeight: 800, color: G }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.clienteNombre}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.ciudad}</div>
                      </div>
                      <span style={{ width: 80, fontSize: 12, color: '#6b7280' }}>
                        {p.horarioDesde ? `${fmtHora(p.horarioDesde)}–${fmtHora(p.horarioHasta)}` : '—'}
                      </span>
                      <span style={{ width: 80, fontSize: 12, color: '#6b7280' }}>
                        {p.pesoKg > 0 ? `${p.pesoKg}kg` : ''}{p.pesoKg > 0 && p.bultos > 0 ? ' · ' : ''}{p.bultos > 0 ? `${p.bultos}b` : '—'}
                      </span>
                      <span style={{ width: 60, fontSize: 11, color: '#9ca3af' }}>
                        {p.ventas?.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {geocodState === 'running' && paradas.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
                  Calculando ruta óptima...
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3: done ── */}
          {paso === 3 && (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚚</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>
                ¡Ruta creada!
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                {paradas.length} paradas optimizadas para {vehiculo}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                Encontrala en la lista de rutas para asignar el repartidor
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px', borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {paso === 1 && ventasCandidatas.length > 0 && `${paradasBrutas.length} parada${paradasBrutas.length !== 1 ? 's' : ''} · ${Math.round(totalKg)} kg estimados`}
            {paso === 2 && geocodState === 'done' && `${paradas.length} paradas ordenadas`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {paso === 1 && (
              <>
                <button onClick={onClose}
                  style={{ padding: '9px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  Cancelar
                </button>
                <button onClick={generarPreview} disabled={ventasCandidatas.length === 0}
                  style={{
                    padding: '9px 22px',
                    background: ventasCandidatas.length === 0 ? '#e5e7eb' : G,
                    color: ventasCandidatas.length === 0 ? '#9ca3af' : '#fff',
                    border: 'none', borderRadius: 8,
                    cursor: ventasCandidatas.length === 0 ? 'default' : 'pointer',
                    fontWeight: 700, fontSize: 13,
                  }}>
                  Calcular ruta →
                </button>
              </>
            )}
            {paso === 2 && (
              <>
                <button onClick={() => setPaso(1)}
                  style={{ padding: '9px 18px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  ← Volver
                </button>
                <button onClick={crearRuta}
                  disabled={saving || geocodState !== 'done'}
                  style={{
                    padding: '9px 22px',
                    background: saving || geocodState !== 'done' ? '#9ca3af' : G,
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: saving || geocodState !== 'done' ? 'default' : 'pointer',
                    fontWeight: 700, fontSize: 13,
                  }}>
                  {saving ? 'Guardando...' : `✓ Crear ruta (${paradas.length} paradas)`}
                </button>
              </>
            )}
            {paso === 3 && (
              <button onClick={onClose}
                style={{ padding: '9px 22px', background: G, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Ir a la ruta →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
