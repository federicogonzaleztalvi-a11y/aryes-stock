import React, { useState, useEffect, useRef, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./lib/constants.js";

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// GLOBAL STYLES
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
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
const TransferenciasTab = React.lazy(() => import('./tabs/TransferenciasTab.jsx'));
const ComprasTab        = React.lazy(() => import('./tabs/ComprasTab.jsx'));
const ResultadosTab     = React.lazy(() => import('./tabs/ResultadosTab.jsx'));
const BatchPickingTab = React.lazy(() => import('./tabs/BatchPickingTab.jsx'));
const PreciosTab = React.lazy(() => import('./tabs/PreciosTab.jsx'));
const KPIsTab = React.lazy(() => import('./tabs/KPIsTab.jsx'));
const DemandaTab = React.lazy(() => import('./tabs/DemandaTab.jsx'));
const AuditTab = React.lazy(() => import('./tabs/AuditTab.jsx'));
const TrackingTab = React.lazy(() => import('./tabs/TrackingTab.jsx'));
const DashboardInline = React.lazy(() => import('./tabs/DashboardInline.jsx'));
const PedidosInline = React.lazy(() => import('./tabs/PedidosInline.jsx'));
const InventoryInline = React.lazy(() => import('./tabs/InventoryInline.jsx'));
const ConfigInline = React.lazy(() => import('./tabs/ConfigInline.jsx'));
const ProveedoresInline = React.lazy(() => import('./tabs/ProveedoresInline.jsx'));
import CommandPalette from './components/CommandPalette.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import QuickStats from './components/QuickStats.jsx';
import SmartToasts from './components/SmartToasts.jsx';
import ProductForm from './components/ProductForm.jsx';
import OrderModal from './components/OrderModal.jsx';
import ExcelModal from './components/ExcelModal.jsx';
import CameraScanner from './components/CameraScanner.jsx';
import EmailSettings from './components/EmailSettings.jsx';
import UserMenuDropdown from './components/UserMenuDropdown.jsx';
import { useApp } from './context/AppContext.tsx';
import { useConfirm } from './components/ConfirmDialog.jsx';
import TabLoader from './components/TabLoader.jsx';
import AppSidebar, { getNavForRole, canAccessTab } from './components/AppSidebar.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

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
@keyframes smartToastIn{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}
.au{animation:fadeUp .25s ease both;}
.pdot{animation:pulseDot 1.8s ease infinite;}
`;

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// DESIGN TOKENS
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const T = {
  // Backgrounds → clean white like Lovable
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

  // Brand → primary green
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

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// Generic logo fallback → replaced by brandCfg.logoUrl when configured

const avgDaily   = h => (!h?.length ? 0 : h.reduce((s,x)=>s+x.consumed,0)/h.length/30);
const stdDev     = h => {
  if(!h||h.length<2) return 0;
  const ds=h.map(x=>x.consumed/30), m=ds.reduce((s,v)=>s+v,0)/ds.length;
  return Math.sqrt(ds.reduce((s,v)=>s+Math.pow(v-m,2),0)/ds.length);
};
const safetyStock = (h,lead) => Math.ceil(1.65*stdDev(h)*Math.sqrt(lead));
const rop         = (h,lead) => Math.ceil(avgDaily(h)*lead+safetyStock(h,lead));
const eoq         = (h,cost) => {
  const ann=avgDaily(h)*365, hc=cost*0.25;
  if(!hc||!ann) return 0;
  return Math.ceil(Math.sqrt(2*ann*25/hc));
};
const totalLead   = s => Object.values(s?.times||{}).reduce((a,b)=>a+b,0);

const alertLevel = (p, s) => {
  if(!s||!p.history?.length) return {level:"ok",daysToROP:999,daysOut:999,rop:0,ss:0,eoq:0,daily:0};
  const lead=totalLead(s), daily=avgDaily(p.history);
  const r=rop(p.history,lead), ss=safetyStock(p.history,lead), eq=eoq(p.history,p.unitCost);
  const daysToROP = daily>0 ? Math.max(0,Math.floor((p.stock-r)/daily)) : 999;
  const daysOut   = daily>0 ? Math.floor(p.stock/daily) : 999;
  const level = p.stock<=r ? "order_now" : daysToROP<=5 ? "order_soon" : daysToROP<=10 ? "watch" : "ok";
  const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+daysToROP);
  return {level,daysToROP,daysOut,rop:r,ss,eoq:eq,daily,ropDate};
};

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// DEFAULT DATA
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→



const ALERT_CFG = {
  order_now:  {label:"Pedir YA",     dot:T.danger,  bg:T.dangerBg,bd:T.dangerBd,txt:T.danger, pri:3},
  order_soon: {label:"Pedir pronto", dot:T.warning, bg:T.warnBg,  bd:T.warnBd,  txt:T.warning,pri:2},
  watch:      {label:"Vigilar",      dot:T.watch,   bg:T.watchBg, bd:T.watchBd, txt:T.watch,  pri:1},
  ok:         {label:"Normal",       dot:T.ok,      bg:T.okBg,    bd:T.okBd,    txt:T.ok,     pri:0},
};

const fmtDate  = d=>d?new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"}):"→";

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// ATOMS
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const Cap = ({children,style:sx})=>(
  <span style={{fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:T.textSm,...sx}}>{children}</span>
);

const AlertPill = ({level})=>{
  const c=ALERT_CFG[level];
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.bd}`,color:c.txt,fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 9px",borderRadius:2}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,display:"inline-block",...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
      {c.label}
    </span>
  );
};

