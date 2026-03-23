// v126 — JSX fragments fixed, auth in Root
// v115 — rollback to v107 + cache bust
import React, { useState, useEffect, useRef, useMemo, useCallback , Suspense } from "react";
import { db, getAuthHeaders, LS as _LS_CONSTANTS } from "./lib/constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const ImporterTab = React.lazy(() => import('./tabs/ImporterTab.jsx'));
const VentasTab = React.lazy(() => import('./tabs/VentasTab.jsx'));
const FacturacionTab = React.lazy(() => import('./tabs/FacturacionTab.jsx'));
const DepositoTab = React.lazy(() => import('./tabs/DepositoTab.jsx'));
const RecepcionTab = React.lazy(() => import('./tabs/RecepcionTab.jsx'));
const RutasTab = React.lazy(() => import('./tabs/RutasTab.jsx'));
const InformesTab = React.lazy(() => import('./tabs/InformesTab.jsx'));
const LotesTab = React.lazy(() => import('./tabs/LotesTab.jsx'));
const MovimientosTab = React.lazy(() => import('./tabs/MovimientosTab.jsx'));
const ConteoTab = React.lazy(() => import('./tabs/ConteoTab.jsx'));
const DevolucionesTab = React.lazy(() => import('./tabs/DevolucionesTab.jsx'));
const ClientesTab = React.lazy(() => import('./tabs/ClientesTab.jsx'));
const PackingTab = React.lazy(() => import('./tabs/PackingTab.jsx'));
const ImportTab = React.lazy(() => import('./tabs/ImportTab.jsx'));
const InventarioTab = React.lazy(() => import('./tabs/InventarioTab.jsx'));
const TransferenciasTab = React.lazy(() => import('./tabs/TransferenciasTab.jsx'));
const BatchPickingTab = React.lazy(() => import('./tabs/BatchPickingTab.jsx'));
const PreciosTab = React.lazy(() => import('./tabs/PreciosTab.jsx'));
const KPIsTab = React.lazy(() => import('./tabs/KPIsTab.jsx'));
const DemandaTab = React.lazy(() => import('./tabs/DemandaTab.jsx'));
const ConfigTab = React.lazy(() => import('./tabs/ConfigTab.jsx'));
const AuditTab = React.lazy(() => import('./tabs/AuditTab.jsx'));
const TrackingTab = React.lazy(() => import('./tabs/TrackingTab.jsx'));
const DashboardInline = React.lazy(() => import('./tabs/DashboardInline.jsx'));
const PedidosInline = React.lazy(() => import('./tabs/PedidosInline.jsx'));
const InventoryInline = React.lazy(() => import('./tabs/InventoryInline.jsx'));
const ConfigInline = React.lazy(() => import('./tabs/ConfigInline.jsx'));
const ProveedoresInline = React.lazy(() => import('./tabs/ProveedoresInline.jsx'));

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');


