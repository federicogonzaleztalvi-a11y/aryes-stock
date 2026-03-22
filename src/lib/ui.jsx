// ─────────────────────────────────────────────────────────────────────────────
// ARYES SHARED UI — theme, atoms, helpers
// Exported so lazy-loaded tabs can import them without depending on App.jsx scope
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

// ── Theme ────────────────────────────────────────────────────────────────────
export const T = {
  bg:       "#f9f9f7",
  card:     "#ffffff",
  cardWarm: "#fafaf8",
  muted:    "#f0f0ec",
  hover:    "#e8e8e4",
  border:   "#e2e2de",
  borderDk: "#c8c8c4",
  text:     "#1a1a18",
  textMd:   "#3a3a38",
  textSm:   "#6a6a68",
  textXs:   "#9a9a98",
  green:    "#3a7d1e",
  greenBg:  "#f0f7ec",
  greenBd:  "#b8d9a8",
  amber:    "#d97706",
  amberBg:  "#fef3c7",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  redBd:    "#fecaca",
  blue:     "#2563eb",
  blueBg:   "#eff6ff",
  blueBd:   "#bfdbfe",
  // Alert aliases
  danger:   "#dc2626",
  dangerBg: "#fef2f2",
  dangerBd: "#fecaca",
  urgent:   "#dc2626",
  urgentBg: "#fef2f2",
  urgentBd: "#fecaca",
  warning:  "#d97706",
  warnBg:   "#fffbeb",
  warnBd:   "#fde68a",
  watch:    "#2563eb",
  watchBg:  "#eff6ff",
  watchBd:  "#bfdbfe",
  ok:       "#16a34a",
  okBg:     "#f0fdf4",
  okBd:     "#bbf7d0",
  serif:    "'Playfair Display', 'Georgia', serif",
  sans:     "'Inter', system-ui, sans-serif",
};

// ── Alert config ─────────────────────────────────────────────────────────────
export const ALERT_CFG = {
  order_now:  { label:"Pedir YA",     dot:T.danger,  bg:T.dangerBg, bd:T.dangerBd, txt:T.danger,  pri:3 },
  order_soon: { label:"Pedir pronto", dot:T.warning, bg:T.warnBg,   bd:T.warnBd,   txt:T.warning, pri:2 },
  watch:      { label:"Vigilar",      dot:T.watch,   bg:T.watchBg,  bd:T.watchBd,  txt:T.watch,   pri:1 },
  ok:         { label:"Normal",       dot:T.ok,      bg:T.okBg,     bd:T.okBd,     txt:T.ok,      pri:0 },
};

// ── Math helpers ─────────────────────────────────────────────────────────────
export const avgDaily    = h => (!h?.length ? 0 : h.reduce((s,x)=>s+x.consumed,0)/h.length/30);
export const stdDev      = h => {
  if(!h||h.length<2) return 0;
  const ds=h.map(x=>x.consumed/30), m=ds.reduce((s,v)=>s+v,0)/ds.length;
  return Math.sqrt(ds.reduce((s,v)=>s+Math.pow(v-m,2),0)/ds.length);
};
export const safetyStock = (h,lead) => Math.ceil(1.65*stdDev(h)*Math.sqrt(lead));
export const rop         = (h,lead) => Math.ceil(avgDaily(h)*lead+safetyStock(h,lead));
export const eoq         = (h,cost) => {
  const ann=avgDaily(h)*365, hc=cost*0.25;
  if(!hc||!ann) return 0;
  return Math.ceil(Math.sqrt(2*ann*25/hc));
};
export const totalLead   = s => Object.values(s?.times||{}).reduce((a,b)=>a+b,0);
export const alertLevel  = (p, s) => {
  if(!s||!p.history?.length) return {level:"ok",daysToROP:999,daysOut:999,rop:0,ss:0,eoq:0,daily:0};
  const lead=totalLead(s), daily=avgDaily(p.history);
  const r=rop(p.history,lead), ss=safetyStock(p.history,lead), eq=eoq(p.history,p.unitCost);
  const daysToROP = daily>0 ? Math.max(0,Math.floor((p.stock-r)/daily)) : 999;
  const daysOut   = daily>0 ? Math.floor(p.stock/daily) : 999;
  const level = p.stock<=r ? "order_now" : daysToROP<=5 ? "order_soon" : daysToROP<=10 ? "watch" : "ok";
  const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+daysToROP);
  return {level,daysToROP,daysOut,rop:r,ss,eoq:eq,daily,ropDate};
};

// ── Formatters ───────────────────────────────────────────────────────────────
export const fmtDate  = d => d ? new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"}) : "—";
export const fmtShort = d => d ? new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short"}) : "—";

// ── Atoms ────────────────────────────────────────────────────────────────────
export const Cap = ({children,style:sx}) => (
  <span style={{fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:T.textSm,...sx}}>{children}</span>
);

