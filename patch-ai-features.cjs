#!/usr/bin/env node
// patch-ai-features.cjs — AI daily insight (dashboard) + anomaly detection (ventas)

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// 1. AI DAILY INSIGHT — Dashboard card
// ═══════════════════════════════════════════════════════════════

const dashPath = path.join(process.cwd(), 'src/tabs/DashboardInline.jsx');
let dash = fs.readFileSync(dashPath, 'utf8');

if (dash.includes('AiInsight')) {
  console.log('⏭  DashboardInline.jsx: AI insight already exists');
} else {
  // Add the AiInsight component before the export
  const aiInsightComponent = `
// ── AI Daily Insight ──────────────────────────────────────────────
function AiInsight({ ventas, products, cfes, clientes, session }) {
  const [insight, setInsight] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const fetched = React.useRef(false);

  React.useEffect(() => {
    if (fetched.current || !session?.access_token || !ventas?.length) return;
    fetched.current = true;
    setLoading(true);

    const hoy = new Date();
    const ayer = new Date(hoy - 86400000);
    const hace7 = new Date(hoy - 7 * 86400000);
    const hace30 = new Date(hoy - 30 * 86400000);

    const ventasAyer = ventas.filter(v => { const d = new Date(v.creadoEn); return d >= ayer && d < hoy && v.estado !== 'cancelada'; });
    const ventas7d = ventas.filter(v => { const d = new Date(v.creadoEn); return d >= hace7 && v.estado !== 'cancelada'; });
    const ventas30d = ventas.filter(v => { const d = new Date(v.creadoEn); return d >= hace30 && v.estado !== 'cancelada'; });
    const totalAyer = ventasAyer.reduce((s, v) => s + Number(v.total || 0), 0);
    const total7d = ventas7d.reduce((s, v) => s + Number(v.total || 0), 0);
    const promDiario7d = total7d / 7;
    const enCero = (products || []).filter(p => Number(p.stock) <= 0);
    const bajMin = (products || []).filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock || 0));
    const deuda = (cfes || []).filter(f => ['emitida','cobrado_parcial'].includes(f.status))
      .reduce((s, f) => s + (f.saldoPendiente || f.total || 0), 0);

    const clientesFrecuencia = {};
    ventas.filter(v => v.clienteId && v.estado !== 'cancelada').forEach(v => {
      if (!clientesFrecuencia[v.clienteId]) clientesFrecuencia[v.clienteId] = [];
      clientesFrecuencia[v.clienteId].push(new Date(v.creadoEn));
    });
    const clientesInactivos = [];
    Object.entries(clientesFrecuencia).forEach(([id, fechas]) => {
      if (fechas.length < 2) return;
      fechas.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < fechas.length; i++) intervals.push((fechas[i] - fechas[i-1]) / 86400000);
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const diasDesdeUltima = (hoy - fechas[fechas.length - 1]) / 86400000;
      if (diasDesdeUltima > avgInterval * 1.2) {
        const cli = (clientes || []).find(c => c.id === id);
        if (cli) clientesInactivos.push({ nombre: cli.nombre, dias: Math.round(diasDesdeUltima), ciclo: Math.round(avgInterval) });
      }
    });

    const dataStr = [
      'Ventas ayer: ' + ventasAyer.length + ' ordenes, U$S ' + Math.round(totalAyer),
      'Promedio diario 7d: U$S ' + Math.round(promDiario7d),
      'Ventas 30d: ' + ventas30d.length + ' ordenes, U$S ' + Math.round(ventas30d.reduce((s, v) => s + Number(v.total || 0), 0)),
      'Productos en stock cero: ' + enCero.length,
      'Productos bajo minimo: ' + bajMin.length,
      bajMin.length > 0 ? 'Bajo minimo: ' + bajMin.slice(0, 5).map(p => p.name).join(', ') : '',
      'Deuda pendiente de cobro: U$S ' + Math.round(deuda),
      clientesInactivos.length > 0 ? 'Clientes inactivos: ' + clientesInactivos.slice(0, 3).map(c => c.nombre + ' (' + c.dias + ' dias sin pedir, ciclo ' + c.ciclo + 'd)').join('; ') : 'Sin clientes inactivos',
      'Total clientes: ' + (clientes || []).length,
      'Total productos: ' + (products || []).length,
    ].filter(Boolean).join('\\n');

    const token = session.access_token;
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        system: 'Sos el copiloto AI de una distribuidora B2B. Analizas los datos del dia y das un resumen breve y accionable en español rioplatense. Maximo 4 lineas cortas. No uses markdown ni asteriscos. Empeza directo con lo mas importante. Si hay algo urgente (stock en cero, clientes inactivos, caida de ventas) mencionalo primero. Si todo esta bien, decilo en una linea.',
        messages: [{ role: 'user', content: 'Datos de hoy:\\n' + dataStr + '\\n\\nDame el resumen del dia en 4 lineas maximo.' }],
        max_tokens: 300,
      }),
    })
    .then(r => r.json())
    .then(data => {
      const text = data?.content?.[0]?.text || '';
      if (text) setInsight(text);
      else setError(true);
    })
    .catch(() => setError(true))
    .finally(() => setLoading(false));
  }, [ventas, products, cfes, clientes, session]);

  if (error || (!loading && !insight)) return null;

  return React.createElement('div', {
    style: {
      background: 'linear-gradient(135deg, #f0f7ec 0%, #e8f5e0 100%)',
      border: '1px solid #c8e6b8',
      borderRadius: 12, padding: '16px 20px', marginBottom: 20,
    }
  },
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }
    },
      React.createElement('span', { style: { fontSize: 16 } }, '🤖'),
      React.createElement('span', {
        style: { fontSize: 12, fontWeight: 700, color: '#2d6a1e', letterSpacing: '0.08em', textTransform: 'uppercase' }
      }, 'Copiloto AI'),
    ),
    loading
      ? React.createElement('div', { style: { fontSize: 13, color: '#4a7a3a', fontStyle: 'italic' } }, 'Analizando tu operación...')
      : React.createElement('div', { style: { fontSize: 13, color: '#2a5a1a', lineHeight: 1.6, whiteSpace: 'pre-line' } }, insight)
  );
}

`;

  // Insert before export default
  const exportAnchor = 'export default function DashboardInline';
  if (dash.includes(exportAnchor)) {
    dash = dash.replace(exportAnchor, aiInsightComponent + exportAnchor);
    console.log('✅ DashboardInline.jsx: added AiInsight component');
  }

  // Insert the AiInsight card in the dashboard after SetupChecklist
  const checklistAnchor = '<SetupChecklist products={products} setTab={setTab} />';
  if (dash.includes(checklistAnchor)) {
    dash = dash.replace(
      checklistAnchor,
      checklistAnchor + '\n\n      <AiInsight ventas={ventas} products={products} cfes={cfes} clientes={clientes} session={session} />'
    );
    console.log('✅ DashboardInline.jsx: inserted AiInsight card');
  }

  // Make sure session is passed to DashboardInline — check the props
  if (!dash.includes('session') || dash.match(/function DashboardInline\(\{[^}]*session/)) {
    console.log('✅ DashboardInline.jsx: session prop already available');
  } else {
    // Need to check if session is in the destructured props
    const funcMatch = dash.match(/export default function DashboardInline\(\{([^}]+)\}\)/);
    if (funcMatch && !funcMatch[1].includes('session')) {
      dash = dash.replace(
        funcMatch[0],
        funcMatch[0].replace(funcMatch[1], funcMatch[1] + ', session')
      );
      console.log('✅ DashboardInline.jsx: added session to props');
    }
  }

  fs.writeFileSync(dashPath, dash, 'utf8');
}

