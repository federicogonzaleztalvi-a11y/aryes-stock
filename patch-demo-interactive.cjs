// patch-demo-interactive.cjs
// Makes demo mode interactive: create venta, transition states — all in memory
// ONLY adds isDemoMode guards BEFORE RPC calls. Zero production code changes.

const fs = require('fs');
const path = require('path');

const VENTAS_PATH = path.join(__dirname, 'src', 'tabs', 'VentasTab.jsx');

let src = fs.readFileSync(VENTAS_PATH, 'utf8');
const original = src;
let changes = 0;

// ═══════════════════════════════════════════════════════════════════════
// 1. DEMO BYPASS for create_venta RPC (guardarVenta function)
//    Insert BEFORE the try { callRpc('create_venta'... block
//    This skips the RPC entirely in demo mode — venta is already in
//    optimistic state (products deducted, venta object built)
// ═══════════════════════════════════════════════════════════════════════

const CREATE_ANCHOR = `      // ── Atomic DB write via create_venta RPC ──────────────────────────────`;

const DEMO_CREATE_BYPASS = `      // ── DEMO MODE: skip RPC, just commit optimistic state ────────────────
      if (isDemoMode) {
        console.debug('[VentasTab] demo mode — skipping create_venta RPC');
        const upd = [venta, ...ventas];
        setVentas(upd);
        // Generate demo CFE
        const demoIva = Math.round(venta.total * 0.22);
        const demoCfe = {
          id: 'demo-cfe-' + venta.id,
          numero: venta.nroVenta.replace('V-', 'E-'),
          tipo: 'e-Factura',
          moneda: 'UYU',
          fecha: venta.fecha || venta.creadoEn?.split('T')[0] || new Date().toISOString().split('T')[0],
          fecha_venc: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          clienteId: venta.clienteId,
          clienteNombre: venta.clienteNombre,
          subtotal: venta.total - demoIva,
          iva_total: demoIva,
          total: venta.total,
          saldoPendiente: venta.total,
          status: 'emitida',
          items: venta.items,
          createdAt: venta.creadoEn,
        };
        setCfes(prev => [demoCfe, ...prev]);
        setForm(emptyForm);
        setVista('lista');
        showMsg('✅ Venta ' + venta.nroVenta + ' creada (demo) → stock descontado', 'ok');
        setSaving(false);
        return;
      }

`;

if (src.includes(CREATE_ANCHOR) && !src.includes('demo mode — skipping create_venta RPC')) {
  src = src.replace(CREATE_ANCHOR, DEMO_CREATE_BYPASS + CREATE_ANCHOR);
  changes++;
  console.log('✅ 1/3 Demo bypass added BEFORE create_venta RPC');
} else if (src.includes('demo mode — skipping create_venta RPC')) {
  console.log('⏭  1/3 Demo create_venta bypass already exists');
} else {
  console.log('❌ 1/3 Could not find create_venta anchor');
}

// ═══════════════════════════════════════════════════════════════════════
// 2. DEMO BYPASS for transition_venta_state RPC (cambiarEstado function)
//    Insert BEFORE the try { fetch(...transition_venta_state) block
//    Optimistic UI is already applied above this point, so we just skip
//    the server call + skip push notifications + skip WhatsApp
// ═══════════════════════════════════════════════════════════════════════

const TRANSITION_ANCHOR = `    // Call state machine RPC (validates transition server-side)`;

const DEMO_TRANSITION_BYPASS = `    // ── DEMO MODE: skip RPC, optimistic state already applied above ──────
    if (isDemoMode) {
      console.debug('[VentasTab] demo mode — skipping transition RPC:', nuevoEstado);
      showMsg('Estado → ' + nuevoEstado + ' (demo)', 'ok');
      return;
    }

`;

if (src.includes(TRANSITION_ANCHOR) && !src.includes('demo mode — skipping transition RPC')) {
  src = src.replace(TRANSITION_ANCHOR, DEMO_TRANSITION_BYPASS + TRANSITION_ANCHOR);
  changes++;
  console.log('✅ 2/3 Demo bypass added BEFORE transition_venta_state RPC');
} else if (src.includes('demo mode — skipping transition RPC')) {
  console.log('⏭  2/3 Demo transition bypass already exists');
} else {
  console.log('❌ 2/3 Could not find transition_venta_state anchor');
}