const StockBar = ({stock,r,ss,max})=>{
  const m=max||Math.max(stock*1.6,r*2.5,1);
  const pct=v=>Math.min(100,Math.max(0,v/m*100));
  const col=stock<=r?T.danger:stock<=r*1.3?T.warning:T.green;
  return(
    <div style={{position:"relative",height:6,background:T.muted,width:"100%"}}>
      <div style={{position:"absolute",left:0,width:`${pct(ss)}%`,height:"100%",background:"#fecaca",opacity:.7}}/>
      <div style={{position:"absolute",left:`${pct(r)}%`,width:2,height:"160%",top:"-30%",background:T.warning,zIndex:2}}/>
      <div style={{position:"absolute",left:0,width:`${pct(stock)}%`,height:"100%",background:col,opacity:.75}}/>
    </div>
  );
};


const inp={width:"100%",fontFamily:T.sans,fontSize:13,color:T.text,background:T.card,border:`1px solid ${T.border}`,padding:"9px 11px",borderRadius:4};
const Inp=({value,onChange,type="text",placeholder,min,step,style:sx,inputRef,onKeyDown,autoFocus})=>(
  <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} step={step} onKeyDown={onKeyDown} autoFocus={autoFocus} style={{...inp,...sx}}/>
);
const Sel=({value,onChange,children,style:sx})=>(
  <select value={value} onChange={onChange} style={{...inp,cursor:"pointer",...sx}}>{children}</select>
);
const Field=({label,hint,children})=>(
  <div>
    <div style={{marginBottom:5}}><Cap>{label}</Cap></div>
    {children}
    {hint&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:4,lineHeight:1.5}}>{hint}</p>}
  </div>
);