export const AlertPill = ({level}) => {
  const c = ALERT_CFG[level] || ALERT_CFG.ok;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.bd}`,color:c.txt,fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",padding:"4px 10px",borderRadius:20,whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c.dot,flexShrink:0,...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
      {c.label}
    </span>
  );
};

export const StockBar = ({stock,r,ss,max}) => {
  const m = max || Math.max(stock*1.6, r*2.5, 1);
  const pct = v => Math.min(100, Math.max(0, v/m*100));
  const col = stock<=r ? T.danger : stock<=r*1.3 ? T.warning : T.green;
  return (
    <div style={{position:"relative",height:6,background:T.muted,width:"100%"}}>
      <div style={{position:"absolute",left:0,width:`${pct(ss)}%`,height:"100%",background:"#fecaca",opacity:.7}}/>
      <div style={{position:"absolute",left:`${pct(r)}%`,width:2,height:"160%",top:"-30%",background:T.warning,zIndex:2}}/>
      <div style={{position:"absolute",left:0,width:`${pct(stock)}%`,height:"100%",background:col,opacity:.75}}/>
    </div>
  );
};

export const Spark = ({history, color=T.textXs}) => {
  if(!history?.length||history.length<2) return <span style={{fontSize:10,color:T.textXs}}>—</span>;
  const v=history.map(h=>h.consumed), mx=Math.max(...v), mn=Math.min(...v), W=60, H=20;
  const pts=v.map((x,i)=>`${i/(v.length-1)*W},${H-((mx===mn?.5:(x-mn)/(mx-mn))*(H-3))-1.5}`).join(" ");
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity=".7"/>
      <circle cx={(v.length-1)/(v.length-1)*W} cy={H-((mx===mn?.5:(v[v.length-1]-mn)/(mx-mn))*(H-3))-1.5} r="2.5" fill={color}/>
    </svg>
  );
};

const inp = {width:"100%",fontFamily:T.sans,fontSize:13,color:T.text,background:T.card,border:`1px solid ${T.border}`,padding:"9px 11px",borderRadius:4};

export const Inp = ({value,onChange,type="text",placeholder,min,step,style:sx,inputRef,onKeyDown,autoFocus}) => (
  <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} step={step} onKeyDown={onKeyDown} autoFocus={autoFocus} style={{...inp,...sx}}/>
);

export const Sel = ({value,onChange,children,style:sx}) => (
  <select value={value} onChange={onChange} style={{...inp,cursor:"pointer",...sx}}>{children}</select>
);

export const Field = ({label,hint,children}) => (
  <div>
    <div style={{marginBottom:5}}><Cap>{label}</Cap></div>
    {children}
    {hint&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:4,lineHeight:1.5}}>{hint}</p>}
  </div>
);

export const Btn = ({onClick,children,variant="primary",small,full,disabled}) => {
  const v = {
    primary: {bg:T.green,   cl:"#fff",    bd:T.green},
    ghost:   {bg:"transparent", cl:T.textMd, bd:T.border},
    danger:  {bg:"transparent", cl:T.danger, bd:T.dangerBd},
    success: {bg:"transparent", cl:T.ok,     bd:T.okBd},
  }[variant] || {bg:T.green, cl:"#fff", bd:T.green};
  return (
    <button onClick={onClick} disabled={disabled}
      style={{background:v.bg,color:v.cl,border:`1px solid ${v.bd}`,fontFamily:T.sans,fontSize:small?11:12,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:small?"6px 12px":"10px 22px",cursor:disabled?"default":"pointer",display:"inline-flex",alignItems:"center",gap:6,justifyContent:"center",width:full?"100%":"auto",opacity:disabled?.4:1,borderRadius:4,transition:"opacity .15s"}}>
      {children}
    </button>
  );
};

export const Modal = ({title,sub,onClose,children,wide}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(245,240,232,.9)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:20}}>
    <div className="au" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:"100%",maxWidth:wide?840:540,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 16px 60px rgba(0,0,0,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 28px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          {sub&&<Cap style={{color:T.green}}>{sub}</Cap>}
          <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginTop:sub?4:0,letterSpacing:"-.01em"}}>{title}</h2>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textXs,fontSize:22,lineHeight:1,padding:4,marginTop:2}}>×</button>
      </div>
      <div style={{padding:"22px 28px 28px"}}>{children}</div>
    </div>
  </div>
);

// ── CSV Export ────────────────────────────────────────────────────────────────
export function downloadCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')].concat(
    rows.map(r => headers.map(h => escape(r[h])).join(','))
  );
  const csv = lines.join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── ComingSoon placeholder ────────────────────────────────────────────────────
export function ComingSoon({ title, description, icon = '🔧' }) {
  return (
    <div style={{ padding: '48px 36px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 28, color: '#1a1a18', margin: '0 0 12px' }}>
        {title}
      </h2>
      <div style={{ display: 'inline-block', background: '#f0f9f0', color: '#3a7d1e', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, marginBottom: 20 }}>
        Próximamente
      </div>
      {description && (
        <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: '#6a6a68', lineHeight: 1.7, margin: 0 }}>
          {description}
        </p>
      )}
    </div>
  );
}
