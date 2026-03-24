import React from 'react';

const F = { sans: "'DM Sans','Inter',system-ui,sans-serif", mono: "'DM Mono','Fira Code',monospace" };

const CommandPalette = ({ open, onClose, products, clientes, cfes, setTab, onNewCFE }) => {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    if (open) { setQ(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  React.useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (open) onClose(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const NAV_ACTIONS = [
    { type:'nav', id:'dashboard',   icon:'📊', label:'Dashboard',      group:'Navegar' },
    { type:'nav', id:'inventory',   icon:'📦', label:'Inventario',     group:'Navegar' },
    { type:'nav', id:'orders',      icon:'🛒', label:'Pedidos',        group:'Navegar' },
    { type:'nav', id:'suppliers',   icon:'🏭', label:'Proveedores',    group:'Navegar' },
    { type:'nav', id:'clientes',    icon:'👥', label:'Clientes',       group:'Navegar' },
    { type:'nav', id:'facturacion', icon:'📄', label:'Facturación',    group:'Navegar' },
    { type:'nav', id:'movimientos', icon:'🔄', label:'Movimientos',    group:'Navegar' },
    { type:'nav', id:'kpis',        icon:'📈', label:'KPIs',           group:'Navegar' },
    { type:'nav', id:'config',      icon:'⚙',  label:'Configuración', group:'Navegar' },
    { type:'action', icon:'🧾', label:'Nueva factura CFE', group:'Acciones', action: () => { onNewCFE?.(); onClose(); } },
    { type:'action', icon:'📦', label:'Nuevo pedido',      group:'Acciones', action: () => { setTab('orders'); onClose(); } },
    { type:'action', icon:'👤', label:'Nuevo cliente',     group:'Acciones', action: () => { setTab('clientes'); onClose(); } },
  ];

  const results = React.useMemo(() => {
    if (!q.trim()) return NAV_ACTIONS.slice(0, 8);
    const lo = q.toLowerCase();
    const navMatches = NAV_ACTIONS.filter(a => a.label.toLowerCase().includes(lo));
    const prodMatches = (products||[]).filter(p => p.name.toLowerCase().includes(lo)).slice(0,4).map(p => ({
      type:'product', icon:'📦', label:p.name,
      sub:`Stock: ${p.stock} ${p.unit} · ${p.alert?.label||''}`, group:'Productos',
      action: () => { setTab('inventory'); onClose(); }
    }));
    const cliMatches = (clientes||[]).filter(c => (c.nombre||'').toLowerCase().includes(lo)).slice(0,3).map(c => ({
      type:'client', icon:'👥', label:c.nombre, sub:c.tipo||'', group:'Clientes',
      action: () => { setTab('clientes'); onClose(); }
    }));
    const cfeMatches = (cfes||[]).filter(f => (f.numero||'').toLowerCase().includes(lo)||(f.clienteNombre||'').toLowerCase().includes(lo)).slice(0,3).map(f => ({
      type:'cfe', icon:'🧾', label:f.numero||'CFE',
      sub:`${f.clienteNombre} · $${f.total?.toFixed(0)||0}`, group:'Facturas',
      action: () => { setTab('facturacion'); onClose(); }
    }));
    return [...navMatches, ...prodMatches, ...cliMatches, ...cfeMatches].slice(0,12);
  }, [q, products, clientes, cfes]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { setCursor(0); }, [results.length]);

  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    else if (e.key === 'Enter' && results[cursor]) {
      const r = results[cursor];
      if (r.action) r.action(); else if (r.type === 'nav') { setTab(r.id); onClose(); }
    }
  };

  const execResult = r => {
    if (r.action) r.action(); else if (r.type === 'nav') { setTab(r.id); onClose(); }
  };

  if (!open) return null;

  const grouped = {};
  results.forEach((r, i) => { if (!grouped[r.group]) grouped[r.group] = []; grouped[r.group].push({ ...r, _idx: i }); });

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9000, display:'flex', alignItems:'flex-start',
        justifyContent:'center', paddingTop:'15vh', background:'rgba(10,10,8,.6)', backdropFilter:'blur(6px)' }}
      onClick={onClose}
    >
      <div
        style={{ width:580, background:'#fff', borderRadius:16, overflow:'hidden',
          boxShadow:'0 24px 80px rgba(0,0,0,.25)', border:'1px solid #e2e2de' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid #f0f0ec' }}>
          <span style={{ fontSize:18, opacity:.4 }}>🔍</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar o ejecutar… (navegar, productos, clientes, facturas)"
            style={{ flex:1, border:'none', outline:'none', fontFamily:F.sans, fontSize:15, color:'#1a1a18', background:'transparent', padding:0 }}
          />
          <kbd style={{ background:'#f0f0ec', border:'1px solid #d4d4d0', borderRadius:5, padding:'2px 7px', fontFamily:F.mono, fontSize:11, color:'#6a6a68' }}>ESC</kbd>
        </div>

        {Object.entries(grouped).length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'#9a9a98', fontFamily:F.sans, fontSize:13 }}>Sin resultados</div>
        ) : (
          <div style={{ maxHeight:380, overflowY:'auto', padding:'8px 0' }}>
            {Object.entries(grouped).map(([group, items]) => (
              <React.Fragment key={group}>
                <div style={{ padding:'8px 18px 4px', fontFamily:F.sans, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#9a9a98' }}>{group}</div>
                {items.map(r => (
                  <button key={r._idx} onClick={() => execResult(r)} onMouseEnter={() => setCursor(r._idx)}
                    style={{ width:'100%', textAlign:'left', padding:'9px 18px', display:'flex', alignItems:'center',
                      gap:12, border:'none', cursor:'pointer', background:cursor===r._idx?'#f0f7ec':'transparent',
                      transition:'background .08s', fontFamily:F.sans }}
                  >
                    <span style={{ fontSize:16, flexShrink:0 }}>{r.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:cursor===r._idx?600:400, color:'#1a1a18' }}>{r.label}</div>
                      {r.sub && <div style={{ fontSize:11, color:'#9a9a98', marginTop:1 }}>{r.sub}</div>}
                    </div>
                    {r.type==='nav' && <span style={{ fontSize:11, color:'#c8c8c4', fontFamily:F.mono }}>↵</span>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ padding:'8px 18px', borderTop:'1px solid #f0f0ec', display:'flex', gap:16 }}>
          {[['↑↓','navegar'],['↵','abrir'],['ESC','cerrar']].map(([k,v]) => (
            <span key={k} style={{ display:'flex', alignItems:'center', gap:4, fontFamily:F.sans, fontSize:11, color:'#9a9a98' }}>
              <kbd style={{ background:'#f0f0ec', border:'1px solid #d4d4d0', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:10, color:'#6a6a68' }}>{k}</kbd>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