const Btn=({onClick,children,variant="primary",small,full,disabled})=>{
  const v={
    primary:{bg:T.green,cl:"#fff",bd:T.green},
    ghost:  {bg:"transparent",cl:T.textMd,bd:T.border},
    danger: {bg:"transparent",cl:T.danger,bd:T.dangerBd},
    success:{bg:"transparent",cl:T.ok,bd:T.okBd},
  }[variant]||{bg:T.green,cl:"#fff",bd:T.green};
  return(
    <button onClick={onClick} disabled={disabled}
      style={{background:v.bg,color:v.cl,border:`1px solid ${v.bd}`,fontFamily:T.sans,fontSize:small?11:12,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:small?"6px 12px":"10px 22px",cursor:disabled?"default":"pointer",display:"inline-flex",alignItems:"center",gap:6,justifyContent:"center",width:full?"100%":"auto",opacity:disabled?.4:1,borderRadius:4,transition:"opacity .15s"}}>
      {children}
    </button>
  );
};

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// MODAL
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const Modal=({title,sub,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(245,240,232,.9)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:20}}>
    <div className="au" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:"100%",maxWidth:wide?840:540,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 16px 60px rgba(0,0,0,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 28px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          {sub&&<Cap style={{color:T.green}}>{sub}</Cap>}
          <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginTop:sub?4:0,letterSpacing:"-.01em"}}>{title}</h2>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textXs,fontSize:22,lineHeight:1,padding:4,marginTop:2}}>Í</button>
      </div>
      <div style={{padding:"22px 28px 28px"}}>{children}</div>
    </div>
  </div>
);

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// PRODUCT FORM
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const Scanner=({products,suppliers,onUpdate})=>{
  const [mode, setMode] = useState("usb"); // "usb" | "camera"
  const [val,setVal]=useState("");
  const [found,setFound]=useState(null);
  const [qty,setQty]=useState(1);
  const [log,setLog]=useState([]);
  const [msg,setMsg]=useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const ref=useRef();

  useEffect(()=>{ if(mode==="usb") setTimeout(()=>ref.current?.focus(),80); },[mode]);

  const flash=(ok,text)=>{setMsg({ok,text});setTimeout(()=>setMsg(null),3500);};

  const processCode = (code) => {
    const q = code.trim().toLowerCase();
    const p = products.find(x => x.barcode === code.trim() || x.name.toLowerCase().includes(q));
    if(p){ setFound(p); setQty(1); flash(true,`Encontrado: ${p.name}`); }
    else { setFound(null); flash(false,`"${code}" no encontrado en el sistema`); }
  };

  const handleKey=e=>{
    if(e.key!=="Enter"||!val.trim())return;
    processCode(val);
    setVal("");
  };

  const handleCameraDetect = (code) => {
    setShowCamera(false);
    processCode(code);
  };

  const confirm=()=>{
    if(!found)return;
    onUpdate(found.id,qty);
    setLog(l=>[{time:new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"}),name:found.name,qty,unit:found.unit},...l.slice(0,19)]);
    flash(true,`+${qty} ${found.unit} ingresado para ${found.name}`);
    setFound(null);setQty(1);
    if(mode==="usb") setTimeout(()=>ref.current?.focus(),80);
  };

  const fa=found?alertLevel(found,suppliers.find(s=>s.id===found.supplierId)):null;

  return(
    <div style={{maxWidth:600}}>
      {showCamera && <CameraScanner onDetected={handleCameraDetect} onClose={()=>setShowCamera(false)}/>}

      <div style={{marginBottom:24}}>
        <Cap style={{color:T.green}}>Herramienta</Cap>
        <h1 style={{fontFamily:T.serif,fontSize:38,fontWeight:500,color:T.text,marginTop:6,letterSpacing:"-.02em"}}>Scanner</h1>
        <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:6,lineHeight:1.6}}>
          Escaneá productos con el lector USB/Bluetooth o con la cámara de tu celular.
        </p>
      </div>

      {/* Mode selector */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:8,overflow:"hidden",marginBottom:16}}>
        {[
          {id:"usb",   icon:"→¨", title:"Lector USB / Bluetooth", sub:"Lector físico conectado a la PC"},
          {id:"camera",icon:"📊·", title:"Cámara del celular",     sub:"Usá la cámara para escanear"},
        ].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)}
            style={{background:mode===m.id?T.greenBg:T.card,border:"none",padding:"16px 18px",cursor:"pointer",textAlign:"left",borderBottom:mode===m.id?`2px solid ${T.green}`:"2px solid transparent"}}>
            <div style={{fontSize:20,marginBottom:6}}>{m.icon}</div>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:mode===m.id?T.green:T.textMd}}>{m.title}</div>
            <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:2}}>{m.sub}</div>
          </button>
        ))}
      </div>

      {/* USB mode */}
      {mode==="usb"&&(
        <div style={{border:`2px dashed ${T.border}`,borderRadius:8,padding:"18px 20px",marginBottom:14,background:T.card}}>
          <Cap>Campo de escaneo → click aquí antes de escanear</Cap>
          <Inp inputRef={ref} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={handleKey}
            placeholder="Esperando escaneo o buscá por nombre..." autoFocus
            style={{fontSize:16,letterSpacing:"0.04em",marginTop:8}}/>
          <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:5}}>El lector envía Enter automáticamente al escanear.</p>
        </div>
      )}

      {/* Camera mode */}
      {mode==="camera"&&(
        <div style={{marginBottom:14}}>
          <button onClick={()=>setShowCamera(true)}
            style={{width:"100%",background:T.green,border:"none",borderRadius:8,padding:"20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <span style={{fontSize:40}}>📊·</span>
            <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:"#fff"}}>Abrir cámara</div>
            <div style={{fontFamily:T.sans,fontSize:12,color:"rgba(255,255,255,.75)"}}>
              Funciona desde el celular · Chrome y Safari · Sin instalar nada
            </div>
          </button>
          <div style={{marginTop:10,background:T.watchBg,border:`1px solid ${T.watchBd}`,borderRadius:6,padding:"10px 14px"}}>
            <p style={{fontFamily:T.sans,fontSize:11,color:T.watch,lineHeight:1.6}}>
              <strong>Tip:</strong> Para mejores resultados, abrí esta página desde el navegador de tu celular. El sistema pedirá permiso para usar la cámara la primera vez.
            </p>
          </div>
          {/* Also keep manual input as fallback */}
          <div style={{marginTop:10,border:`1px dashed ${T.border}`,borderRadius:6,padding:"12px 14px",background:T.card}}>
            <Cap style={{color:T.textXs}}>O ingresá el código manualmente</Cap>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <Inp value={val} onChange={e=>setVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&val.trim()){processCode(val);setVal("");}}}
                placeholder="Tipear código EAN..." style={{fontSize:14}}/>
              <Btn onClick={()=>{if(val.trim()){processCode(val);setVal("");}}} small>Buscar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
      {msg&&<div className="au" style={{padding:"10px 14px",marginBottom:12,background:msg.ok?T.okBg:T.dangerBg,borderLeft:`3px solid ${msg.ok?T.ok:T.danger}`,borderRadius:4}}><p style={{fontFamily:T.sans,fontSize:13,color:msg.ok?T.ok:T.danger,fontWeight:500}}>{msg.text}</p></div>}

      {/* Found product */}
      {found&&fa&&(
        <div className="au" style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"15px 18px",borderBottom:`1px solid ${T.border}`,background:T.cardWarm}}>
            <div>
              <Cap style={{color:T.green}}>Producto encontrado</Cap>
              <h3 style={{fontFamily:T.serif,fontSize:24,fontWeight:500,color:T.text,marginTop:3}}>{found.name}</h3>
              <p style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>EAN: {found.barcode}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <Cap>Stock actual</Cap>
              <div style={{fontFamily:T.serif,fontSize:28,fontWeight:400,marginTop:3,color:fa.level==="order_now"?T.danger:fa.level==="order_soon"?T.warning:T.text}}>
                {found.stock} <span style={{fontSize:14,color:T.textSm}}>{found.unit}</span>
              </div>
              <div style={{marginTop:6}}><AlertPill level={fa.level}/></div>
            </div>
          </div>
          {fa.rop>0&&<div style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}`}}>
            <StockBar stock={found.stock} r={fa.rop} ss={fa.ss} max={Math.max(found.stock*1.6,fa.rop*2.5)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>Seg.: {fa.ss} {found.unit}</span>
              <span style={{fontFamily:T.sans,fontSize:10,color:T.warning,fontWeight:600}}>ROP: {fa.rop} {found.unit}</span>
            </div>
          </div>}
          <div style={{display:"flex",gap:10,padding:"13px 18px",alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <Field label={`Cantidad a ingresar (${found.unit})`}>
                <Inp type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,+e.target.value))} style={{marginTop:5}}/>
              </Field>
            </div>
            <Btn onClick={confirm}>Confirmar ingreso</Btn>
          </div>
        </div>
      )}

      {/* Log */}
      {log.length>0&&(
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{padding:"11px 16px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Registro de sesión</Cap></div>
          {log.map((l,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:i<log.length-1?`1px solid ${T.border}`:"none",background:i===0?T.cardWarm:T.card}}>
              <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,minWidth:40}}>{l.time}</span>
              <span style={{fontFamily:T.sans,fontSize:13,fontWeight:500,flex:1,paddingLeft:12}}>{l.name}</span>
              <span style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:600}}>+{l.qty} {l.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// SUPPLIER RATING STARS
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const Stars = ({ value, onChange }) => (
  <div style={{display:"flex",gap:3}}>
    {[1,2,3,4,5].map(n => (
      <button key={n} onClick={()=>onChange&&onChange(n)}
        style={{background:"none",border:"none",cursor:onChange?"pointer":"default",
          fontSize:16,color:n<=value?"#f59e0b":"#ddd6cb",padding:"0 1px",lineHeight:1}}>→</button>
    ))}
  </div>
);

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// SUPPLIER FORM MODAL
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const SupplierForm = ({ supplier, onSave, onClose }) => {
  const blank = {
    id: crypto.randomUUID().toString(), name:"", flag:"", color:"#1d4ed8",
    times:{preparation:2,customs:2,freight:7,warehouse:1},
    company:"", contact:"", email:"", phone:"", whatsapp:"",
    country:"", city:"", currency:"USD", paymentTerms:"30",
    paymentMethod:"", minOrder:"0", discount:"0",
    rating:3, active:true, notes:"",
  };
  const [f, setF] = useState(supplier ? {...supplier} : blank);
  const set = (k,v) => setF(p => ({...p,[k]:v}));
  const setTime = (k,v) => setF(p => ({...p,times:{...p.times,[k]:Math.max(0,+v)}}));
  const tfCols = ["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs = [["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]];
  return (
    <div style={{display:"grid",gap:18}}>
      {/* Identity */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:12}}>
        <Field label="Nombre / Región"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Argentina"/></Field>
        <Field label="Empresa proveedora"><Inp value={f.company} onChange={e=>set("company",e.target.value)} placeholder="Nombre legal"/></Field>
        <Field label="País (2 letras)"><Inp value={f.flag} onChange={e=>set("flag",e.target.value.toUpperCase().slice(0,2))} placeholder="AR"/></Field>
      </div>

      {/* Contact */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{marginBottom:10}}><Cap style={{color:T.green}}>Contacto</Cap></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Nombre del contacto"><Inp value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="Nombre y apellido"/></Field>
          <Field label="Email"><Inp type="email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="contacto@empresa.com"/></Field>
          <Field label="Teléfono"><Inp value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+54 11 1234-5678"/></Field>
          <Field label="WhatsApp"><Inp value={f.whatsapp} onChange={e=>set("whatsapp",e.target.value)} placeholder="+54 9 11 1234-5678"/></Field>
        </div>
      </div>

      {/* Commercial conditions */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{marginBottom:10}}><Cap style={{color:T.green}}>Condiciones comerciales</Cap></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
          <Field label="Moneda">
            <Sel value={f.currency} onChange={e=>set("currency",e.target.value)}>
              {["USD","EUR","ARS","BRL"].map(c=><option key={c} value={c}>{c}</option>)}
            </Sel>
          </Field>
          <Field label="Plazo de pago (días)"><Inp type="number" value={f.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} placeholder="30"/></Field>
          <Field label="Pedido mínimo"><Inp type="number" value={f.minOrder} onChange={e=>set("minOrder",e.target.value)} placeholder="USD"/></Field>
          <Field label="Descuento (%)"><Inp type="number" value={f.discount} onChange={e=>set("discount",e.target.value)} placeholder="0"/></Field>
        </div>
        <div style={{marginTop:12}}>
          <Field label="Forma de pago"><Inp value={f.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)} placeholder="Ej: Transferencia bancaria, Carta de crédito..."/></Field>
        </div>
      </div>

      {/* Lead times */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <Cap style={{color:T.green}}>Tiempos de entrega (días)</Cap>
          <Cap>Total: {Object.values(f.times).reduce((a,b)=>a+b,0)} días</Cap>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {tfs.map(([k,l],_i)=>(
            <Field key={k} label={l}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4}}>
                <Inp type="number" min="0" value={f.times[k]} onChange={e=>setTime(k,e.target.value)} style={{textAlign:"center"}}/>
                <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
              </div>
            </Field>
          ))}
        </div>
        <div style={{display:"flex",gap:2,height:6,borderRadius:3,overflow:"hidden",marginTop:10}}>
          {tfs.map(([k],i)=><div key={k} style={{flex:f.times[k]||0.1,background:tfCols[i],opacity:.7}}/>)}
        </div>
      </div>

      {/* Rating & Notes */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,display:"grid",gridTemplateColumns:"auto 1fr",gap:20,alignItems:"start"}}>
        <Field label="Calificación">
          <div style={{marginTop:6}}><Stars value={f.rating} onChange={v=>set("rating",v)}/></div>
        </Field>
        <Field label="Notas internas">
          <textarea value={f.notes} onChange={e=>set("notes",e.target.value)}
            placeholder="Condiciones especiales, observaciones, historia con el proveedor..."
            style={{width:"100%",height:70,fontFamily:T.sans,fontSize:12,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4,marginTop:4}}/>
        </Field>
      </div>

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={()=>onSave(f)} full>{supplier?"Guardar cambios":"Agregar proveedor"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// SUPPLIER DETAIL PANEL
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const SupplierDetail = ({ supplier, products, orders, onEdit, onClose }) => {
  const tfCols = ["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs = [["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]];
  const supProducts = products.filter(p=>p.supplierId===supplier.id);
  const supOrders = orders.filter(o=>o.supplierId===supplier.id).slice(0,8);
  const pendingOrders = supOrders.filter(o=>o.status==="pending");
  const totalSpent = supOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(+o.totalCost||0),0);

  return (
    <Modal title={supplier.name} sub={supplier.company||"Proveedor"} onClose={onClose} wide>
      <div style={{display:"grid",gap:20}}>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[
            {l:"Productos",   v:supProducts.length},
            {l:"Pedidos activos", v:pendingOrders.length, c:pendingOrders.length>0?T.watch:T.text},
            {l:"Total comprado",  v:`${supplier.currency||"USD"} ${totalSpent.toFixed(0)}`},
            {l:"Lead time",       v:`${totalLead(supplier)} días`},
          ].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"14px 16px"}}>
              <Cap>{s.l}</Cap>
              <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:s.c||T.text,marginTop:4}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Contact card */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:6,padding:16}}>
            <Cap style={{color:T.green}}>Contacto</Cap>
            <div style={{marginTop:10,display:"grid",gap:8}}>
              {[
                {icon:"📊¤",label:"Contacto",val:supplier.contact},
                {icon:"→",label:"Email",val:supplier.email,href:`mailto:${supplier.email}`},
                {icon:"📊",label:"Teléfono",val:supplier.phone,href:`tel:${supplier.phone}`},
                {icon:"📊¬",label:"WhatsApp",val:supplier.whatsapp,href:supplier.whatsapp?`https://wa.me/${supplier.whatsapp.replace(/\D/g,"")}`:""},
                {icon:"📊",label:"Ubicación",val:[supplier.city,supplier.country].filter(Boolean).join(", ")},
              ].filter(r=>r.val).map((r,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:14,width:20,textAlign:"center"}}>{r.icon}</span>
                  <div>
                    <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs,textTransform:"uppercase",letterSpacing:"0.1em"}}>{r.label}</div>
                    {r.href
                      ? <a href={r.href} target="_blank" rel="noreferrer" style={{fontFamily:T.sans,fontSize:13,color:T.green,textDecoration:"none",fontWeight:500}}>{r.val}</a>
                      : <div style={{fontFamily:T.sans,fontSize:13,color:T.text,fontWeight:500}}>{r.val}</div>
                    }
                  </div>
                </div>
              ))}
              <div style={{paddingTop:8,borderTop:`1px solid ${T.border}`}}>
                <Stars value={supplier.rating||3}/>
              </div>
            </div>
          </div>

          {/* Commercial conditions */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:6,padding:16}}>
            <Cap style={{color:T.green}}>Condiciones comerciales</Cap>
            <div style={{marginTop:10,display:"grid",gap:8}}>
              {[
                {l:"Moneda",v:supplier.currency},
                {l:"Plazo de pago",v:`${supplier.paymentTerms||"→"} días`},
                {l:"Forma de pago",v:supplier.paymentMethod||"→"},
                {l:"Pedido mínimo",v:supplier.minOrder>0?`${supplier.currency||"USD"} ${supplier.minOrder}`:"Sin mínimo"},
                {l:"Descuento",v:supplier.discount>0?`${supplier.discount}% por volumen`:"Sin descuento"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<4?`1px solid ${T.muted}`:"none"}}>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.l}</span>
                  <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.v||r[1]||"→"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lead time visual */}
        <div style={{background:T.cardWarm,borderRadius:6,padding:14,border:`1px solid ${T.border}`}}>
          <Cap>Desglose de tiempos de entrega</Cap>
          <div style={{display:"flex",gap:2,marginTop:10,height:10,borderRadius:3,overflow:"hidden"}}>
            {tfs.map(([k],i)=><div key={k} style={{flex:supplier.times[k]||0.1,background:tfCols[i]}}/>)}
          </div>
          <div style={{display:"flex",gap:2,marginTop:6}}>
            {tfs.map(([k,l],_i)=>(
              <div key={k} style={{flex:supplier.times[k]||0.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[_i]}}>{l}</div>
                <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,fontWeight:600}}>{supplier.times[k]}d</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {supplier.notes && (
          <div style={{background:T.warnBg,border:`1px solid ${T.warnBd}`,borderRadius:6,padding:"12px 14px"}}>
            <Cap>Notas internas</Cap>
            <p style={{fontFamily:T.sans,fontSize:13,color:T.textMd,marginTop:6,lineHeight:1.7}}>{supplier.notes}</p>
          </div>
        )}

        {/* Products from this supplier */}
        {supProducts.length>0 && (
          <div>
            <Cap>Productos de este proveedor</Cap>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:1,background:T.border,marginTop:8,borderRadius:6,overflow:"hidden"}}>
              {supProducts.map(p=>(
                <div key={p.id} style={{background:T.card,padding:"10px 12px"}}>
                  <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div>
                  <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>{p.stock} {p.unit} en stock</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order history */}
        {supOrders.length>0 && (
          <div>
            <Cap>Historial de pedidos recientes</Cap>
            <div style={{border:`1px solid ${T.border}`,borderRadius:6,marginTop:8,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted}}>
                  {["Producto","Cantidad","Costo","Pedido","Llegada","Estado"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {supOrders.map((o,i)=>(
                    <tr key={o.id} style={{borderBottom:i<supOrders.length-1?`1px solid ${T.border}`:"none",background:i%2===0?T.card:T.cardWarm}}>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13,fontWeight:500}}>{o.productName}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13}}>{o.qty} {o.unit}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13}}>{supplier.currency||"USD"} {o.totalCost}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{new Date(o.orderedAt).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:12,color:o.status==="pending"?T.watch:T.ok}}>{new Date(o.expectedArrival).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}</td>
                      <td style={{padding:"9px 12px"}}><AlertPill level={o.status==="pending"?"watch":"ok"}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:10,paddingTop:4}}>
          <Btn onClick={onEdit} full variant="ghost">→ Editar proveedor</Btn>
          <Btn onClick={onClose} variant="ghost">Cerrar</Btn>
        </div>
      </div>
    </Modal>
  );
};


// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// PLANNING MODULE → Proyección 6 meses + temporadas + cuánto pedir
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

// Months helper






// LOGIN SCREEN
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

function AryesApp({session, onLogout, onSessionUpdate: _onSessionUpdate}){
  // →→ State and mutations come from AppContext →→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const {
    products, setProducts,
    suppliers, setSuppliers,
    movements, setMovements: _setMovements,
    orders, setOrders,
    ventas: _ventas,
    cfes, setCfes: _setCfes,
    cobros, setCobros: _setCobros,
    clientes, setClientes: _setClientes,
    plans, setPlans,
    notified: _notified, setNotified: _setNotified,
    emailCfg, setEmailCfg,
    brandCfg, setBrandCfg,
    dbReady, syncStatus, hasPendingSync, syncToast, setSyncToast, setHasPendingSync,
    enriched, alerts, critN, getSup,
    addMov, savePlan, markDelivered, confirmOrder,
    deleteSupplier, deleteProduct: _deleteProduct, applyExcel,
    saveProduct: saveProductCtx,
    sendAlertEmail, dbWriteWithRetry: _dbWriteWithRetry,
  } = useApp();

  // →→ Layout-only UI state (stays in App) →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const [settingsTab,    setSettingsTab]    = useState('usuarios');
  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const [cmdOpen,        setCmdOpen]        = useState(false);
  // →→ URL-based tab routing (react-router-dom) →→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  // URL pattern: /app/:tab  →  /app/dashboard, /app/inventory, etc.
  // setTab() is still passed as a prop everywhere → callers don't change.
  const navigate = useNavigate();
  const { tab: urlTab } = useParams();
  const tab = urlTab || 'dashboard';
  const setTab = (id) => navigate('/app/' + id, { replace: false });
  const [modal,          setModal]          = useState(null);
  const [editProd,       setEditProd]       = useState(null);
  const [editSup,        setEditSup]        = useState(null);
  const [viewSup,        setViewSup]        = useState(null);

  // →→ Reactive localStorage state for CommandPalette →→→→→→→→→→→→→→→→→→→→→→→→
  // Read once on mount; refreshed when →K opens so data is fresh without polling.

  // →→ Global →K shortcut →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  React.useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Refresh LS-backed data when palette opens so clientes/cfes are current
        // clientes now reactive from AppContext → no manual refresh needed
        // cfes now reactive from AppContext → no manual refresh needed
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // →→ Scroll to top on tab change →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  useEffect(() => { const el = document.getElementById('main-content'); if (el) el.scrollTop = 0; }, [tab]);

  const canEdit    = session?.role === 'admin' || session?.role === 'operador'; // eslint-disable-line no-unused-vars
  const handleLogout = () => onLogout?.();
  const { confirm, ConfirmDialog } = useConfirm();

  // confirmedDeleteProduct removed → InventoryInline now handles its own confirm

  const confirmedDeleteSupplier = async (id) => {
    const hasProducts = products.some(p => p.supplierId === id);
    if (hasProducts) {
      await confirm({
        title: 'No se puede eliminar este proveedor',
        description: 'Hay productos asociados a este proveedor.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        cancelLabel: null,
      });
      return;
    }
    const ok = await confirm({
      title: '¿Eliminar este proveedor?',
      description: 'Esta acción no se puede deshacer.',
      variant: 'danger',
    });
    if (ok) await deleteSupplier(id);
  };


  // saveProduct → data logic lives in AppContext; App.jsx only handles layout cleanup
  const saveProduct=async f=>{
    const isEdit = !!editProd;
    const id = isEdit ? editProd.id : crypto.randomUUID();
    setModal(null); setEditProd(null);        // layout cleanup (App.jsx concern)
    await saveProductCtx(f, isEdit, id);      // data + Supabase (AppContext concern)
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
      setSyncToast({msg:'Error al guardar proveedor. Cambio guardado localmente → se sincronizará al reconectar.', type:'error'});
      setTimeout(()=>setSyncToast(null), 6000);
      setHasPendingSync(true);
    }
    // Audit log
    try{ await db.insert('audit_log',{id:crypto.randomUUID(),timestamp:now,user:(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.email||'unknown';}catch{return 'unknown';}})(),action:'proveedor_guardado',detail:JSON.stringify({isEdit,id,nombre:supplierData.name})}); }catch{ /* safe to ignore → audit log is non-critical */ }
  };


  // Nav constants extracted to AppSidebar.jsx
  const NAV      = getNavForRole(session?.role || 'admin');
  const canTab   = (id) => canAccessTab(session?.role || 'admin', id);
  const activeTab = canTab(tab) ? tab : (getNavForRole(session?.role || 'admin')[0]?.id || 'dashboard');

  // If URL contains a tab id that this role cannot access, correct the URL silently.
  // Prevents /app/config displaying dashboard content while URL shows 'config'.
  React.useEffect(() => {
    if (tab && !canTab(tab)) {
      navigate('/app/' + activeTab, { replace: true });
    }
  }, [tab, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* →→ SIDEBAR →→ */}
      <AppSidebar session={session} tab={tab} setTab={setTab} />

      {/* →→ MAIN →→ */}
      <main id="main-content" style={{marginLeft:220,flex:1,height:"100vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>

        {/* →→ TOPBAR →→ */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 44px",height:56,background:T.card,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
          {/* Search */}
          <div style={{flex:1,maxWidth:380,position:"relative"}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textXs,pointerEvents:"none"}}>📊</span>
            <input
              readOnly
              onClick={()=>setCmdOpen(true)}
              placeholder="Buscar o ejecutar..."
              style={{width:"100%",boxSizing:"border-box",padding:"7px 12px 7px 32px",border:`1px solid ${T.border}`,borderRadius:8,fontFamily:T.sans,fontSize:13,color:T.textXs,background:T.muted,outline:"none",cursor:"pointer"}}
            />
          </div>
          <div style={{flex:1}}/>
          <QuickStats critN={critN} orders={orders} />
          <NotificationBell critN={critN} orders={orders} setTab={setTab} />

          {/* User pill with dropdown */}
          <UserMenuDropdown session={session} userMenuOpen={userMenuOpen} setUserMenuOpen={setUserMenuOpen} canTab={canTab} setTab={setTab} handleLogout={handleLogout} />
        </div>

        <div style={{padding:"36px 44px",flex:1}}>

        {syncToast&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,background:syncToast.type==="info"?"#eff6ff":"#fef3c7",border:"1px solid "+(syncToast.type==="info"?"#bfdbfe":"#fde68a"),borderRadius:8,padding:"12px 18px",boxShadow:"0 4px 16px rgba(0,0,0,.12)",display:"flex",alignItems:"center",gap:10,animation:"fadeUp .25s ease both",maxWidth:360}}>
        <span style={{fontSize:18}}>{syncToast.type==="info"?"📊":"→ ï¸"}</span>
        <span style={{fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:600,color:syncToast.type==="info"?"#1d4ed8":"#92400e"}}>{syncToast.msg}</span>
      </div>}
      {hasPendingSync&&<div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:6,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>→ ï¸</span>
        <span style={{fontFamily:"Inter,sans-serif",fontSize:13,color:"#92400e",fontWeight:600}}>Cambios pendientes de sincronización → reconectando...</span>
      </div>}
      {/* →→ DASHBOARD →→ */}
        {activeTab==="dashboard"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><DashboardInline products={products} suppliers={suppliers} orders={orders} movements={movements} session={session} setTab={setTab} critN={critN} alerts={alerts} enriched={enriched} setModal={setModal} tfCols={tfCols} cfes={cfes} cobros={cobros}/></Suspense></ErrorBoundary>}

        {activeTab==="inventory"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><InventoryInline setModal={setModal} setEditProd={setEditProd}/></Suspense></ErrorBoundary>}
        {activeTab==="orders"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><PedidosInline products={products} setProducts={setProducts} suppliers={suppliers} orders={orders} setOrders={setOrders} addMov={addMov} movements={movements} session={session} modal={modal} setModal={setModal} plans={plans} setPlans={setPlans} savePlan={savePlan} tab={tab} getSup={getSup} markDelivered={markDelivered} setTab={setTab} tfCols={tfCols}/></Suspense></ErrorBoundary>}

        {/* →→ SUPPLIERS →→ */}
        {activeTab==="suppliers"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ProveedoresInline suppliers={suppliers} setSuppliers={setSuppliers} products={products} orders={orders} setOrders={setOrders} addMov={addMov} session={session} alerts={alerts} enriched={enriched} tab={tab} setModal={setModal} setEditSup={setEditSup} setViewSup={setViewSup} deleteSupplier={confirmedDeleteSupplier}/></Suspense></ErrorBoundary>}
        {activeTab==="scanner"&&<div className="au"><Scanner products={products} suppliers={suppliers} onUpdate={(id,qty,name,unit)=>{const p2=products.find(p=>p.id===id);const sup2=p2?suppliers.find(s=>s.id===p2.supplierId):null;setProducts(ps=>ps.map(p=>p.id===id?{...p,stock:p.stock+qty}:p));addMov({type:"scanner_in",productId:id,productName:name||p2?.name||id,supplierId:p2?.supplierId||"",supplierName:sup2?.name||"",qty,unit:unit||p2?.unit||"",note:"Ingreso por scanner"});}}/></div>}

        {activeTab==="config"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ConfigInline session={session} suppliers={suppliers} setSuppliers={setSuppliers} settingsTab={settingsTab} setSettingsTab={setSettingsTab} emailCfg={emailCfg} setEmailCfg={setEmailCfg} enriched={enriched} sendAlertEmail={sendAlertEmail} EmailSettings={EmailSettings} totalLead={totalLead} tfCols={tfCols} brandCfg={brandCfg} setBrandCfg={setBrandCfg}/></Suspense></ErrorBoundary>}
        {activeTab==="lotes"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><LotesTab /></Suspense></ErrorBoundary>}
      {activeTab==="clientes"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ClientesTab /></Suspense></ErrorBoundary>}
      {activeTab==="movimientos"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><MovimientosTab /></Suspense></ErrorBoundary>}
      
      {activeTab==="deposito"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><DepositoTab /></Suspense></ErrorBoundary>}
      
      {activeTab==="rutas"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><RutasTab /></Suspense></ErrorBoundary>}
      
        {activeTab==="recepcion"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><RecepcionTab /></Suspense></ErrorBoundary>}
        
        {activeTab==="ventas"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><VentasTab /></Suspense></ErrorBoundary>}
        {activeTab==="facturacion"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><FacturacionTab products={products}/></Suspense></ErrorBoundary>}
        
        {activeTab==="importar"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ImportTab /></Suspense></ErrorBoundary>}
        
        {activeTab==="informes"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><InformesTab /></Suspense></ErrorBoundary>}
        
        {activeTab==="conteo"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ConteoTab /></Suspense></ErrorBoundary>}
        {activeTab==="packing"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><PackingTab /></Suspense></ErrorBoundary>}
        {activeTab==="batch-picking"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><BatchPickingTab /></Suspense></ErrorBoundary>}
        {activeTab==="transferencias"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><TransferenciasTab /></Suspense></ErrorBoundary>}
        {activeTab==="compras"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ComprasTab /></Suspense></ErrorBoundary>}
        {activeTab==="resultados"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><ResultadosTab /></Suspense></ErrorBoundary>}
        
        {activeTab==="kpis"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><KPIsTab /></Suspense></ErrorBoundary>}
        {activeTab==="tracking"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><TrackingTab session={session} /></Suspense></ErrorBoundary>}
        
        {activeTab==="devoluciones"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><DevolucionesTab /></Suspense></ErrorBoundary>}
        {activeTab==="precios"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><PreciosTab /></Suspense></ErrorBoundary>}
        {activeTab==="demanda"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><DemandaTab /></Suspense></ErrorBoundary>}
        {activeTab==="audit"&&<ErrorBoundary><Suspense fallback={<TabLoader />}><AuditTab /></Suspense></ErrorBoundary>}
        </div>
        </main>

      {/* →→ COMMAND PALETTE →→ */}
        <CommandPalette
          open={cmdOpen}
          onClose={()=>setCmdOpen(false)}
          products={enriched||[]}
          clientes={clientes}
          cfes={cfes}
          setTab={setTab}
          onNewCFE={()=>{setTab('facturacion');setCmdOpen(false);}}
        />
        {/* →→ SMART TOASTS →→ */}
        <SmartToasts critN={critN} orders={orders} />
        {ConfirmDialog}
        {/* →→ MODALS →→ */}
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

// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// EXTRACTED INLINE TAB COMPONENTS (refactored from main render)
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→


// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
// AI CHAT FLOAT → inline (no separate file, no circular dep)
// →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→


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
  // AI chat proxied via /api/chat → no key in frontend

  React.useEffect(()=>{if(open){setUnread(0);setTimeout(()=>inRef.current?.focus(),80);}}, [open]);
  React.useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  React.useEffect(()=>{
    if(open&&msgs.length===0) setMsgs([{r:'a',t:'Hola'+(session?.email?' '+session.email.split('@')[0]:'')+'! Soy tu asistente de inventario. Preguntame sobre stock, precios, pedidos o pedí un informe.'}]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: init greeting once per open, msgs.length read on purpose
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
      const sys='Sos el asistente de stock, WMS para gestión de inventario. Adaptá las respuestas al negocio. Respondé en espaÍ±ol, conciso y directo. Usá solo los datos del contexto. Podés sugerir acciones concretas. Máx 200 palabras salvo informes.\n\nContexto:\n'+JSON.stringify(ctx,null,1);
      const sessionToken=(()=>{try{return JSON.parse(localStorage.getItem('aryes-session')||'null')?.access_token||'';}catch{return '';}})();
      const r=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+sessionToken},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:600,system:sys,messages:next.map(m=>({role:m.r==='u'?'user':'assistant',content:m.t}))})
      });
      const d=await r.json();
      const reply=d.content?.[0]?.text||'No pude procesar la respuesta.';
      setMsgs(p=>[...p,{r:'a',t:reply}]);
      if(!open) setUnread(n=>n+1);
    }catch{
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

  const ChatIcon = ({size=20, stroke='currentColor', strokeWidth=2}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );

  const SendIcon = () => (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={22} y1={2} x2={11} y2={13}/>
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none"/>
    </svg>
  );

  return (
    <>
      {/* Trigger button */}
      <button onClick={()=>setOpen(o=>!o)} style={S.btn} aria-label="Asistente IA">
        {open
          ? <span style={{fontSize:14,color:G,lineHeight:1}}>→</span>
          : <span style={{color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}><ChatIcon size={20}/></span>
        }
        {unread>0&&!open&&<span style={{position:'absolute',top:-5,right:-5,background:'#e24b4a',color:'#fff',borderRadius:'50%',width:19,height:19,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #f9f9f7'}}>{unread}</span>}
      </button>

      {/* Panel */}
      {open&&<div style={S.panel}>
        {/* Header */}
        <div style={S.header}>
          <div style={{width:36,height:36,borderRadius:11,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <ChatIcon size={14} stroke={G} strokeWidth={2.5}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:13,color:'#1a1a18',lineHeight:1.2}}>Asistente de stock</div>
            <div style={{fontSize:11,color:'#9a9a98',marginTop:3,display:'flex',alignItems:'center',gap:5}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:G,flexShrink:0}}/>
              Activo
              <span style={{color:'#d3d3d0'}}>·</span>
              <span style={{textTransform:'capitalize'}}>{role==='admin'?'Admin':role==='operador'?'Operador':'Vendedor'}</span>
            </div>
          </div>
          <button onClick={()=>setOpen(false)} style={{width:28,height:28,borderRadius:8,border:'0.5px solid #e2e2de',background:'#f4f4f1',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <span style={{fontSize:13,color:'#6a6a68',lineHeight:1}}>→</span>
          </button>
        </div>

        {/* Messages */}
        <div style={S.msgs}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.r==='u'?'flex-end':'flex-start',alignItems:'flex-end',gap:7}}>
              {m.r==='a'&&<div style={{width:24,height:24,borderRadius:7,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginBottom:1}}><ChatIcon size={14} stroke={G} strokeWidth={2.5}/></div>}
              <div style={{maxWidth:'78%',padding:'10px 13px',borderRadius:m.r==='u'?'16px 16px 4px 16px':'4px 16px 16px 16px',background:m.r==='u'?G:'#f4f4f1',color:m.r==='u'?'#fff':'#1a1a18',fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{m.t}</div>
            </div>
          ))}
          {busy&&<div style={{display:'flex',alignItems:'flex-end',gap:7}}>
            <div style={{width:24,height:24,borderRadius:7,background:'#f0f7ec',border:'0.5px solid #b8d9a8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><ChatIcon size={14} stroke={G} strokeWidth={2.5}/></div>
            <div style={{padding:'10px 14px',borderRadius:'4px 16px 16px 16px',background:'#f4f4f1',display:'flex',gap:4,alignItems:'center'}}>
              {[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:'50%',background:'#b4b4b2',animation:`bounce 1.2s ease ${j*0.2}s infinite`}}/>)}
            </div>
          </div>}
          <div ref={endRef}/>
        </div>

        {/* Quick chips */}
        {msgs.length<=1&&!busy&&<div style={{padding:'4px 14px 10px',display:'flex',flexWrap:'wrap',gap:6,flexShrink:0}}>
          {(_QUICK[role]||_QUICK.admin).map((q,i)=>(
            <button key={i} onClick={()=>send(q)}
              style={{fontSize:11,padding:'5px 11px',borderRadius:20,border:'0.5px solid #d8d8d4',background:'#f9f9f7',cursor:'pointer',color:'#4a4a48',lineHeight:1.3,fontFamily:'inherit',transition:'background .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#f0f0ec'}
              onMouseLeave={e=>e.currentTarget.style.background='#f9f9f7'}
            >{q}</button>
          ))}
        </div>}

        {/* Input */}
        <div style={S.input}>
          <textarea ref={inRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Preguntá sobre stock, precios..." rows={1}
            style={{flex:1,border:'0.5px solid #d8d8d4',borderRadius:12,padding:'9px 13px',fontSize:13,resize:'none',fontFamily:'inherit',outline:'none',lineHeight:1.45,maxHeight:80,overflowY:'auto',background:'#ffffff',color:'#1a1a18'}}
          />
          <button onClick={()=>send()} disabled={!input.trim()||busy}
            style={{width:36,height:36,borderRadius:10,background:input.trim()&&!busy?G:'#e0e0dc',border:'none',cursor:input.trim()&&!busy?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background .15s'}}>
            <SendIcon/>
          </button>
        </div>
      </div>}
    </>
  );
}

export default AryesApp;
// deploy trigger Sun Mar 22 01:46:08 UTC 2026