// ═══════════════════════════════════════════════════════════════════════
// 3. DEMO BYPASS for fetchNextNroVenta (avoid RPC call for sequence)
//    In demo mode, generate nroVenta locally without calling Postgres
// ═══════════════════════════════════════════════════════════════════════

const NRO_ANCHOR = `async function fetchNextNroVenta(ventasLocal) {
  try {`;

const NRO_DEMO = `async function fetchNextNroVenta(ventasLocal, skipRpc = false) {
  if (skipRpc) {
    const nums = (ventasLocal || []).map(v => parseInt((v.nroVenta || 'V-0000').replace('V-', '')) || 0);
    return 'V-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }
  try {`;

if (src.includes(NRO_ANCHOR) && !src.includes('skipRpc')) {
  src = src.replace(NRO_ANCHOR, NRO_DEMO);
  changes++;
  console.log('✅ 3/3 fetchNextNroVenta: added skipRpc parameter');
} else if (src.includes('skipRpc')) {
  console.log('⏭  3/3 skipRpc already exists');
} else {
  console.log('❌ 3/3 Could not find fetchNextNroVenta anchor');
}

// ═══════════════════════════════════════════════════════════════════════
// 4. Pass isDemoMode to fetchNextNroVenta call inside guardarVenta
// ═══════════════════════════════════════════════════════════════════════

const CALL_NRO = `nroVenta: await fetchNextNroVenta(ventas),`;
const CALL_NRO_DEMO = `nroVenta: await fetchNextNroVenta(ventas, isDemoMode),`;

if (src.includes(CALL_NRO) && !src.includes(CALL_NRO_DEMO)) {
  src = src.replace(CALL_NRO, CALL_NRO_DEMO);
  changes++;
  console.log('✅ 4/4 fetchNextNroVenta call now passes isDemoMode');
} else {
  console.log('⏭  4/4 fetchNextNroVenta call already patched or not found');
}

// ═══════════════════════════════════════════════════════════════════════
// 5. DEMO BYPASS for cancel venta RPC (inside cambiarEstado, cancelada)
//    Find the cancel RPC block and add isDemoMode skip
// ═══════════════════════════════════════════════════════════════════════

// Check for cancel RPC — it's deeper in cambiarEstado after stock restore
const CANCEL_ANCHOR = `      // Atomic DB cancel via RPC`;
if (src.includes(CANCEL_ANCHOR) && !src.includes('demo mode — skipping cancel RPC')) {
  const CANCEL_BYPASS = `      // ── DEMO MODE: skip cancel RPC ──────────────────────────────────────
      if (isDemoMode) {
        console.debug('[VentasTab] demo mode — skipping cancel RPC');
        showMsg('Venta cancelada (demo) → stock restaurado', 'ok');
        return;
      }

      // Atomic DB cancel via RPC`;
  src = src.replace(CANCEL_ANCHOR, CANCEL_BYPASS);
  changes++;
  console.log('✅ 5/5 Demo bypass added BEFORE cancel RPC');
} else if (src.includes('demo mode — skipping cancel RPC')) {
  console.log('⏭  5/5 Cancel RPC bypass already exists');
} else {
  console.log('⚠️  5/5 Cancel RPC anchor not found (non-critical)');
}

// ═══════════════════════════════════════════════════════════════════════
// Write result
// ═══════════════════════════════════════════════════════════════════════

if (changes > 0) {
  fs.writeFileSync(VENTAS_PATH, src, 'utf8');
  console.log(`
══════════════════════════════════════════════
✅ Demo interactive mode patched! (${changes} changes)

  In demo mode, users can now:
  ✅ Create ventas (stock deducts in memory)
  ✅ Auto-generate demo CFE (factura)
  ✅ Transition states (pendiente → confirmada → preparada → etc)
  ✅ Cancel ventas (stock restores in memory)

  Production code: ZERO changes
  All guards are: if (isDemoMode) { skip RPC; return; }

  Next steps:
  1. npm run build
  2. Test: go to demo mode → Ventas → create a sale
  3. Verify state transitions work
  4. npx vercel --prod
══════════════════════════════════════════════`);
} else {
  console.log('\n⚠️  No changes made — all patches already applied or anchors not found');
}