*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f9f9f7;font-family:'Inter',system-ui,sans-serif;}
input,select,textarea,button{font-family:'Inter',system-ui,sans-serif;}
input:focus,select:focus,textarea:focus{outline:none;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:#d0d0cc;border-radius:4px;}
input[type=range]{accent-color:#3a7d1e;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.6;transform:scale(.85);}}
@keyframes slideInRight{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
.au{animation:fadeUp .25s ease both;}
.pdot{animation:pulseDot 1.8s ease infinite;}
`;

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

// ============================================================
// SUPABASE-FIRST DATA LAYER
// Strategy: localStorage as cache, Supabase as source of truth
// - Reads: localStorage first (instant), then sync from Supabase in background
// - Writes: localStorage immediately + Supabase async (never blocks UI)
// - On first load: pulls all data from Supabase into localStorage
// ============================================================
const SB_URL = 'https://mrotnqybqvmvlexncvno.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI';
const SB_HEADERS = {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'};

// Write to Supabase async - never blocks
function sbWrite(key, value) {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token = session?.access_token || SB_KEY;
    fetch(SB_URL+'/rest/v1/aryes_data', {
      method: 'POST',
      headers: {'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body: JSON.stringify({key, value, updated_at: new Date().toISOString()})
    }).catch(()=>{});
  } catch(e) {}
}

// Read all from Supabase and refresh localStorage cache
async function sbSyncAll() {
  try {
    const session = JSON.parse(localStorage.getItem('aryes-session') || 'null');
    const token = session?.access_token || SB_KEY;
    const authH = {'apikey':SB_KEY,'Authorization':'Bearer '+token};
    const r = await fetch(SB_URL+'/rest/v1/aryes_data?select=key,value', {headers: authH});
    if(!r.ok) return;
    const rows = await r.json();
    if(!Array.isArray(rows)) return;
    rows.forEach(row => {
      try {
        const val = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
        localStorage.setItem(row.key, val);
      } catch(e) {}
    });
    localStorage.setItem('aryes-last-sync', new Date().toISOString());
  } catch(e) {}
}

// Read single key from Supabase and refresh cache
async function sbSyncKey(key) {
  try {
    const r = await fetch(SB_URL+'/rest/v1/aryes_data?key=eq.'+encodeURIComponent(key)+'&select=key,value', {headers: SB_HEADERS});
    if(!r.ok) return;
    const rows = await r.json();
    if(!Array.isArray(rows) || rows.length===0) return;
    const val = typeof rows[0].value === 'string' ? rows[0].value : JSON.stringify(rows[0].value);
    localStorage.setItem(key, val);
  } catch(e) {}
}

// LS: main data access object - localStorage first, Supabase background
const LS = {
  get(key, def) {
    try {
      const raw = localStorage.getItem(key);
      if(raw===null||raw===undefined) return def;
      try { return JSON.parse(raw); } catch(e) { return raw; }
    } catch(e) { return def; }
  },
  set(key, value) {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, str);
      sbWrite(key, value); // async, non-blocking
    } catch(e) {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      fetch(SB_URL+'/rest/v1/aryes_data?key=eq.'+encodeURIComponent(key), {
        method: 'DELETE', headers: SB_HEADERS
      }).catch(()=>{});
    } catch(e) {}
  }
};

// On app load: trigger background sync from Supabase
// This ensures data is always fresh from the server
setTimeout(() => sbSyncAll(), 1000);

// getAuthHeaders: uses logged-in user's JWT when available so RLS policies fire correctly



// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Backgrounds — clean white like Lovable
  bg:       "#f9f9f7",
  card:     "#ffffff",
  cardWarm: "#fafaf8",
  muted:    "#f0f0ec",
  hover:    "#e8e8e4",

  // Borders
  border:   "#e2e2de",
  borderDk: "#c8c8c4",

  // Text
  text:     "#1a1a18",
  textMd:   "#3a3a38",
  textSm:   "#6a6a68",
  textXs:   "#9a9a98",

  // Brand — primary green
  green:    "#3a7d1e",
  greenBg:  "#f0f7ec",
  greenBd:  "#b8d9a8",

  // Accents
  amber:    "#d97706",
  amberBg:  "#fef3c7",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  redBd:    "#fecaca",
  blue:     "#2563eb",
  blueBg:   "#eff6ff",
  blueBd:   "#bfdbfe",

  // Alert levels
  urgent:   "#dc2626",
  urgentBg: "#fef2f2",
  urgentBd: "#fecaca",
  danger:   "#dc2626",
  dangerBg: "#fef2f2",
  dangerBd: "#fecaca",
  warning:  "#d97706",
  warnBg:   "#fffbeb",
  warnBd:   "#fde68a",
  watch:    "#2563eb",
  watchBg:  "#eff6ff",
  watchBd:  "#bfdbfe",
  ok:       "#16a34a",
  okBg:     "#f0fdf4",
  okBd:     "#bbf7d0",

  // Typography
  serif:    "'Playfair Display', 'Georgia', serif",
  sans:     "'Inter', system-ui, sans-serif",
};

// ─── Simple Toast Container ───────────────────────────────────────────────
const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts || !toasts.length) return null;
  return React.createElement('div', {
    style:{ position:'fixed', bottom:24, right:24, zIndex:8000,
      display:'flex', flexDirection:'column', gap:8, maxWidth:340 }
  }, toasts.map(t => {
    const colors = {
      danger:  { bg:'#fef2f2', bd:'#fecaca', cl:'#dc2626', icon:'⚠' },
      warning: { bg:'#fffbeb', bd:'#fde68a', cl:'#d97706', icon:'⏰' },
      info:    { bg:'#eff6ff', bd:'#bfdbfe', cl:'#2563eb', icon:'ℹ' },
    };
    const s = colors[t.type] || colors.info;
    return React.createElement('div', { key:t.id,
      style:{ background:s.bg, border:`1px solid ${s.bd}`, borderRadius:10,
        padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-start',
        boxShadow:'0 4px 20px rgba(0,0,0,.1)', animation:'slideInRight .2s ease' }
    },
      React.createElement('span', { style:{fontSize:16,flexShrink:0} }, s.icon),
      React.createElement('div', { style:{flex:1,fontFamily:"'DM Sans',sans-serif",
        fontSize:13, fontWeight:600, color:s.cl, lineHeight:1.4} }, t.msg),
      React.createElement('button', { onClick:()=>onDismiss(t.id),
        style:{background:'none',border:'none',cursor:'pointer',color:s.cl,
          fontSize:16,lineHeight:1,padding:0,opacity:.6,flexShrink:0} }, '×')
    );
  }));
};


// ─── Command Palette (⌘K) ─────────────────────────────────────────────────
const CommandPalette = ({ open, onClose, products, clientes, cfes, setTab, onNewCFE, onNewOrder }) => {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    if (open) { setQ(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  React.useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open ? onClose() : null; }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const NAV_ACTIONS = [
    { type:'nav', id:'dashboard',   icon:'📊', label:'Dashboard',        group:'Navegar' },
    { type:'nav', id:'inventory',   icon:'📦', label:'Inventario',       group:'Navegar' },
    { type:'nav', id:'orders',      icon:'🛒', label:'Pedidos',          group:'Navegar' },
    { type:'nav', id:'suppliers',   icon:'🏭', label:'Proveedores',      group:'Navegar' },
    { type:'nav', id:'clientes',    icon:'👥', label:'Clientes',         group:'Navegar' },
    { type:'nav', id:'facturacion', icon:'📄', label:'Facturación',      group:'Navegar' },
    { type:'nav', id:'movimientos', icon:'🔄', label:'Movimientos',      group:'Navegar' },
    { type:'nav', id:'kpis',        icon:'📈', label:'KPIs',             group:'Navegar' },
    { type:'nav', id:'config',      icon:'⚙',  label:'Configuración',   group:'Navegar' },
    { type:'action', icon:'🧾', label:'Nueva factura CFE',  group:'Acciones', action: () => { onNewCFE?.(); onClose(); } },
    { type:'action', icon:'📦', label:'Nuevo pedido',       group:'Acciones', action: () => { setTab('orders'); onClose(); } },
    { type:'action', icon:'👤', label:'Nuevo cliente',      group:'Acciones', action: () => { setTab('clientes'); onClose(); } },
  ];

  const results = React.useMemo(() => {
    if (!q.trim()) return NAV_ACTIONS.slice(0, 8);
    const lo = q.toLowerCase();
    const navMatches = NAV_ACTIONS.filter(a => a.label.toLowerCase().includes(lo));
    const prodMatches = (products||[]).filter(p => p.name.toLowerCase().includes(lo)).slice(0,4).map(p => ({
      type:'product', icon:'📦', label:p.name,
      sub:`Stock: ${p.stock} ${p.unit} · ${p.alert?.label||''}`,
      group:'Productos',
      action: () => { setTab('inventory'); onClose(); }
    }));
    const cliMatches = (clientes||[]).filter(c => (c.nombre||'').toLowerCase().includes(lo)).slice(0,3).map(c => ({
      type:'client', icon:'👥', label:c.nombre,
      sub:c.tipo||'', group:'Clientes',
      action: () => { setTab('clientes'); onClose(); }
    }));
    const cfeMatches = (cfes||[]).filter(f => (f.numero||'').toLowerCase().includes(lo)||(f.clienteNombre||'').toLowerCase().includes(lo)).slice(0,3).map(f => ({
      type:'cfe', icon:'🧾', label:f.numero||'CFE',
      sub:`${f.clienteNombre} · $${f.total?.toFixed(0)||0}`,
      group:'Facturas',
      action: () => { setTab('facturacion'); onClose(); }
    }));
    return [...navMatches, ...prodMatches, ...cliMatches, ...cfeMatches].slice(0,12);
  }, [q, products, clientes, cfes]);

  React.useEffect(() => { setCursor(0); }, [results.length]);

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) {
      const r = results[cursor];
      if (r.action) r.action();
      else if (r.type === 'nav') { setTab(r.id); onClose(); }
    }
  };

  const execResult = r => {
    if (r.action) r.action();
    else if (r.type === 'nav') { setTab(r.id); onClose(); }
  };

  if (!open) return null;

  // Group results
  const grouped = {};
  results.forEach((r,i) => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push({...r, _idx:i});
  });

  const F = { sans:"'DM Sans','Inter',system-ui,sans-serif", mono:"'DM Mono','Fira Code',monospace" };

  return React.createElement('div', {
    style:{ position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'flex-start',
      justifyContent:'center', paddingTop:'15vh', background:'rgba(10,10,8,.6)',
      backdropFilter:'blur(6px)' },
    onClick: onClose
  },
    React.createElement('div', {
      style:{ width:580, background:'#fff', borderRadius:16, overflow:'hidden',
        boxShadow:'0 24px 80px rgba(0,0,0,.25)', border:'1px solid #e2e2de' },
      onClick: e => e.stopPropagation()
    },
      // Search input
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12,
        padding:'14px 18px', borderBottom:'1px solid #f0f0ec' }},
        React.createElement('span', { style:{fontSize:18, opacity:.4} }, '🔍'),
        React.createElement('input', {
          ref: inputRef,
          value: q,
          onChange: e => setQ(e.target.value),
          onKeyDown: onKey,
          placeholder: 'Buscar o ejecutar… (navegar, productos, clientes, facturas)',
          style:{ flex:1, border:'none', outline:'none', fontFamily:F.sans, fontSize:15,
            color:'#1a1a18', background:'transparent', padding:0 }
        }),
        React.createElement('kbd', { style:{ background:'#f0f0ec', border:'1px solid #d4d4d0',
          borderRadius:5, padding:'2px 7px', fontFamily:F.mono, fontSize:11,
          color:'#6a6a68' }}, 'ESC')
      ),
      // Results
      Object.entries(grouped).length === 0
        ? React.createElement('div', { style:{ padding:'32px', textAlign:'center',
            color:'#9a9a98', fontFamily:F.sans, fontSize:13 }}, 'Sin resultados')
        : React.createElement('div', { style:{ maxHeight:380, overflowY:'auto', padding:'8px 0' }},
          Object.entries(grouped).map(([group, items]) =>
            React.createElement(React.Fragment, { key:group },
              React.createElement('div', { style:{ padding:'8px 18px 4px', fontFamily:F.sans,
                fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                color:'#9a9a98' }}, group),
              items.map(r =>
                React.createElement('button', {
                  key:r._idx,
                  onClick: () => execResult(r),
                  onMouseEnter: () => setCursor(r._idx),
                  style:{ width:'100%', textAlign:'left', padding:'9px 18px',
                    display:'flex', alignItems:'center', gap:12, border:'none', cursor:'pointer',
                    background: cursor === r._idx ? '#f0f7ec' : 'transparent',
                    transition:'background .08s', fontFamily:F.sans }
                },
                  React.createElement('span', { style:{fontSize:16, flexShrink:0} }, r.icon),
                  React.createElement('div', { style:{flex:1} },
                    React.createElement('div', { style:{fontSize:13, fontWeight:cursor===r._idx?600:400,
                      color:'#1a1a18'} }, r.label),
                    r.sub && React.createElement('div', { style:{fontSize:11, color:'#9a9a98',
                      marginTop:1} }, r.sub)
                  ),
                  r.type === 'nav' && React.createElement('span', { style:{fontSize:11,
                    color:'#c8c8c4', fontFamily:F.mono} }, '↵')
                )
              )
            )
          )
        ),
      // Footer
      React.createElement('div', { style:{ padding:'8px 18px', borderTop:'1px solid #f0f0ec',
        display:'flex', gap:16 }},
        [['↑↓','navegar'],['↵','abrir'],['ESC','cerrar']].map(([k,v]) =>
          React.createElement('span', { key:k, style:{display:'flex', alignItems:'center',
            gap:4, fontFamily:F.sans, fontSize:11, color:'#9a9a98'} },
            React.createElement('kbd', { style:{background:'#f0f0ec', border:'1px solid #d4d4d0',
              borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:10,
              color:'#6a6a68'} }, k),
            v
          )
        )
      )
    )
  );
};


const gh=(base,v)=>Array.from({length:6},(_,i)=>{
  const d=new Date();d.setMonth(d.getMonth()-(5-i));
  return{month:d.toISOString().slice(0,7),consumed:Math.max(1,Math.round(base*(1+(Math.random()-.5)*v)))};
});

const DEFAULT_PRODUCTS = [
  {id:1,name:"Chocolate Cobertura Confeiteiro con Leche 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:2,name:"Chocolate Cobertura Confeiteiro Semiamargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:3,name:"Chocolate Cobertura Confeiteiro Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:4,name:"Chocolate Cobertura Supreme Amargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:5,name:"Chocolate Gotas Supreme con Leche 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:6,name:"Chocolate Gotas Supreme Semiamargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:7,name:"Chocolate Gotas Supreme Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:8,name:"Chocolate Ganache con Leche 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:9,name:"Chocolate Ganache Semiamargo 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:10,name:"Chocolate Ganache Blanco 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:11,name:"Chocolate Chips Negro 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:12,name:"Chocolate Chips Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:13,name:"Cacao polvo Namur 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:659.84,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:14,name:"Cacao polvo Namur 10 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:459.02,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:15,name:"Chocolate Granizado (mini gotas) semiamargo 8 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:282.79,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:16,name:"Microgalletitas b/chocolate 7 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:680.33,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:17,name:"Relleno y Cobertura Chantilly 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:18,name:"Relleno y Cobertura Vainilla 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:19,name:"Relleno y Cobertura Frutilla 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:20,name:"Relleno y Cobertura Chantilly 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:21,name:"Relleno y Cobertura Vainilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:22,name:"Relleno y Cobertura Frutilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:23,name:"Relleno y Cobertura Chantilly 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:24,name:"Relleno y Cobertura Vainilla 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:25,name:"Relleno y Cobertura Frutilla 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:26,name:"Relleno y Cobertura Sabor Chocolate por 4,5 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:27,name:"Relleno y Cobertura Sabor Chocolate  por 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.87,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:28,name:"Relleno y Cobertura Sabor Chocolate  por 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:360.66,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:29,name:"Merengue en polvo por 250 grs. (1 kg. polvo + 400 cc.agua+12 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:385.25,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:30,name:"Merengue en polvo por 4 kgs. ( 1 kg. polvo + 400 cc.agua+12 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:31,name:"Crema pastelera por 250 grs. (750 cc. agua + 250 gr.polvo + 5 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:418.03,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:32,name:"Crema pastelera por 4 Kg. (750 cc. agua + 250 gr.polvo + 5 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:319.67,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:33,name:"Mousse Chantilly 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:34,name:"Mousse Frutilla 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:35,name:"Mousse Chocolate 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:36,name:"Mousse Chantilly 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:37,name:"Mousse Frutilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:38,name:"Mousse Chocolate 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:39,name:"Gel de Brillo Neutro 310 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:237.7,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:40,name:"Gel de Brillo Frutilla 310 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:237.7,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:41,name:"Destello Neutro 4,4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:42,name:"Destello Frutilla 4,4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:43,name:"Gel de Brillo Neutro en Caliente por 10 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:44,name:"Crema Paris (cubretortas chocolate intenso) por 280 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:401.64,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:45,name:"Crema Paris (baño tipo ganache) por 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.89,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:46,name:"Mix Cupcake vainilla 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:233.61,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:47,name:"Mix Brownie 470 grs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:258.2,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:48,name:"Mix Brownie 4 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:49,name:"Mix Budín vainilla 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:50,name:"Mix Macarrones 250 grs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:532.79,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:51,name:"Mix Macarron 3,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:422.13,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:52,name:"Azúcar impalpable 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:176.23,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:53,name:"Glacé Real 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:54,name:"Fondant 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:196.72,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:55,name:"Pastamix 800 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:307.38,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:56,name:"Pastamix 3 kgs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1020.49,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:57,name:"Pasta Americana Colorful 800 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:315.57,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:58,name:"Rendamix 100 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:155.74,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:59,name:"Pasta Americana Mix 4,5 kgs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1536.89,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:60,name:"Azúcar Colores 80 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:61,name:"Azúcar Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:62,name:"Granas Colores 120 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:63,name:"Granas Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:64,name:"Grageas Colores 100 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:53.27,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:65,name:"Grageas Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:66,name:"Granas Colores 5 kgrs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:163.93,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:67,name:"Aromatizante Limón 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:68,name:"Aromatizante Nuez 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:69,name:"Aromatizante Chocolate 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:70,name:"Aromatizante Naranja 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:71,name:"Aromatizante Vainilla 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:72,name:"Aromatizante Vainilla Blanca 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:73,name:"Aromatizante Chocolate 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:74,name:"Aromatizante Coco 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:75,name:"Aromatizante Manteca 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:76,name:"Aromatizante Frutilla 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:77,name:"Aromatizante Queso 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:78,name:"Aromatizante Panettone 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:79,name:"Aromatizante Naranja 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:80,name:"Aromatizante Limón 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:81,name:"Aromatizante Menta 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:82,name:"Color gel 15 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:65.57,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:83,name:"Color softgel 25 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:110.66,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:84,name:"Color softgel Big 150 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:352.46,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:85,name:"Color polvo esfumado 3 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:139.34,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:86,name:"Color pen 60 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:135.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:87,name:"Color líquido 10 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:88,name:"Colorante liquido 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:155.74,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:89,name:"Acido Cítrico 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:90,name:"Agar Agar 30 g",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:299.18,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:91,name:"CMC (Carbometil Celulosa) 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:110.65,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:92,name:"Cremor Tártaro por 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:93,name:"Gel Confitero 50 grs",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:94,name:"Glucosa jarabe 150 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:98.36,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:95,name:"Glucosa jarabe 500 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:163.93,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:96,name:"Glucosa jarabe 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:97,name:"Glucosa polvo (dextrosa) 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:98,name:"Emustab (Emulsificante) 200 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:121.32,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:99,name:"Emustab por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:418.03,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:100,name:"Gelatina neutra por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:101,name:"CHOCOLATE AMARGO DARK 70% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1385.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:102,name:"CHOCOLATE AMARGO DARK 70% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1295.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:103,name:"CHOCOLATE AMARGO BLACK 65% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1229.51,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:104,name:"CHOCOLATE AMARGO BLACK 65% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1200.82,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:105,name:"CHOCOLATE FLUIDO 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1217.21,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:106,name:"CHOCOLATE FLUIDO 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1192.62,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:107,name:"CHOCOLATE S/AMARGO 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1118.85,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:108,name:"CHOCOLATE S/AMARGO 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:109,name:"CHOCOLATE C/LECHE CARAMELIZADO 40% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:110,name:"CHOCOLATE C/LECHE BLEND 35% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:111,name:"CHOCOLATE C/LECHE BLEND 35% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:112,name:"CHOCOLATE BLANCO C/MAIZ 33% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1270.49,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:113,name:"CHOCOLATE BLANCO 31% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:114,name:"CHOCOLATE BLANCO 31% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:115,name:"CACAO POLVO 22-24% 2,25 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:116,name:"NIBS CACAO 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2049.18,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:117,name:"LICOR CACAO 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2000,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:118,name:"CHOCOLATE S/AMARGO TRONADOR 55%",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:119,name:"CHOCOLATE C/LECHE TRONADOR",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:120,name:"CHOCOLATE BLANCO",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:121,name:"CHOCOLATE AMARGO 71%",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1135.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:122,name:"Preparado selecta top 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:286.88,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:123,name:"Crema Chocolat 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:442.62,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:124,name:"Variegato Frutales 2 Kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:565.57,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:125,name:"Variegato Frutales 12 Kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:528.69,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:126,name:"Variegato Frutales Zero 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:655.74,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:127,name:"Veteado Chocolat 2 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:545.08,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:128,name:"Veteado Chocolat 12 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:631.15,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:129,name:"Super liga Neutra por 20 kgs. estabilizante en frío ó caliente",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:130,name:"Emustab por 10 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:282.79,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:131,name:"Emustab por 3 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.86,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:132,name:"Estabilizante Aqua 5 por 1 kg. en frio",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:549.18,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:133,name:"Emulsificante y Estabilizante Laqua 10 por 500 grs. en frio",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:134,name:"Base Zero Aqua 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:549.18,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:135,name:"Cobertura Clásicas  1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:172.13,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:136,name:"Cobertura premium 1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:225.41,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:137,name:"Cobertura Clásicas  300 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:138,name:"Soft Vainilla 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:139,name:"Soft Chocolate 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:140,name:"Chocolate caliente por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:327.87,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:141,name:"Desmoldante Aerosol Lisse 600 ml",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:368.85,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",salePrice:0,history:gh(180,0.5)},
  {id:142,name:"Mejorador Enzipan 250",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:73.77,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",salePrice:0,history:gh(180,0.5)},
  {id:143,name:"Mix Pao de queijo por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:172.13,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",salePrice:0,history:gh(180,0.5)},
  {id:144,name:"Caramelo Liquido 7 kg",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:139.34,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",salePrice:0,history:gh(180,0.5)},
  {id:145,name:"Lactofil Premium 1 L",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",salePrice:0,history:gh(180,0.5)},
  {id:146,name:"Aceite Doratta 15,8 L (14, kgs)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:2250,minStock:5,dailyUsage:0.5,category:"Aceites y Grasas",brand:"Agropalma",salePrice:0,history:gh(180,0.5)},
  {id:147,name:"Grasa Palma 20 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:122.73,minStock:5,dailyUsage:0.5,category:"Aceites y Grasas",brand:"Agropalma",salePrice:0,history:gh(180,0.5)},
  {id:148,name:"Anana 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:149,name:"Banana  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:150,name:"Frambuesa 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:151,name:"Frutilla  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:152,name:"Mango  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:153,name:"Maracuyá 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:154,name:"Limón 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:155,name:"Azurro Cielo 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:799.18,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:156,name:"Bubbly 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1213.11,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:157,name:"Biscottino 4,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:995.9,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:158,name:"Biancocioc 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:159,name:"Cherry 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:160,name:"Cocco 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1032.79,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:161,name:"Caffe por 1 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:162,name:"Chantilly (pasta per cookies black) 4,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1086.07,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:163,name:"Cheese Cake en polvo 1 kg",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1295.083,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:164,name:"Limoncello en polvo con estabilizante 2,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:165,name:"Mascarpone en polvo 2 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1500,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:166,name:"Yoghin yogurth en polvo 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1196.72,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:167,name:"Limone 50 en polvo con estabilizante 2,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1155.74,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:168,name:"Menta 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:952.82,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:169,name:"Mister Nico Pasta mani 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1180.33,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:170,name:"Pistacho California 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:4147.54,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:171,name:"Pistacho Pesto c/trozos 2,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:3581.97,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:172,name:"Nocciola Prima Fine (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2151.64,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:173,name:"Nocciola Selection (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1491.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:174,name:"Nocciola Oscura (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1627.05,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:175,name:"Nocciola Máxima (kinder) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2340.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:176,name:"Sinfonía Italiana KIT 12,7 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:177,name:"Tiramisu 4,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1040.98,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:178,name:"Vainilla French 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1159.84,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:179,name:"Zabaione 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:180,name:"Cookie Black Oreo 6 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:181,name:"Cookie Lemon 6 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:182,name:"Fiordibosco 3 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:183,name:"Mamá que buena kinder 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:967.21,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:184,name:"Mecralph 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1254.1,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:185,name:"Mecrock 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1282.79,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:186,name:"Mecrock Plus 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1176,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:187,name:"Mister Nico Snickers 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:877.05,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:188,name:"Quello Caramelo 6 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:189,name:"Wafer 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1073.77,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:190,name:"Base Soave 2 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:831.97,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:191,name:"Base Elena 1,8 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:840.16,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:192,name:"Supergelmix 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:938.52,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:193,name:"Cioki 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:655.74,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:194,name:"Cremfix 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:643.44,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:195,name:"Cacao polvo 20-22",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:196,name:"Stracciatella",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:606.56,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:197,name:"Gianduia 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1311.48,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:198,name:"Torrone Rustico 4,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1491.8,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:199,name:"Frollino 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:200,name:"Amore Nocciola 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:950.82,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:201,name:"Arancio Variegato 3,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:778.68,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:202,name:"Pistacho al Gusto 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1729.51,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:203,name:"Pistacho Natura 2,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:3950.82,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:204,name:"Pistacho Maestro 2,5",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2983.61,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:205,name:"Morettina Clásica 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:206,name:"Morettina Blanca 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:207,name:"Morettina Pepita Clásica 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1172.13,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:208,name:"Morettina Pepita Blanca ,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1172.13,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:209,name:"Morettina Pistacho 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1721.31,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:210,name:"Morettina Pastelera Clásica 12 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:614.75,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:211,name:"Morettina Pastelera Pistacho 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:942.62,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",salePrice:0,history:gh(180,0.5)},
  {id:212,name:"Cacao polvo Namur 10 Kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:213,name:"Pasta Saborizante 2 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Pastas Saborizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:214,name:"Dia & Light Vaniglia 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1159.84,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:215,name:"Dia & Light Fiordilatte 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1180.33,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:216,name:"Dia & Light Fuit 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1098.36,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:217,name:"Dia & Light Cioccolatto 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1295.08,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",salePrice:0,history:gh(180,0.5)},
  {id:218,name:"Chocolate Amargo Dark 70% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:219,name:"Chocolate Amargo Dark 70%  70% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:220,name:"Chocolate Amargo Black 65% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:221,name:"Chocolate s/Amargo 56% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:762.29,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:222,name:"Chocolate s/Amargo 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:688.52,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:223,name:"Chocolate s/Amargo 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:663.3,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:224,name:"Chocolate Fluido 56% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:225,name:"Chocolate Fluido 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:717.21,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:226,name:"Chocolate Fluido 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:227,name:"Chocolate c/Leche Caramelizado 40% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:228,name:"Chocolate c/Leche 35% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:872.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:229,name:"Chocolate c/Leche 35% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:230,name:"Chocolate c/Leche 35% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:786.89,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:231,name:"Chocolate Blanco c/Maiz 33% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:232,name:"Chocolate Blanco 31% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:946.72,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:233,name:"Chocolate Blanco 31% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:234,name:"Chocolate Blanco 31% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:786.9,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:235,name:"Cacao Polvo 22-24% 2,25 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:236,name:"Nibs Cacao 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",salePrice:0,history:gh(180,0.5)},
  {id:237,name:"Palitos Clásico enfajados 114x10x2mm por 10.000 (200x50 pcs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2700.82,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:238,name:"Palitos Hélice enfajados 200x50 pcs 94x17-11x2 por 5.000 (100x50 pcs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2573.77,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:239,name:"Palitos Redondo 160 x 6 mm  por 5.000",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:3565.57,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:240,name:"Mix Cupcake vainilla 500 grs. (6 kgs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:233.61,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:241,name:"Mix Budín vainilla 500 grs. (6 kgs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:242,name:"Cobertura Premium 1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:225.41,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:243,name:"Mousse Chantilly 1 kg. (Ledevit)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:573.77,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:244,name:"Mousse Frutilla 1 kg. (Ledevit)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:573.77,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:245,name:"Mousse Chocolate por 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:598.36,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",salePrice:0,history:gh(180,0.5)},
  {id:246,name:"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso,Banana,Panettone",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:247,name:"Aromatizante Naranja 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:248,name:"Aromatizante Limón 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:249,name:"Aromatizante Menta 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
  {id:250,name:"Aromatizante Banana 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",salePrice:0,history:gh(180,0.5)},
];

function AryesApp({session, onLogout, onSessionUpdate}){
  let [products,setProducts]=useState(()=>LS.get("aryes6-products",DEFAULT_PRODUCTS));
  let [suppliers,setSuppliers]=useState(()=>LS.get("aryes6-suppliers",DEFAULT_SUPPLIERS));
  let [movements,setMovements]=useState(()=>LS.get("aryes8-movements",[]));
  let [settingsTab,setSettingsTab]=useState("usuarios");
  // session is received as prop from Root component in main.jsx
  // auth state is managed externally — AryesApp always has a valid session
  let [dbReady,setDbReady]=useState(false);
  const [userMenuOpen,setUserMenuOpen]=React.useState(false);
  const [cmdOpen,setCmdOpen]=React.useState(false);
  // Simple toast state — alerts triggered by effects
  const [smartToasts, setSmartToasts] = React.useState([]);
  const toastShown = React.useRef(new Set());
  const dismissToast = id => setSmartToasts(prev => prev.filter(t => t.id !== id));
  const addToast = React.useCallback((id, msg, type='info') => {
    if (toastShown.current.has(id)) return;
    toastShown.current.add(id);
    setSmartToasts(prev => [...prev.slice(-2), {id, msg, type}]);
    setTimeout(() => setSmartToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);
  React.useEffect(() => {
    const crit = (enriched||[]).filter(p => p.alert?.level === 'order_now').length;
    if (crit > 0) addToast('crit', `${crit} producto${crit>1?'s':''} requieren pedido urgente`, 'danger');
    try {
      const cfesLS = JSON.parse(localStorage.getItem('aryes-cfe')||'[]');
      const venc = cfesLS.filter(f => ['emitida','cobrado_parcial'].includes(f.status)&&f.fechaVenc&&
        Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0).length;
      if (venc > 0) addToast('venc', `${venc} factura${venc>1?'s':''} vencida${venc>1?'s':''} sin cobrar`, 'warning');
    } catch(e) {}
  }, [enriched?.length, brandCfg?.name, addToast]);
  // Global ⌘K shortcut
  React.useEffect(()=>{
    const h=e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setCmdOpen(o=>!o);} };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[]);
  let [syncStatus,setSyncStatus]=useState('');
  let [tab,setTab]=useState('dashboard');
  let [orders,setOrders]=useState(()=>LS.get("aryes6-orders",[]));
  let [modal,setModal]=useState(null);
  let [editProd,setEditProd]=useState(null);
  let [editSup,setEditSup]=useState(null);
  let [viewSup,setViewSup]=useState(null);
  let [plans,setPlans]=useState(()=>LS.get("aryes7-plans",{}));
  const savePlan=async(productId, planData)=>{
    setPlans(p=>({...p,[productId]:planData}));
    try {
      await db.upsert('plans',{
        product_id:productId,
        coverage_months:Number(planData.coverageMonths)||2,
        data:planData,
        updated_at:new Date().toISOString()
      });
    } catch(e){ console.warn('[Stock] savePlan SB failed:',e); setHasPendingSync(true); }
  };
  let [notified,setNotified]=useState(()=>LS.get("aryes9-notified",{}));
  let [hasPendingSync,setHasPendingSync]=useState(false);
  let [syncToast,setSyncToast]=useState(null); // {msg,type}
  // Auto-refresh JWT token before expiry
  useEffect(()=>{
    if(!session?.refresh_token||!session?.expiresAt) return;
    const msUntilExpiry = session.expiresAt - Date.now();
    const refreshIn = Math.max(0, msUntilExpiry - 5*60*1000); // 5 min before expiry
    const timer = setTimeout(async()=>{
      try{
        const res = await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',{
          method:'POST',
          headers:{'apikey':SB_KEY,'Content-Type':'application/json'},
          body:JSON.stringify({refresh_token:session.refresh_token})
        });
        const data = await res.json();
        if(res.ok && data.access_token){
          const expiresIn=(data.expires_in||3600)*1000;
          const refreshed={...session,access_token:data.access_token,refresh_token:data.refresh_token,expiresAt:Date.now()+expiresIn};
          LS.set('aryes-session',refreshed);
          onSessionUpdate && onSessionUpdate(refreshed);
        } else {
          // Refresh failed — force logout
          LS.remove('aryes-session');
          onLogout && onLogout();
        }
      } catch(e){ console.warn('[Stock] token refresh failed',e); }
    }, refreshIn);
    return ()=>clearTimeout(timer);
  }, [session?.refresh_token, session?.expiresAt]);



  let [emailCfg,setEmailCfg]=useState({serviceId:'',templateId:'',publicKey:'',toEmail:'',enabled:false});
  let [brandCfg,setBrandCfg]=useState(()=>{try{return JSON.parse(localStorage.getItem('aryes-brand')||'null')||{name:'',logoUrl:'',color:'#3a7d1e'};}catch(e){return {name:'',logoUrl:'',color:'#3a7d1e'};}});
    // Load emailCfg from Supabase app_config (admin only, RLS protected)
  useEffect(()=>{
    if(session?.role !== 'admin') return;
    (async()=>{
      try{
        const rows = await db.get('app_config?key=eq.emailcfg');
        if(rows?.[0]?.value) setEmailCfg(rows[0].value);
        LS.remove('aryes9-emailcfg');
        // Load brand config
        try{
          const brandRows = await db.get('app_config?key=eq.brandcfg');
          if(brandRows?.[0]?.value){ const b=brandRows[0].value; setBrandCfg(b); localStorage.setItem('aryes-brand',JSON.stringify(b)); if(b.name) document.title=b.name+' · Stock'; }
        }catch(e){}
      }catch(e){}
    })();
  },[session?.role]);

  // Load operational data from Supabase (movements, ventas, recepciones)
  useEffect(()=>{
    if(!session) return;
    (async()=>{
      try{
        // Load movements
        const sbMovs = await db.get('stock_movements?order=timestamp.desc&limit=2000');
        if(sbMovs?.length > 0){
          // Map SB columns back to LS shape
          const mapped = sbMovs.map(r=>({id:r.id,tipo:r.tipo,productoId:r.producto_id,
            productoNombre:r.producto_nombre,cantidad:r.cantidad,referencia:r.referencia,
            notas:r.notas,fecha:r.fecha,timestamp:r.timestamp}));
          setMovements(mapped);
          LS.set('aryes8-movements',mapped);
        } else {
          // One-time migration: push LS movements to Supabase
          const lsMovs = LS.get('aryes8-movements',[]);
          if(lsMovs.length>0 && session.role!=='vendedor'){
            const rows=lsMovs.map(m=>({id:m.id,tipo:m.tipo,producto_id:m.productoId,
              producto_nombre:m.productoNombre,cantidad:m.cantidad,referencia:m.referencia,
              notas:m.notas,fecha:m.fecha,timestamp:m.timestamp||new Date().toISOString()}));
            try{ await db.insertMany('stock_movements',rows); }catch(e){}
          }
        }
        // Load ventas
        const sbVentas = await db.get('ventas?order=creado_en.desc&limit=500');
        if(sbVentas?.length > 0){
          const mapped = sbVentas.map(r=>({id:r.id,nroVenta:r.nro_venta,clienteId:r.cliente_id,
            clienteNombre:r.cliente_nombre,items:r.items,total:r.total,descuento:r.descuento,
            estado:r.estado,notas:r.notas,fechaEntrega:r.fecha_entrega,creadoEn:r.creado_en}));
          LS.set('aryes-ventas',mapped);
        } else {
          const lsVentas=LS.get('aryes-ventas',[]);
          if(lsVentas.length>0){
            const rows=lsVentas.map(v=>({id:v.id,nro_venta:v.nroVenta,cliente_id:v.clienteId,
              cliente_nombre:v.clienteNombre,items:v.items||[],total:v.total||0,
              descuento:v.descuento||0,estado:v.estado||'pendiente',notas:v.notas,
              fecha_entrega:v.fechaEntrega,creado_en:v.creadoEn||new Date().toISOString()}));
            try{ await db.insertMany('ventas',rows); }catch(e){}
          }
        }
        // Load recepciones
        const sbRecs = await db.get('recepciones?order=creado_en.desc&limit=500');
        if(sbRecs?.length > 0){
          const mapped = sbRecs.map(r=>({id:r.id,fecha:r.fecha,proveedor:r.proveedor,
            nroRemito:r.nro_remito,notas:r.notas,pedidoId:r.pedido_id,items:r.items,
            estado:r.estado,diferencias:r.diferencias,creadoEn:r.creado_en}));
          LS.set('aryes-recepciones',mapped);
        } else {
          const lsRecs=LS.get('aryes-recepciones',[]);
          if(lsRecs.length>0){
            const rows=lsRecs.map(r=>({id:r.id,fecha:r.fecha,proveedor:r.proveedor,
              nro_remito:r.nroRemito,notas:r.notas,pedido_id:r.pedidoId,
              items:r.items||[],estado:r.estado||'completada',
              diferencias:r.diferencias||0,creado_en:r.creadoEn||new Date().toISOString()}));
            try{ await db.insertMany('recepciones',rows); }catch(e){}
          }
        }
      }catch(e){ console.warn('[Stock] SB operational load failed',e); }
    })();
  },[session?.role]);

  // Sync from Supabase on mount

  const handleLogin=(u)=>{ /* handled by Root in main.jsx */ };
  const handleLogout=()=>{ onLogout && onLogout(); };
  const canEdit=session?.role==='admin'||session?.role==='operador';

  useEffect(()=>{
    if(!session) return;
    setSyncStatus('sync');
    (async()=>{
      try{
        const prods=await db.get('products','order=id.asc&limit=1000');
        if(prods?.length>0){
          const mapped=prods.map(p=>({id:p.uuid||String(p.id),name:p.name,barcode:p.barcode||'',supplierId:p.supplier_id||'',unit:p.unit||'kg',stock:Number(p.stock)||0,unitCost:Number(p.unit_cost)||0,minStock:Number(p.min_stock)||5,dailyUsage:Number(p.daily_usage)||0.5,category:p.category||'',brand:p.brand||'',history:p.history||[]}));
          LS.set('aryes6-products',mapped);
          setProducts(mapped);
        }
        const sups=await db.get('suppliers','order=name.asc');
        if(sups?.length>0){const mapped=sups.map(s=>({id:s.id,name:s.name,flag:s.flag||'',color:s.color||'#3a7d1e',times:s.times||{preparation:2,customs:1,freight:4,warehouse:1},company:s.company||'',contact:s.contact||'',email:s.email||'',phone:s.phone||'',country:s.country||'',city:s.city||'',currency:s.currency||'USD',paymentTerms:s.payment_terms||'30',paymentMethod:s.payment_method||'',minOrder:s.min_order||'',discount:s.discount||'0',rating:s.rating||3,active:s.active!==false,notes:s.notes||''}));LS.set('aryes6-suppliers',mapped);setSuppliers(mapped);}
        const usrs=await db.get('users','order=id.asc');
        if(usrs?.length>0) LS.set('aryes-users',usrs.map(u=>({username:u.username,name:u.name,role:u.role,active:u.active})));
        // Load orders from Supabase
        const sbOrders=await db.get('orders','order=ordered_at.desc&limit=500');
        if(sbOrders?.length>0){
          const mapped=sbOrders.map(o=>({
            id:o.id,productId:o.product_id,productName:o.product_name,
            supplierId:o.supplier_id,supplierName:o.supplier_name,
            qty:Number(o.qty),unit:o.unit,status:o.status,
            orderedAt:o.ordered_at,expectedArrival:o.expected_arrival,
            totalCost:o.total_cost,leadBreakdown:o.lead_breakdown||{}
          }));
          setOrders(mapped);
          LS.set('aryes6-orders',mapped);
        }
        // Load plans from Supabase
        const sbPlans=await db.get('plans');
        if(sbPlans?.length>0){
          const plansMap={};
          sbPlans.forEach(p=>{plansMap[p.product_id]={...(p.data||{}),coverageMonths:Number(p.coverage_months)||2};});
          setPlans(plansMap);
          LS.set('aryes7-plans',plansMap);
        }
        setDbReady(true);setSyncStatus('ok');setTimeout(()=>setSyncStatus(''),3000);
      }catch(e){console.warn('Supabase offline, using local:',e);setDbReady(true);setSyncStatus('error');setTimeout(()=>setSyncStatus(''),4000);}
    })();
  },[session]);

  useEffect(()=>{ const el=document.getElementById("main-content"); if(el) el.scrollTop=0; },[tab]);

  useEffect(()=>LS.set("aryes6-products",products),[products]);
  useEffect(()=>LS.set("aryes6-suppliers",suppliers),[suppliers]);
  useEffect(()=>LS.set("aryes6-orders",orders),[orders]);
  useEffect(()=>LS.set("aryes7-plans",plans),[plans]);
  useEffect(()=>LS.set("aryes8-movements",movements),[movements]);

  useEffect(()=>LS.set("aryes9-notified",notified),[notified]);

  // ── Multi-device conflict detection ──────────────────────────────
  // Poll Supabase every 30s and on tab focus. If server has newer
  // data than our local state, apply it and show a toast.
  useEffect(()=>{
    if(!session||!dbReady) return;
    let pollTimer;

    const syncFromServer = async () => {
      try {
        const serverProds = await db.get('products','order=id.asc&limit=1000');
        if(!serverProds?.length) return;

        const serverMap = {};
        serverProds.forEach(p => { serverMap[p.uuid||String(p.id)] = p; });

        let hasChanges = false;
        const merged = products.map(local => {
          const server = serverMap[local.id];
          if(!server) return local;
          // If server stock differs from local, server wins
          const serverStock = Number(server.stock)||0;
          if(serverStock !== local.stock) {
            hasChanges = true;
            return {...local, stock: serverStock};
          }
          return local;
        });

        if(hasChanges) {
          setProducts(merged);
          LS.set('aryes6-products', merged);
          setSyncToast({msg:'Datos actualizados desde otro dispositivo', type:'info'});
          setTimeout(()=>setSyncToast(null), 4000);
        }
      } catch(e) {
        // offline — silent
      }
    };

    // Poll every 30 seconds
    pollTimer = setInterval(syncFromServer, 30000);

    // Also sync on tab focus (user switches back to this tab)
    const onFocus = () => syncFromServer();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState==='visible') syncFromServer();
    });

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [session, dbReady]); // eslint-disable-line react-hooks/exhaustive-deps


  // Retry wrapper for Supabase writes
  const dbWriteWithRetry = async (fn) => {
    const delays = [500, 1000, 2000];
    for(let i=0; i<=delays.length; i++) {
      try {
        const result = await fn();
        if(result !== null) { setHasPendingSync(false); return result; }
      } catch(e) {}
      if(i < delays.length) await new Promise(r=>setTimeout(r,delays[i]));
    }
    setHasPendingSync(true);
    return null;
  };
  const getSup=id=>suppliers.find(s=>s.id===id);

  const enriched=useMemo(()=>(products||[]).map(p=>{const sup=getSup(p.supplierId);return{...p,sup,alert:alertLevel(p,sup)};}), [products,suppliers]);
  const alerts=(enriched||[]).filter(p=>p.alert.level!=="ok").sort((a,b)=>ALERT_CFG[b.alert.level].pri-ALERT_CFG[a.alert.level].pri);
  const critN=(alerts||[]).filter(p=>p.alert.level==="order_now").length;

  const saveProduct=async f=>{
    const isEdit = !!editProd;
    const id = isEdit ? editProd.id : crypto.randomUUID();
    const now = new Date().toISOString();
    const productData = {
      uuid:id,                          // uuid = our TEXT id (for upsert conflict)
      name:f.name||f.nombre||'', barcode:f.barcode||'',
      supplier_id:f.supplierId||'', unit:f.unit||'kg',
      stock:Number(f.stock)||0, unit_cost:Number(f.unitCost)||0,
      min_stock:Number(f.minStock)||5, daily_usage:Number(f.dailyUsage)||0.5,
      category:f.category||'', brand:f.brand||'',
      history:f.history||[], updated_at:now
      // NOTE: 'id' (INTEGER) is NOT sent — Supabase autogenerates it
    };
    // Optimistic UI update first
    if(isEdit) setProducts(ps=>ps.map(p=>p.id===id?{...p,...f}:p));
    else setProducts(ps=>[...ps,{...f,id}]);
    setModal(null); setEditProd(null);
    // Write to Supabase (source of truth)
    // Upsert on uuid column (unique index on products.uuid)
    try {
      await db.upsert('products', productData, 'uuid');
    } catch(e) {
      console.warn('[Stock] saveProduct SB failed:',e);
      setSyncToast({msg:'Error al guardar producto. Cambio guardado localmente — se sincronizará al reconectar.', type:'error'});
      setTimeout(()=>setSyncToast(null), 6000);
      setHasPendingSync(true);
    }
    // Audit log
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),action:'producto_guardado',detail:JSON.stringify({isEdit,id,nombre:productData.name,stock:productData.stock})}); }catch(e){}
  };
  const confirmOrder=async(product,qty)=>{
    const sup=getSup(product.supplierId);const lead=totalLead(sup);
    const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
    const o={id:crypto.randomUUID(),productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,orderedAt:new Date().toISOString(),expectedArrival:arrival.toISOString(),status:'pending',totalCost:(qty*product.unitCost).toFixed(2),leadBreakdown:{...sup.times}};
    setOrders(os=>[o,...os]);
    addMov({type:'order_placed',productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,note:`Pedido generado — llegada est. ${arrival.toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'})}`});
    setModal({type:'orderDone',order:o});
    // Persist to Supabase
    try {
      await db.upsert('orders',{
        id:o.id,product_id:o.productId,product_name:o.productName,
        supplier_id:o.supplierId,supplier_name:o.supplierName||'',
        qty:o.qty,unit:o.unit,status:o.status,
        ordered_at:o.orderedAt,expected_arrival:o.expectedArrival,
        total_cost:o.totalCost,lead_breakdown:o.leadBreakdown,
        updated_at:new Date().toISOString()
      });
    } catch(e) {
      console.warn('[Stock] confirmOrder SB failed:',e);
      setHasPendingSync(true);
    }
  };
  const _deliveringIds=React.useRef(new Set());
  const markDelivered=async id=>{
    if(_deliveringIds.current.has(id)) return; // prevent double-click
    _deliveringIds.current.add(id);
    try {
    const o=orders.find(x=>x.id===id);if(!o)return;
    const prod=products.find(p=>p.id===o.productId);if(!prod)return;
    const newStock=prod.stock+o.qty;
    const now=new Date().toISOString();
    await db.patchWithLock('products',{stock:newStock,updated_at:now},'uuid=eq.'+prod.id,'stock',prod.stock);
    // Audit log
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:new Date().toISOString(),user: (()=>{ try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),action:'markDelivered',detail:JSON.stringify({orderId:o.id,productId:o.productId,qty:o.qty,newStock})}); }catch(e){ console.warn('[Stock] audit log failed',e); }

    setOrders(os=>os.map(x=>x.id===id?{...x,status:'delivered'}:x));
    // Update order status in Supabase
    try { await db.patch('orders',{status:'delivered',updated_at:now},'id=eq.'+id); } catch(e){ console.warn('[Stock] markDelivered order patch failed:',e); }
    const updatedProds=products.map(p=>p.id===o.productId?{...p,stock:newStock,updatedAt:now}:p);
    setProducts(updatedProds);
    LS.set('aryes6-products',updatedProds);
    setTimeout(()=>checkAndNotify(updatedProds,suppliers,emailCfg,notified),500);
    addMov({type:"delivery",productId:o.productId,productName:o.productName,supplierId:o.supplierId,supplierName:o.supplierName,qty:o.qty,unit:o.unit,note:`Mercadería recibida — pedido del ${new Date(o.orderedAt).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}`});
    } finally { _deliveringIds.current.delete(id); }
  };
  const applyExcel=async matches=>{
    const excelProds = products.map(p=>{const m=matches.find(x=>x.product.id===p.id);return m?{...p,stock:Math.max(0,m.newStock)}:p;});
    setProducts(()=>excelProds);
    setModal(null);
    setTimeout(()=>checkAndNotify(excelProds,suppliers,emailCfg,notified),500);
    // Write each updated stock to Supabase
    const now = new Date().toISOString();
    const writes = matches.map(m=>
      db.patch('products',{stock:Math.max(0,m.newStock),updated_at:now},'uuid=eq.'+m.product.id)
        .catch(e=>console.warn('[Stock] applyExcel SB patch failed:',m.product.id,e))
    );
    await Promise.allSettled(writes);
    matches.forEach(m=>{
      const diff=m.newStock-m.product.stock;
      addMov({type:diff>=0?'excel_in':'excel_out',productId:m.product.id,productName:m.product.name,supplierId:m.product.supplierId,supplierName:'',qty:Math.abs(diff),unit:m.product.unit,stockAfter:m.newStock,note:`Stock actualizado desde Excel (${diff>=0?'+':''}${diff})`});
    });
  };
  const saveSupplier=async f=>{
    const isEdit = !!editSup;
    const id = isEdit ? editSup.id : crypto.randomUUID();
    const now = new Date().toISOString();
    const supplierData = {
      id, name:f.name||f.nombre||'', flag:f.flag||'', color:f.color||'#3a7d1e',
      times:f.times||{preparation:2,customs:1,freight:4,warehouse:1},
      company:f.company||'', contact:f.contact||'', email:f.email||'',
      phone:f.phone||'', country:f.country||'', city:f.city||'',
      currency:f.currency||'USD', payment_terms:f.paymentTerms||'30',
      payment_method:f.paymentMethod||'', min_order:f.minOrder||'',
      discount:f.discount||'0', rating:f.rating||3,
      active:f.active!==false, notes:f.notes||'', updated_at:now
    };
    // Optimistic UI update
    if(isEdit) setSuppliers(ss=>ss.map(s=>s.id===id?{...s,...f}:s));
    else setSuppliers(ss=>[...ss,{...f,id}]);
    setModal(null); setEditSup(null);
    // Write to Supabase (source of truth)
    try {
      await db.upsert('suppliers', supplierData);
    } catch(e) {
      console.warn('[Stock] saveSupplier SB failed:',e);
      setSyncToast({msg:'Error al guardar proveedor. Cambio guardado localmente — se sincronizará al reconectar.', type:'error'});
      setTimeout(()=>setSyncToast(null), 6000);
      setHasPendingSync(true);
    }
    // Audit log
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),action:'proveedor_guardado',detail:JSON.stringify({isEdit,id,nombre:supplierData.name})}); }catch(e){}
  };
  const deleteSupplier=async id=>{
    if(products.some(p=>p.supplierId===id)){alert('No se puede eliminar: hay productos asociados a este proveedor.');return;}
    if(!window.confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    const snap = suppliers; // save for rollback
    setSuppliers(ss=>ss.filter(s=>s.id!==id));
    // Delete from Supabase (source of truth)
    try {
      await db.del('suppliers',{id});
    } catch(e) {
      console.warn('[Stock] deleteSupplier SB failed:',e);
      setSuppliers(snap); // rollback UI
      setSyncToast({msg:'Error al eliminar proveedor del servidor. El proveedor fue restaurado.', type:'error'});
      setTimeout(()=>setSyncToast(null), 6000);
      return;
    }
    // Audit log
    const now=new Date().toISOString();
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),action:'proveedor_eliminado',detail:JSON.stringify({id})}); }catch(e){}
  };

  const deleteProduct=async id=>{
    if(!window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    const snapshot = products; // save for rollback
    setProducts(ps=>ps.filter(p=>p.id!==id));
    // Delete from Supabase (source of truth)
    try {
      await db.del('products',{uuid:id}); // uuid is our TEXT id
    } catch(e) {
      console.warn('[Stock] deleteProduct SB failed:',e);
      setProducts(snapshot); // rollback UI
      setSyncToast({msg:'Error al eliminar producto del servidor. El producto fue restaurado.', type:'error'});
      setTimeout(()=>setSyncToast(null), 6000);
      return;
    }
    const now=new Date().toISOString();
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch(e){return 'unknown';}})(),action:'producto_eliminado',detail:JSON.stringify({id})}); }catch(e){}
  };

  const sendAlertEmail = async (alertProducts, cfg) => {
    if(!cfg.enabled||!cfg.serviceId||!cfg.templateId||!cfg.publicKey||!cfg.toEmail) return;
    if(!alertProducts.length) return;
    try {
      const rows = alertProducts.map(p=>`
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 14px;font-weight:600;">${p.name}</td>
          <td style="padding:10px 14px;color:#b91c1c;font-weight:700;">${p.alert.level==="order_now"?"🔴 PEDIR YA":"🟡 Pedir pronto"}</td>
          <td style="padding:10px 14px;">${p.stock} ${p.unit}</td>
          <td style="padding:10px 14px;">${p.alert.rop} ${p.unit}</td>
          <td style="padding:10px 14px;font-weight:600;">${p.alert.eoq||"—"} ${p.unit}</td>
        </tr>`).join("");
      const html = `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2d5a1b;padding:20px 24px;">
          <h1 style="color:#fff;font-size:22px;margin:0;">Alerta de Stock</h1>
          <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px;">${new Date().toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
        <div style="padding:20px 24px;background:#fef2f2;border-left:4px solid #b91c1c;">
          <p style="font-size:14px;color:#b91c1c;font-weight:700;margin:0;">${alertProducts.length} producto${alertProducts.length>1?"s requieren":"requiere"} atención inmediata</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:0;">
          <thead><tr style="background:#f5f0e8;">
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Producto</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Estado</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Stock actual</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Punto de pedido</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Cantidad sugerida</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="padding:20px 24px;background:#f5f0e8;margin-top:20px;">
          <p style="font-size:12px;color:#7a7368;margin:0;">Este email fue enviado automáticamente por el sistema de gestión de stock.</p>
        </div>
      </div>`;
      await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: {
            to_email: cfg.toEmail,
            subject: `Stock — ${alertProducts.length} producto${alertProducts.length>1?"s":""}  ${alertProducts.some(p=>p.alert.level==="order_now")?"requieren pedido URGENTE":"requieren atención"}`,
            html_content: html,
            alert_count: alertProducts.length,
          }
        })
      });
    } catch(e){ console.warn("Email error:", e); }
  };

  const addMov=(m)=>{
    const mov={...m,id:crypto.randomUUID(),ts:new Date().toISOString()};
    setMovements(ms=>[mov,...ms]);
    // Persist to Supabase in real time (non-blocking)
    db.insert('stock_movements',{
      id:mov.id,
      product_id:mov.productId||null,
      product_name:mov.productName||null,
      type:mov.type||'manual',
      qty:Number(mov.qty)||0,
      unit:mov.unit||'',
      stock_after:mov.stockAfter!=null?Number(mov.stockAfter):null,
      note:mov.note||null,
      supplier_name:mov.supplierName||null,
      user_name:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'sistema';}catch(e){return 'sistema';}})(),
      ts:mov.ts,
      created_at:mov.ts,
    }).catch(e=>console.warn('[Stock] addMov SB failed:',e));
  };

  const checkAndNotify = (currentProducts, currentSuppliers, cfg, currentNotified) => {
    if(!cfg?.enabled) return;
    const toAlert = [];
    const newNotified = {...currentNotified};
    currentProducts.forEach(p => {
      const sup = currentSuppliers.find(s=>s.id===p.supplierId);
      const al = alertLevel(p, sup);
      const key = p.id;
      const shouldAlert = al.level==="order_now"||al.level==="order_soon";
      const alreadyNotified = currentNotified[key] === al.level;
      if(shouldAlert && !alreadyNotified){
        toAlert.push({...p, sup, alert:al});
        newNotified[key] = al.level;
      }
      if(!shouldAlert && currentNotified[key]){
        delete newNotified[key];
      }
    });
    if(toAlert.length > 0){
      setNotified(newNotified);
      sendAlertEmail(toAlert, cfg);
    }
  };

  const NAV_ALL=[
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"inventory",label:"Inventario",icon:"📦"},
    {id:"orders",label:"Pedidos",icon:"🛒"},
    {id:"suppliers",label:"Proveedores",icon:"🏭"},
    {id:"clientes",label:"Clientes",icon:"👥"},
    {id:"ventas",label:"Ventas",icon:"🧾"},
    {id:"facturacion",label:"Facturación",icon:"📄"},
    {id:"movimientos",label:"Movimientos",icon:"🔄"},
    {id:"lotes",label:"Lotes/Venc.",icon:"📅"},{id:"conteo",label:"Conteo",icon:"🔢"},{id:"transferencias",label:"Transferencias",icon:"↕"},
    {id:"deposito",label:"Depósito",icon:"🗂"},
    {id:"rutas",label:"Rutas",icon:"🚛"},
    {id:"tracking",label:"Tracking",icon:"📍"},
    {id:"kpis",label:"KPIs",icon:"📈"},
    {id:"recepcion",label:"Recepcion",icon:"📥"},{id:"packing",label:"Packing",icon:"📦"},{id:"batch-picking",label:"Batch Pick",icon:"📋"},
    {id:"informes",label:"Informes",icon:"📋"},{id:"devoluciones",label:"Devoluciones",icon:"↩"},{id:"precios",label:"Precios",icon:"💲"},{id:"demanda",label:"Demanda",icon:"📈"},{id:"audit",label:"Auditoría",icon:"📋"},
    {id:"importar",label:"Importar datos",icon:"📂"},
    {id:"scanner",label:"Scanner",icon:"📷"},
    {id:"config",label:"Config",icon:"⚙"},
  ];
  const NAV_ROLES={
    admin:["dashboard","inventory","orders","suppliers","clientes","ventas","facturacion","movimientos","lotes","deposito","tracking","kpis","recepcion","informes","demanda","audit","importar","scanner","config"],
    operador:["dashboard","inventory","movimientos","lotes","deposito","rutas","tracking","recepcion","scanner"],
    vendedor:["dashboard","clientes","ventas","facturacion","kpis","informes"]
  };
  const NAV=NAV_ALL.filter(n=>(NAV_ROLES[session?.role||"admin"]||NAV_ROLES.admin).includes(n.id));
  const canTab=(id)=>(NAV_ROLES[session?.role||'admin']||NAV_ROLES.admin).includes(id);
  const activeTab=canTab(tab)?tab:(NAV_ROLES[session?.role||'admin']||NAV_ROLES.admin)[0];

  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];

  return(
    <>
      {session && !dbReady && (
        <div style={{position:"fixed",inset:0,background:"#f9f9f7",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:9999}}>
          <style>{CSS}</style>
          <img src="/aryes-logo.png" alt="Aryes" style={{height:52,objectFit:"contain"}} onError={e=>e.target.style.display="none"} />
          <div style={{width:32,height:32,border:"3px solid #3a7d1e",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <p style={{fontFamily:"Inter,sans-serif",fontSize:14,color:"#6a6a68",fontWeight:500}}>Conectando...</p>
          <p style={{fontFamily:"Inter,sans-serif",fontSize:12,color:"#aaa",marginTop:4}}>Si tardás más de 5 seg, recargá la página</p>
          <style>{"@keyframes spin{to{transform:rotate(360deg);}}"}</style>
        </div>
      )}
      {session && dbReady && <div style={{display:"flex",minHeight:"100vh",background:T.bg}}>
      <style>{CSS}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{overflowY:"auto",width:220,background:T.card,borderRight:`1px solid ${T.border}`,position:"fixed",top:0,left:0,bottom:0,display:"flex",flexDirection:"column"}}>
        {/* Logo */}
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${T.border}`}}>
          {brandCfg.logoUrl
            ? <img src={brandCfg.logoUrl} alt={brandCfg.name||'Logo'} style={{height:52,objectFit:'contain',maxWidth:"100%"}} onError={e=>{e.target.style.display='none';}}/>
            : <img src="/logo.png" alt="Logo" style={{height:52,objectFit:'contain',maxWidth:"100%"}} onError={e=>{e.target.style.display='none';}}/>
          }
          {syncStatus==='sync'&&<div style={{fontSize:10,color:'#9a9a98',marginTop:3}}>↻ Sincronizando...</div>}
          {syncStatus==='ok'&&<div style={{fontSize:10,color:'#3a7d1e',marginTop:3}}>✓ Sincronizado</div>}
          {syncStatus==='error'&&<div style={{fontSize:10,color:'#d97706',marginTop:3}}>⚠ Modo local</div>}
          {hasPendingSync&&<div style={{fontSize:10,color:'#d97706',marginTop:3,fontWeight:600}}>⚠ Sync pendiente</div>}
          <div style={{marginTop:6}}><Cap style={{color:brandCfg.color||T.green}}>{brandCfg.name||'Gestión de stock'}</Cap></div>
        </div>

        {/* Nav — grouped */}
        <nav style={{padding:"10px 0",flex:1,overflowY:"auto"}}>
          {(()=>{
            const role=session?.role||"admin";
            const visibleIds=NAV_ROLES[role]||NAV_ROLES.admin;
            const groups=[
              {label:"Principal",ids:["dashboard","inventory","orders","suppliers"]},
              {label:"Operaciones",ids:["movimientos","lotes","deposito","rutas","tracking","recepcion","scanner"]},
              {label:"Comercial",ids:["clientes","ventas","facturacion"]},
              {label:"Análisis",ids:["kpis","informes","demanda","audit"]},
              {label:"Sistema",ids:["importar","config"]},
            ];
            return groups.map(g=>{
              const items=NAV.filter(n=>g.ids.includes(n.id)&&n.id!=="usuarios");
              if(!items.length) return null;
              return React.createElement(React.Fragment,{key:g.label},
                React.createElement('div',{style:{padding:"12px 18px 4px",fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textXs}},g.label),
                items.map(n=>
                  React.createElement('button',{key:n.id,onClick:()=>setTab(n.id),
                    style:{width:"100%",textAlign:"left",padding:"8px 18px",background:tab===n.id?T.greenBg:"none",border:"none",borderLeft:tab===n.id?`3px solid ${T.green}`:`3px solid transparent`,fontFamily:T.sans,fontSize:13,fontWeight:tab===n.id?600:400,color:tab===n.id?T.green:T.textSm,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,borderRadius:"0 6px 6px 0",marginRight:8,transition:"background .15s"}},
                    React.createElement('span',{style:{display:"flex",alignItems:"center",gap:8}},
                      React.createElement('span',{style:{fontSize:14,lineHeight:1,opacity:tab===n.id?1:0.7}},n.icon),
                      n.label
                    ),
                    (()=>{
                        const cfesLS = (()=>{try{return JSON.parse(localStorage.getItem('aryes-cfe')||'[]');}catch(e){return [];}})();
                        const vencidasN = cfesLS.filter(f=>['emitida','cobrado_parcial'].includes(f.status)&&f.fechaVenc&&Math.floor((new Date(f.fechaVenc).getTime()-Date.now())/86400000)<0).length;
                        const pendOrders = orders.filter(o=>o.status==='pending').length;
                        if(n.id==='dashboard'&&critN>0) return React.createElement('span',{style:{background:T.danger,color:'#fff',fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:10,minWidth:18,textAlign:'center'}},critN);
                        if(n.id==='inventory'&&critN>0) return React.createElement('span',{style:{background:T.danger,color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}},critN);
                        if(n.id==='orders'&&pendOrders>0) return React.createElement('span',{style:{background:T.amber,color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}},pendOrders);
                        if(n.id==='facturacion'&&vencidasN>0) return React.createElement('span',{style:{background:T.danger,color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}},vencidasN);
                        return null;
                      })()
                  )
                )
              );
            });
          })()}
        </nav>


      

      </aside>

      {/* ── MAIN ── */}
      <main id="main-content" style={{marginLeft:220,flex:1,height:"100vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>

        {/* ── TOPBAR ── */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 44px",height:56,background:T.card,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
          {/* Search */}
          <div style={{flex:1,maxWidth:380,position:"relative"}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textXs,pointerEvents:"none"}}>🔍</span>
            <input
              readOnly
              onClick={()=>setCmdOpen(true)}
              placeholder="Buscar todo…  ⌘K"
              style={{width:"100%",boxSizing:"border-box",padding:"7px 12px 7px 32px",border:`1px solid ${T.border}`,borderRadius:8,fontFamily:T.sans,fontSize:13,color:T.textXs,background:T.muted,outline:"none",cursor:"pointer"}}
            />
          </div>
          <div style={{flex:1}}/>
          <button onClick={()=>setCmdOpen(true)} title="Paleta de comandos (⌘K)"
            style={{display:'flex',alignItems:'center',gap:6,background:T.muted,border:`1px solid ${T.border}`,
              borderRadius:7,padding:'5px 10px',cursor:'pointer',fontFamily:T.sans,fontSize:11,
              color:T.textSm,transition:'all .12s',marginRight:8}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#3a7d1e';e.currentTarget.style.color='#3a7d1e';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.textSm;}}>
            <span style={{fontSize:13}}>⌘</span>
            <span>K</span>
          </button>

          {/* User pill with dropdown */}
          {React.createElement(UserMenuDropdown,{session,userMenuOpen,setUserMenuOpen,canTab,setTab,handleLogout,T})}
        </div>

        <div style={{padding:"36px 44px",flex:1}}>

        {syncToast&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,background:syncToast.type==="info"?"#eff6ff":"#fef3c7",border:"1px solid "+(syncToast.type==="info"?"#bfdbfe":"#fde68a"),borderRadius:8,padding:"12px 18px",boxShadow:"0 4px 16px rgba(0,0,0,.12)",display:"flex",alignItems:"center",gap:10,animation:"fadeUp .25s ease both",maxWidth:360}}>
        <span style={{fontSize:18}}>{syncToast.type==="info"?"🔄":"⚠️"}</span>
        <span style={{fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:600,color:syncToast.type==="info"?"#1d4ed8":"#92400e"}}>{syncToast.msg}</span>
      </div>}
      {hasPendingSync&&<div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:6,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>⚠️</span>
        <span style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"#92400e",fontWeight:600}}>Cambios pendientes de sincronización — reconectando...</span>
      </div>}
      {/* ══ DASHBOARD ══ */}
        {activeTab==="dashboard"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,color:'#888',fontSize:14}}>Cargando...</div>}><DashboardInline products={products} suppliers={suppliers} orders={orders} movements={movements} session={session} setTab={setTab} critN={critN} alerts={alerts} enriched={enriched} setModal={setModal} tfCols={tfCols}/></Suspense></ErrorBoundary>}

        {activeTab==="inventory"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,color:'#888',fontSize:14}}>Cargando...</div>}><InventoryInline products={products} enriched={enriched} setModal={setModal} setEditProd={setEditProd} setProducts={setProducts} deleteProduct={deleteProduct}/></Suspense></ErrorBoundary>}
        {activeTab==="orders"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,color:'#888',fontSize:14}}>Cargando...</div>}><PedidosInline products={products} setProducts={setProducts} suppliers={suppliers} orders={orders} setOrders={setOrders} addMov={addMov} movements={movements} session={session} modal={modal} setModal={setModal} plans={plans} setPlans={setPlans} savePlan={savePlan} tab={tab} getSup={getSup} markDelivered={markDelivered} setTab={setTab} tfCols={tfCols}/></Suspense></ErrorBoundary>}

        {/* ══ SUPPLIERS ══ */}
        {activeTab==="suppliers"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,color:'#888',fontSize:14}}>Cargando...</div>}><ProveedoresInline suppliers={suppliers} setSuppliers={setSuppliers} products={products} orders={orders} setOrders={setOrders} addMov={addMov} session={session} alerts={alerts} enriched={enriched} tab={tab} setModal={setModal} setEditSup={setEditSup} setViewSup={setViewSup} deleteSupplier={deleteSupplier}/></Suspense></ErrorBoundary>}
        {activeTab==="scanner"&&<div className="au"><Scanner products={products} suppliers={suppliers} onUpdate={(id,qty,name,unit)=>{const p2=products.find(p=>p.id===id);const sup2=p2?suppliers.find(s=>s.id===p2.supplierId):null;setProducts(ps=>ps.map(p=>p.id===id?{...p,stock:p.stock+qty}:p));addMov({type:"scanner_in",productId:id,productName:name||p2?.name||id,supplierId:p2?.supplierId||"",supplierName:sup2?.name||"",qty,unit:unit||p2?.unit||"",note:"Ingreso por scanner"});}}/></div>}

        {activeTab==="config"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40,color:'#888',fontSize:14}}>Cargando...</div>}><ConfigInline session={session} suppliers={suppliers} setSuppliers={setSuppliers} settingsTab={settingsTab} setSettingsTab={setSettingsTab} emailCfg={emailCfg} setEmailCfg={setEmailCfg} enriched={enriched} sendAlertEmail={sendAlertEmail} EmailSettings={EmailSettings} totalLead={totalLead} tfCols={tfCols} brandCfg={brandCfg} setBrandCfg={setBrandCfg}/></Suspense></ErrorBoundary>}
        {activeTab==="lotes"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><LotesTab /></Suspense>}
      {activeTab==="clientes"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><ClientesTab /></Suspense></ErrorBoundary>}
      {activeTab==="movimientos"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><MovimientosTab /></Suspense>}
      
      {activeTab==="deposito"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><DepositoTab /></Suspense>}
      
      {activeTab==="rutas"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><RutasTab /></Suspense></ErrorBoundary>}
      
        {activeTab==="recepcion"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><RecepcionTab /></Suspense>}
        
        {activeTab==="ventas"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><VentasTab products={products} setProducts={setProducts} addMov={addMov}/></Suspense>}
        {activeTab==="facturacion"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><FacturacionTab products={products} clientes={LS.get("aryes-clients",[])}/></Suspense></ErrorBoundary>}
        
        {activeTab==="importar"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><ImportTab /></Suspense>}
        
        {activeTab==="informes"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><InformesTab /></Suspense>}
        
        {activeTab==="conteo"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><ConteoTab /></Suspense>}
        {activeTab==="packing"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><PackingTab /></Suspense></ErrorBoundary>}
        {activeTab==="batch-picking"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><BatchPickingTab /></Suspense>}
        {activeTab==="transferencias"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><TransferenciasTab /></Suspense>}
        
        {activeTab==="kpis"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><KPIsTab /></Suspense></ErrorBoundary>}
        {activeTab==="tracking"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><TrackingTab session={session} /></Suspense>}
        
        {activeTab==="devoluciones"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><DevolucionesTab /></Suspense>}
        {activeTab==="precios"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><PreciosTab /></Suspense></ErrorBoundary>}
        {activeTab==="demanda"&&<Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><DemandaTab /></Suspense>}
        {activeTab==="audit"&&<ErrorBoundary><Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:32,color:'#aaa',fontSize:13}}>Cargando...</div>}><AuditTab /></Suspense></ErrorBoundary>}
        </div>
        </main>

      {/* ══ COMMAND PALETTE ══ */}
        {React.createElement(ToastContainer,{
          toasts:smartToasts, onDismiss:dismissToast, setTab
        }),
        React.createElement(CommandPalette,{
          open:cmdOpen,
          onClose:()=>setCmdOpen(false),
          products:enriched||[],
          clientes:LS.get('aryes-clients',[]),
          cfes:LS.get('aryes-cfe',[]),
          setTab,
          onNewCFE:()=>{setTab('facturacion');setCmdOpen(false);}
        })}
        {/* ══ MODALS ══ */}
      {modal?.type==="product"&&<Modal title={editProd?"Editar producto":"Nuevo producto"} sub="Inventario" onClose={()=>{setModal(null);setEditProd(null);}}><ProductForm product={editProd} suppliers={suppliers} onSave={saveProduct} onClose={()=>{setModal(null);setEditProd(null);}}/></Modal>}
      {modal?.type==="order"&&<OrderModal product={modal.product} supplier={getSup(modal.product.supplierId)} onConfirm={qty=>confirmOrder(modal.product,qty)} onClose={()=>setModal(null)}/>}
      {modal?.type==="orderDone"&&(
        <Modal title={modal.order.productName} sub="Pedido registrado correctamente" onClose={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:6,overflow:"hidden",marginBottom:20}}>
            {[{l:"Cantidad",v:`${modal.order.qty} ${modal.order.unit}`},{l:"Costo estimado",v:`USD ${modal.order.totalCost}`},{l:"Fecha pedido",v:fmtDate(modal.order.orderedAt)},{l:"Llegada estimada",v:fmtDate(modal.order.expectedArrival)}].map((s,i)=>(
              <div key={i} style={{background:T.cardWarm,padding:"14px 16px"}}>
                <Cap>{s.l}</Cap>
                <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:T.text,marginTop:5}}>{s.v}</div>
              </div>
            ))}
          </div>
          <Btn onClick={()=>setModal(null)} full>Entendido</Btn>
        </Modal>
      )}
      {modal?.type==="excel"&&<ExcelModal products={products} onApply={applyExcel} onClose={()=>setModal(null)}/>}
      {modal?.type==="supplierForm"&&(
        <Modal title={editSup?"Editar proveedor":"Nuevo proveedor"} sub="Proveedores" onClose={()=>{setModal(null);setEditSup(null);}} wide>
          <SupplierForm supplier={editSup} onSave={saveSupplier} onClose={()=>{setModal(null);setEditSup(null);}}/>
        </Modal>
      )}
      {viewSup&&(
        <SupplierDetail
          supplier={viewSup}
          products={products}
          orders={orders}
          onEdit={()=>{setEditSup(viewSup);setViewSup(null);setModal({type:"supplierForm"});}}
          onClose={()=>setViewSup(null)}
        />
      )}
    
      <AIChatFloat session={session} products={products} suppliers={suppliers} orders={orders} movements={movements}/>
      </div>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// EXTRACTED INLINE TAB COMPONENTS (refactored from main render)
// ═══════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════
// AI CHAT FLOAT — inline (no separate file, no circular dep)
// ══════════════════════════════════════════════════════════


const _QUICK = {
  admin:    ['¿Qué productos están en stock crítico?','¿Los 5 con menor stock?','Resumen del depósito','Pedidos pendientes'],
  operador: ['¿Qué reponer urgente?','Productos en cero','Recepciones pendientes','Movimientos recientes'],
  vendedor: ['¿Qué hay disponible?','Precios de productos','Mis ventas recientes','¿Qué puedo vender?'],
};

function _buildCtx(role,products,suppliers,orders,movements){
  const low=(products||[]).filter(p=>Number(p.stock)<=Number(p.minStock)).slice(0,20);
  const zero=(products||[]).filter(p=>Number(p.stock)===0).slice(0,10);
  if(role==='vendedor') return {rol:'Vendedor',disponibles:(products||[]).map(p=>({n:p.nombre,m:p.marca,s:p.stock,p:p.precioVenta||p.precio})).slice(0,80),bajo_stock:low.map(p=>p.nombre)};
  if(role==='operador') return {rol:'Operador',productos:(products||[]).map(p=>({n:p.nombre,s:p.stock,min:p.minStock})).slice(0,100),criticos:zero.map(p=>p.nombre),movimientos:(movements||[]).slice(0,15),pedidos:(orders||[]).filter(o=>o.estado==='pendiente').slice(0,10)};
  return {rol:'Admin',total_productos:(products||[]).length,en_cero:zero.length,bajo_minimo:low.length,proveedores:(suppliers||[]).length,pedidos_pendientes:(orders||[]).filter(o=>o.estado==='pendiente').length,productos:(products||[]).map(p=>({n:p.nombre,m:p.marca,s:p.stock,min:p.minStock,p:p.precioVenta||p.precio})).slice(0,100),criticos:zero.map(p=>p.nombre),movimientos:(movements||[]).slice(0,20),pedidos:(orders||[]).filter(o=>o.estado==='pendiente').slice(0,15)};
}

function AIChatFloat({session,products,suppliers,orders,movements}){
  const [open,setOpen]=React.useState(false);
  const [msgs,setMsgs]=React.useState([]);
  const [input,setInput]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [unread,setUnread]=React.useState(0);
  const endRef=React.useRef(null);
  const inRef=React.useRef(null);
  const role=session?.role||'admin';
  // AI chat proxied via /api/chat — no key in frontend

  React.useEffect(()=>{if(open){setUnread(0);setTimeout(()=>inRef.current?.focus(),80);}}, [open]);
  React.useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  React.useEffect(()=>{
    if(open&&msgs.length===0) setMsgs([{r:'a',t:'Hola'+(session?.email?' '+session.email.split('@')[0]:'')+'! Soy tu asistente de inventario. Preguntame sobre stock, precios, pedidos o pedí un informe.'}]);
  },[open]);

  const send=async(txt)=>{
    const text=txt||input.trim();
    if(!text||busy) return;
    // no-op: proxy handles missing key gracefully
    setInput('');
    const next=[...msgs,{r:'u',t:text}];
    setMsgs(next);setBusy(true);
    try{
      const ctx=_buildCtx(role,products,suppliers,orders,movements);
      const sys='Sos el asistente de stock, WMS para gestión de inventario. Adaptá las respuestas al negocio. Respondé en español, conciso y directo. Usá solo los datos del contexto. Podés sugerir acciones concretas. Máx 200 palabras salvo informes.\n\nContexto:\n'+JSON.stringify(ctx,null,1);
      const sessionToken=(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.access_token||'';}catch(e){return '';}})();
      const r=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionToken},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,system:sys,messages:next.map(m=>({role:m.r==='u'?'user':'assistant',content:m.t}))})
      });
      const d=await r.json();
      const reply=d.content?.[0]?.text||'No pude procesar la respuesta.';
      setMsgs(p=>[...p,{r:'a',t:reply}]);
      if(!open) setUnread(n=>n+1);
    }catch(e){
      setMsgs(p=>[...p,{r:'a',t:'Error de conexión. Verificá tu internet e intentá de nuevo.'}]);
    }finally{setBusy(false);}
  };

  const G='#3a7d1e';
  const S={
    btn:{position:'fixed',bottom:24,right:24,zIndex:9999,width:52,height:52,borderRadius:16,background:open?'#f0f7ec':G,border:open?'1.5px solid #b8d9a8':'none',cursor:'pointer',boxShadow:open?'none':'0 2px 8px rgba(58,125,30,.3)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .18s',flexShrink:0},
    panel:{position:'fixed',bottom:84,right:24,zIndex:9998,width:368,height:520,background:'#ffffff',borderRadius:20,boxShadow:'0 8px 32px rgba(0,0,0,.1)',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',border:'0.5px solid #e2e2de'},
    header:{background:'#ffffff',borderBottom:'0.5px solid #e2e2de',padding:'14px 16px',display:'flex',alignItems:'center',gap:11,flexShrink:0},
    msgs:{flex:1,overflowY:'auto',padding:'14px 14px 6px',display:'flex',flexDirection:'column',gap:10,background:'#ffffff'},
    input:{padding:'10px 12px',borderTop:'0.5px solid #e2e2de',display:'flex',gap:8,flexShrink:0,background:'#f9f9f7',alignItems:'flex-end'},
  };

  const chatIcon=React.createElement('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('path',{d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'}));
  const chatIconSm=React.createElement('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:G,strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('path',{d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'}));
  const sendIcon=React.createElement('svg',{width:15,height:15,viewBox:'0 0 24 24',fill:'none',stroke:'#fff',strokeWidth:2.2,strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('line',{x1:22,y1:2,x2:11,y2:13}),React.createElement('polygon',{points:'22 2 15 22 11 13 2 9 22 2',fill:'#fff',stroke:'none'}));

  return React.createElement(React.Fragment,null,
    // ── Trigger button ──
    React.createElement('button',{onClick:()=>setOpen(o=>!o),style:S.btn,'aria-label':'Asistente IA'},
      open
        ? React.createElement('span',{style:{fontSize:14,color:G,lineHeight:1}},'✕')
        : React.createElement('span',{style:{color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}},chatIcon),
      unread>0&&!open&&React.createElement('span',{style:{position:'absolute',top:-5,right:-5,background:'#e24b4a',color:'#fff',borderRadius:'50%',width:19,height:19,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #f9f9f7'}},unread)
    ),
    // ── Panel ──
    open&&React.createElement('div',{style:S.panel},
      // Header
      React.createElement('div',{style:S.header},
        React.createElement('div',{style:{width:36,height:36,borderRadius:11,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},chatIconSm),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontWeight:600,fontSize:13,color:'#1a1a18',lineHeight:1.2}},'Asistente de stock'),
          React.createElement('div',{style:{fontSize:11,color:'#9a9a98',marginTop:3,display:'flex',alignItems:'center',gap:5}},
            React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:G,flexShrink:0}},null),
            'Activo',
            React.createElement('span',{style:{color:'#d3d3d0'}},'·'),
            React.createElement('span',{style:{textTransform:'capitalize'}},role==='admin'?'Admin':role==='operador'?'Operador':'Vendedor')
          )
        ),
        React.createElement('button',{onClick:()=>setOpen(false),style:{width:28,height:28,borderRadius:8,border:'0.5px solid #e2e2de',background:'#f4f4f1',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}},React.createElement('span',{style:{fontSize:13,color:'#6a6a68',lineHeight:1}},'✕'))
      ),
      // Messages
      React.createElement('div',{style:S.msgs},
        msgs.map((m,i)=>React.createElement('div',{key:i,style:{display:'flex',justifyContent:m.r==='u'?'flex-end':'flex-start',alignItems:'flex-end',gap:7}},
          m.r==='a'&&React.createElement('div',{style:{width:24,height:24,borderRadius:7,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginBottom:1}},chatIconSm),
          React.createElement('div',{style:{maxWidth:'78%',padding:'10px 13px',borderRadius:m.r==='u'?'16px 16px 4px 16px':'4px 16px 16px 16px',background:m.r==='u'?G:'#f4f4f1',color:m.r==='u'?'#fff':'#1a1a18',fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap',wordBreak:'break-word'}},m.t)
        )),
        busy&&React.createElement('div',{style:{display:'flex',alignItems:'flex-end',gap:7}},
          React.createElement('div',{style:{width:24,height:24,borderRadius:7,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},chatIconSm),
          React.createElement('div',{style:{padding:'10px 14px',borderRadius:'4px 16px 16px 16px',background:'#f4f4f1',display:'flex',gap:4,alignItems:'center'}},
            ...[0,1,2].map(j=>React.createElement('span',{key:j,style:{width:6,height:6,borderRadius:'50%',background:'#b4b4b2',animation:`bounce 1.2s ease ${j*0.2}s infinite`}}))
          )
        ),
        React.createElement('div',{ref:endRef})
      ),
      // Quick chips
      msgs.length<=1&&!busy&&React.createElement('div',{style:{padding:'4px 14px 10px',display:'flex',flexWrap:'wrap',gap:6,flexShrink:0}},
        (_QUICK[role]||_QUICK.admin).map((q,i)=>React.createElement('button',{key:i,onClick:()=>send(q),style:{fontSize:11,padding:'5px 11px',borderRadius:20,border:'0.5px solid #d8d8d4',background:'#f9f9f7',cursor:'pointer',color:'#4a4a48',lineHeight:1.3,fontFamily:'inherit',transition:'background .12s'},onMouseEnter:e=>e.currentTarget.style.background='#f0f0ec',onMouseLeave:e=>e.currentTarget.style.background='#f9f9f7'},q))
      ),
      // Input area
      React.createElement('div',{style:S.input},
        React.createElement('textarea',{ref:inRef,value:input,onChange:e=>setInput(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}},placeholder:'Preguntá sobre stock, precios...',rows:1,style:{flex:1,border:'0.5px solid #d8d8d4',borderRadius:12,padding:'9px 13px',fontSize:13,resize:'none',fontFamily:'inherit',outline:'none',lineHeight:1.45,maxHeight:80,overflowY:'auto',background:'#ffffff',color:'#1a1a18'}}),
        React.createElement('button',{onClick:()=>send(),disabled:!input.trim()||busy,style:{width:36,height:36,borderRadius:10,background:input.trim()&&!busy?G:'#e0e0dc',border:'none',cursor:input.trim()&&!busy?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background .15s'}},sendIcon)
      )
    )
  );
}

export default AryesApp;
// deploy trigger Sun Mar 22 01:46:08 UTC 2026