// Check if session is passed from App.jsx to DashboardInline
const appPath = path.join(process.cwd(), 'src/App.jsx');
let app = fs.readFileSync(appPath, 'utf8');
if (app.includes('<DashboardInline') && !app.includes('DashboardInline') === false) {
  // Find the DashboardInline usage and check for session prop
  const dashUsage = app.match(/<DashboardInline[^/]*\/>/s);
  if (dashUsage && !dashUsage[0].includes('session=')) {
    app = app.replace(
      dashUsage[0],
      dashUsage[0].replace('/>', ' session={session}/>')
    );
    fs.writeFileSync(appPath, app, 'utf8');
    console.log('✅ App.jsx: passed session prop to DashboardInline');
  } else {
    console.log('⏭  App.jsx: session already passed to DashboardInline or not found');
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. ANOMALY DETECTION — VentasTab
// ═══════════════════════════════════════════════════════════════

const ventasPath = path.join(process.cwd(), 'src/tabs/VentasTab.jsx');
let vtas = fs.readFileSync(ventasPath, 'utf8');

if (vtas.includes('anomaly') || vtas.includes('detectAnomaly')) {
  console.log('⏭  VentasTab.jsx: anomaly detection already exists');
} else {
  // Add anomaly detection function
  const anomalyFn = `
  // ── AI Anomaly Detection ──────────────────────────────────────
  const detectAnomalies = (items, clienteId, descuento) => {
    const warnings = [];

    // 1. Unusual discount
    const desc = Number(descuento || 0);
    if (desc > 20) warnings.push('Descuento de ' + desc + '% — mayor al 20% habitual');

    // 2. Unusual quantity per item
    items.forEach(it => {
      const prod = products.find(p => p.id === it.productoId);
      if (!prod) return;
      // Check if quantity is much higher than typical
      const avgQty = ventas
        .filter(v => v.estado !== 'cancelada' && v.items?.some(vi => vi.productoId === it.productoId))
        .flatMap(v => v.items.filter(vi => vi.productoId === it.productoId))
        .map(vi => Number(vi.cantidad || 0));
      if (avgQty.length >= 3) {
        const avg = avgQty.reduce((a, b) => a + b, 0) / avgQty.length;
        if (Number(it.cantidad) > avg * 3 && avg > 0) {
          warnings.push(it.nombre + ': ' + it.cantidad + ' unidades — el promedio historico es ' + Math.round(avg));
        }
      }
    });

    // 3. New client with large order
    if (clienteId) {
      const clienteVentas = ventas.filter(v => v.clienteId === clienteId && v.estado !== 'cancelada');
      if (clienteVentas.length === 0) {
        const total = items.reduce((s, it) => s + Number(it.cantidad || 0) * Number(it.precio || 0), 0);
        if (total > 500) warnings.push('Cliente nuevo con pedido de U$S ' + Math.round(total) + ' — verificá los datos');
      }
    }

    return warnings;
  };

`;

  // Insert the function inside the component, after the state declarations
  const stateAnchor = 'const guardarVenta=async()=>{';
  if (vtas.includes(stateAnchor)) {
    vtas = vtas.replace(stateAnchor, anomalyFn + '  ' + stateAnchor);
    console.log('✅ VentasTab.jsx: added detectAnomalies function');

    // Insert anomaly check BEFORE the stock validation in guardarVenta
    const stockValidation = '// STOCK VALIDATION at save time';
    const anomalyCheck = `// AI ANOMALY DETECTION — warn about unusual patterns
    const anomalies = detectAnomalies(form.items, form.clienteId, form.descuento);
    if (anomalies.length > 0) {
      const proceed = window.confirm(
        '⚠️ Se detectaron patrones inusuales:\\n\\n' +
        anomalies.map(a => '• ' + a).join('\\n') +
        '\\n\\n¿Confirmar venta de todas formas?'
      );
      if (!proceed) return;
    }

    `;

    vtas = vtas.replace(stockValidation, anomalyCheck + stockValidation);
    console.log('✅ VentasTab.jsx: inserted anomaly check before save');
  }

  fs.writeFileSync(ventasPath, vtas, 'utf8');
}

console.log(\`
══════════════════════════════════════════════
✅ AI features patched!

  1. COPILOTO AI (Dashboard)
     - Card verde en el dashboard
     - Analiza ventas, stock, deuda, clientes inactivos
     - Genera resumen en 4 lineas con Claude
     - Se carga automaticamente al abrir el dashboard

  2. DETECCION DE ANOMALIAS (Ventas)
     - Antes de guardar una venta, chequea:
       • Descuento mayor a 20%
       • Cantidad 3x mayor al promedio historico
       • Cliente nuevo con pedido grande (+U\$S 500)
     - Muestra alerta con los warnings
     - El usuario puede confirmar o cancelar

══════════════════════════════════════════════\`);
