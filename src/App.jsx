// v126 — JSX fragments fixed, auth in Root
// v115 — rollback to v107 + cache bust
import React, { useState, useEffect, useRef, useMemo, useCallback , Suspense } from "react";
import { db, getAuthHeaders, LS, sbSyncAll, SB_URL, SKEY } from "./lib/constants.js";

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
import CommandPalette from './components/CommandPalette.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import QuickStats from './components/QuickStats.jsx';
import SmartToasts from './components/SmartToasts.jsx';

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
// ─── App load: sync from Supabase in background ────────────────────────────
setTimeout(() => sbSyncAll(), 1000);

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

// ─────────────────────────────────────────────────────────────────────────────
// Generic logo fallback — replaced by brandCfg.logoUrl when configured
const AppLogoFallback = ({ height = 52 }) => (
  <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',
    background:'#f0f7ec',borderRadius:8,padding:'0 12px',
    fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:700,color:'#3a7d1e',letterSpacing:'-0.02em'}}>
    STOCK
  </div>
);


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

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT DATA
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SUPPLIERS = [
  {id:"arg",name:"Argentina",flag:"AR",color:"#1d4ed8",times:{preparation:2,customs:1,freight:4,warehouse:1},
   company:"",contact:"",email:"",phone:"",whatsapp:"",
   country:"Argentina",city:"",currency:"USD",paymentTerms:"30",paymentMethod:"",
   minOrder:"0",discount:"0",rating:3,active:true,notes:""},
  {id:"ecu",name:"Ecuador",flag:"EC",color:"#15803d",times:{preparation:3,customs:4,freight:8,warehouse:2},
   company:"",contact:"",email:"",phone:"",whatsapp:"",
   country:"Ecuador",city:"",currency:"USD",paymentTerms:"30",paymentMethod:"",
   minOrder:"0",discount:"0",rating:3,active:true,notes:""},
  {id:"eur",name:"Europa",flag:"EU",color:"#6d28d9",times:{preparation:5,customs:10,freight:25,warehouse:3},
   company:"",contact:"",email:"",phone:"",whatsapp:"",
   country:"",city:"",currency:"EUR",paymentTerms:"60",paymentMethod:"",
   minOrder:"0",discount:"0",rating:3,active:true,notes:""},
  {id:"other",name:"Otros",flag:"—",color:"#b45309",times:{preparation:3,customs:5,freight:12,warehouse:2},
   company:"",contact:"",email:"",phone:"",whatsapp:"",
   country:"",city:"",currency:"USD",paymentTerms:"30",paymentMethod:"",
   minOrder:"0",discount:"0",rating:3,active:true,notes:""},
];

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

const ALERT_CFG = {
  order_now:  {label:"Pedir YA",     dot:T.danger,  bg:T.dangerBg,bd:T.dangerBd,txt:T.danger, pri:3},
  order_soon: {label:"Pedir pronto", dot:T.warning, bg:T.warnBg,  bd:T.warnBd,  txt:T.warning,pri:2},
  watch:      {label:"Vigilar",      dot:T.watch,   bg:T.watchBg, bd:T.watchBd, txt:T.watch,  pri:1},
  ok:         {label:"Normal",       dot:T.ok,      bg:T.okBg,    bd:T.okBd,    txt:T.ok,     pri:0},
};

const fmtDate  = d=>d?new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtShort = d=>d?new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short"}):"—";

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────
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

const Spark = ({history,color=T.textXs})=>{
  if(!history?.length||history.length<2) return <span style={{fontSize:10,color:T.textXs}}>—</span>;
  const v=history.map(h=>h.consumed),mx=Math.max(...v),mn=Math.min(...v),W=60,H=20;
  const pts=v.map((x,i)=>`${i/(v.length-1)*W},${H-((mx===mn?.5:(x-mn)/(mx-mn))*(H-3))-1.5}`).join(" ");
  return(<svg width={W} height={H}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity=".7"/>
    <circle cx={(v.length-1)/(v.length-1)*W} cy={H-((mx===mn?.5:(v[v.length-1]-mn)/(mx-mn))*(H-3))-1.5} r="2.5" fill={color}/></svg>);
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM ATOMS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
const Modal=({title,sub,onClose,children,wide})=>(
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

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FORM
// ─────────────────────────────────────────────────────────────────────────────
const ProductForm=({product,suppliers,onSave,onClose})=>{
  const blank={name:"",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:0,history:[]};
  const [f,setF]=useState(product?{...product}:blank);

  // WA template in localStorage
  const [waTpl,setWaTpl]=useState(()=>localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos!');
  const saveWaTpl=()=>{localStorage.setItem('aryes-wa-template',waTpl);alert('Plantilla guardada');};
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const [csv,setCsv]=useState(product?.history?.map(h=>`${h.month},${h.consumed}`).join("\n")||"");
  const bRef=useRef();
  const parseCSV=()=>{
    try{
      const rows=csv.trim().split("\n").map(r=>{const[m,c]=r.split(",");return{month:m?.trim(),consumed:+c?.trim()};}).filter(r=>r.month&&!isNaN(r.consumed)&&r.consumed>0);
      if(!rows.length){alert("No se encontraron datos válidos.");return;}
      setF(p=>({...p,history:rows}));
    }catch{alert("Formato incorrecto. Usar: YYYY-MM,cantidad");}
  };
  const sup=suppliers.find(s=>s.id===f.supplierId);
  const lead=sup?totalLead(sup):0;
  const r=f.history.length?rop(f.history,lead):null;
  const ss=f.history.length?safetyStock(f.history,lead):null;
  const eq=f.history.length&&f.unitCost?eoq(f.history,f.unitCost):null;
  return(
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label="Nombre del producto"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Harina 000"/></Field>
        <Field label="Código de barras (EAN)">
          <div style={{display:"flex",gap:6}}>
            <Inp inputRef={bRef} value={f.barcode} onChange={e=>set("barcode",e.target.value)} placeholder="Escanear o tipear"/>
            <button onClick={()=>bRef.current?.focus()} style={{border:`1px solid ${T.border}`,background:T.muted,padding:"0 10px",cursor:"pointer",fontSize:15,color:T.textSm,borderRadius:4}} title="Foco para scanner">▦</button>
          </div>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <Field label="Proveedor / Origen">
          <Sel value={f.supplierId} onChange={e=>set("supplierId",e.target.value)}>
            {suppliers.map(s=><option key={s.id} value={s.id}>[{s.flag}] {s.name} — {totalLead(s)}d</option>)}
          </Sel>
        </Field>
        <Field label="Unidad"><Inp value={f.unit} onChange={e=>set("unit",e.target.value)} placeholder="kg, lt, u..."/></Field>
        <Field label="Costo unitario (USD)"><Inp type="number" step="0.01" value={f.unitCost} onChange={e=>set("unitCost",+e.target.value)}/></Field>
      </div>
      <Field label="Stock actual"><Inp type="number" value={f.stock} onChange={e=>set("stock",+e.target.value)}/></Field>
      {r!==null&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Punto de pedido (ROP)",v:`${r} ${f.unit}`,h:"Pedir cuando llegue a este nivel"},{l:"Stock de seguridad",v:`${ss} ${f.unit}`,h:"Buffer 95% nivel de servicio"},{l:"Cantidad óptima (EOQ)",v:eq?`${eq} ${f.unit}`:"—",h:"Minimiza costos"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"12px 14px"}}>
              <Cap>{s.l}</Cap>
              <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text,margin:"4px 0 2px"}}>{s.v}</div>
              <p style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{s.h}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <Field label="Historial de consumo mensual" hint="Pegá desde Excel: YYYY-MM,cantidad — una línea por mes. Más historial = cálculos más precisos.">
          <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder={"2024-09,410\n2024-10,420\n2024-11,380\n2024-12,460\n2025-01,410\n2025-02,430"}
            style={{width:"100%",height:90,fontFamily:"monospace",fontSize:12,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4,marginTop:5}}/>
          <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
            <Btn onClick={parseCSV} variant="ghost" small>Importar historial</Btn>
            {f.history.length>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ {f.history.length} meses · prom. {Math.round(f.history.reduce((s,h)=>s+h.consumed,0)/f.history.length)} {f.unit}/mes</span>}
          </div>
        </Field>
      </div>
      <div style={{display:"flex",gap:10,paddingTop:4}}>
        <Btn onClick={()=>onSave(f)} full>{product?"Guardar cambios":"Agregar producto"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MODAL
// ─────────────────────────────────────────────────────────────────────────────
const OrderModal=({product,supplier,onConfirm,onClose})=>{
  const lead=totalLead(supplier);
  const daily=avgDaily(product.history);
  const r=rop(product.history,lead);
  const ss=safetyStock(product.history,lead);
  const eq=eoq(product.history,product.unitCost);
  const {level,daysToROP,daysOut}=alertLevel(product,supplier);
  const [qty,setQty]=useState(eq||Math.ceil(daily*lead*1.5));
  const [useEOQ,setUseEOQ]=useState(true);
  useEffect(()=>{if(useEOQ)setQty(eq||Math.ceil(daily*lead*1.5));},[useEOQ]);
  const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
  const stockAfter=product.stock+qty;
  const daysAfter=daily>0?Math.round(stockAfter/daily):999;
  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs=[{k:"preparation",l:"Preparación"},{k:"customs",l:"Aduana"},{k:"freight",l:"Flete"},{k:"warehouse",l:"Depósito"}];
  return(
    <Modal title={product.name} sub="Generar pedido de reabastecimiento" onClose={onClose} wide>
      <div style={{display:"grid",gap:20}}>
        {level!=="ok"&&(
          <div style={{background:ALERT_CFG[level].bg,border:`1px solid ${ALERT_CFG[level].bd}`,padding:"11px 14px",borderRadius:4,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:ALERT_CFG[level].dot,flexShrink:0,...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
            <span style={{fontFamily:T.sans,fontSize:12,color:ALERT_CFG[level].txt,fontWeight:600}}>
              {level==="order_now"?`Stock bajo el punto de pedido — quedan aprox. ${daysOut} días de existencia`:`El stock alcanza el punto de pedido en ${daysToROP} días — pedí antes del ${fmtShort(new Date(Date.now()+daysToROP*864e5))}`}
            </span>
          </div>
        )}
        {/* 4 metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Stock actual",v:`${product.stock} ${product.unit}`},{l:"Punto de pedido",v:`${r} ${product.unit}`,sub:"ROP"},{l:"Stock de seguridad",v:`${ss} ${product.unit}`,sub:"Safety"},{l:"Días restantes",v:`${daysOut<999?daysOut+"d":"∞"}`,c:daysOut<=lead?T.danger:T.text}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"13px 15px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <Cap>{s.l}</Cap>
                {s.sub&&<Cap style={{color:T.green,fontSize:9}}>{s.sub}</Cap>}
              </div>
              <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:s.c||T.text,marginTop:4}}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* Stock bar */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}>
            <Cap>Nivel de stock visual</Cap>
            <div style={{display:"flex",gap:12}}>
              {[["#fecaca","Stock seguridad"],[T.warning+"99","Punto de pedido"],[T.green+"99","Stock actual"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.sans,fontSize:10,color:T.textSm}}>
                  <span style={{width:10,height:6,background:c,borderRadius:1,display:"inline-block"}}/>{l}
                </span>
              ))}
            </div>
          </div>
          <StockBar stock={product.stock} r={r} ss={ss} max={Math.max(product.stock*1.6,r*2.5)}/>
        </div>
        {/* Timeline */}
        <div style={{background:T.cardWarm,borderRadius:6,padding:16,border:`1px solid ${T.border}`}}>
          <Cap>Timeline de entrega completo</Cap>
          <div style={{display:"flex",gap:2,marginTop:10,height:10,borderRadius:3,overflow:"hidden"}}>
            {tfs.map((tf,i)=><div key={tf.k} style={{flex:supplier.times[tf.k]||.1,background:tfCols[i]}} title={`${tf.l}: ${supplier.times[tf.k]}d`}/>)}
          </div>
          <div style={{display:"flex",gap:2,marginTop:7}}>
            {tfs.map((tf,i)=>(
              <div key={tf.k} style={{flex:supplier.times[tf.k]||.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[i]}}>{tf.l}</div>
                <div style={{fontFamily:T.sans,fontSize:9,color:T.textXs}}>{supplier.times[tf.k]}d</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Cap>Llegada estimada</Cap>
            <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.green}}>{fmtDate(arrival)}</div>
          </div>
        </div>
        {/* Qty */}
        <div>
          <Cap>Cantidad a pedir</Cap>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:10}}>
            <div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[{id:true,label:`EOQ — ${eq} ${product.unit}`,hint:"Óptimo por costo"},{id:false,label:"Manual",hint:"Ingresar cantidad"}].map(opt=>(
                  <button key={String(opt.id)} onClick={()=>setUseEOQ(opt.id)}
                    style={{flex:1,padding:"10px 12px",border:`1px solid ${useEOQ===opt.id?T.green:T.border}`,background:useEOQ===opt.id?T.greenBg:T.card,cursor:"pointer",textAlign:"left",borderRadius:4}}>
                    <div style={{fontFamily:T.sans,fontSize:11,fontWeight:600,color:useEOQ===opt.id?T.green:T.textMd}}>{opt.label}</div>
                    <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{opt.hint}</div>
                  </button>
                ))}
              </div>
              {!useEOQ&&<Inp type="number" value={qty} onChange={e=>setQty(Math.max(0,+e.target.value))} placeholder={`Cantidad en ${product.unit}`}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
              {[{l:"Cantidad",v:`${qty} ${product.unit}`},{l:"Costo total",v:`USD ${(qty*product.unitCost).toFixed(2)}`},{l:"Stock después",v:`${stockAfter} ${product.unit}`},{l:"Días de stock",v:`${daysAfter<999?daysAfter:999}d`}].map((s,i)=>(
                <div key={i} style={{background:T.cardWarm,padding:"10px 12px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:2}}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>onConfirm(qty)} full>Confirmar pedido · {qty} {product.unit} · USD {(qty*product.unitCost).toFixed(2)}</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT
// ─────────────────────────────────────────────────────────────────────────────
const ExcelModal=({products,onApply,onClose})=>{
  const [text,setText]=useState("");
  const [headers,setHeaders]=useState([]);
  const [rows,setRows]=useState([]);
  const [cols,setCols]=useState({code:"",name:"",stock:""});
  const [preview,setPreview]=useState([]);

  useEffect(()=>{
    if(!text.trim())return;
    const lines=text.trim().split("\n").filter(Boolean);
    if(lines.length<2)return;
    const sep=lines[0].includes("\t")?"\t":",";
    const hdrs=lines[0].split(sep).map(h=>h.trim().replace(/"/g,""));
    const data=lines.slice(1).map(l=>{const cells=l.split(sep).map(c=>c.trim().replace(/"/g,""));const o={};hdrs.forEach((h,i)=>o[h]=cells[i]||"");return o;});
    setHeaders(hdrs);setRows(data);
    const g=cs=>hdrs.find(h=>cs.some(c=>h.toLowerCase().includes(c)))||"";
    setCols({code:g(["codigo","código","cod","ean","barcode"]),name:g(["nombre","descripcion","descripción","producto","articulo","artículo"]),stock:g(["stock","cantidad","existencia","saldo","disponible"])});
  },[text]);

  useEffect(()=>{
    if(!rows.length||!cols.stock){setPreview([]);return;}
    const m=[];
    rows.forEach(row=>{
      const cv=cols.code?row[cols.code]:"",nv=cols.name?row[cols.name]:"",sv=parseFloat(row[cols.stock]);
      if(isNaN(sv))return;
      const p=products.find(p=>(cv&&p.barcode&&(p.barcode===cv||p.barcode===cv.replace(/\D/g,"")))||(nv&&p.name.toLowerCase().includes(nv.toLowerCase().slice(0,5))));
      if(p)m.push({product:p,newStock:Math.round(sv)});
    });
    setPreview(m);
  },[rows,cols]);

  return(
    <Modal title="Actualizar stock desde Excel" sub="Importar desde Mercado" onClose={onClose} wide>
      <div style={{display:"grid",gap:16}}>
        <div style={{background:T.watchBg,borderLeft:`3px solid ${T.watch}`,padding:"12px 14px",borderRadius:4}}>
          <p style={{fontFamily:T.sans,fontSize:12,color:"#1e40af",lineHeight:1.6}}>
            <strong>Desde Mercado:</strong> Listado de stock → Exportar → Excel/CSV → seleccioná todo (Ctrl+A) → copiá (Ctrl+C) → pegá abajo.
          </p>
        </div>
        <Field label="Pegá el contenido del Excel aquí (Ctrl+V)">
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"Código\tNombre\tStock disponible\n7790895000123\tHarina 000\t150"}
            style={{width:"100%",height:100,fontFamily:"monospace",fontSize:11,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4}}/>
        </Field>
        {headers.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[{k:"code",l:"Columna código"},{k:"name",l:"Columna nombre"},{k:"stock",l:"Columna stock ★"}].map(cf=>(
              <Field key={cf.k} label={cf.l}>
                <Sel value={cols[cf.k]} onChange={e=>setCols(c=>({...c,[cf.k]:e.target.value}))}>
                  <option value="">— no usar —</option>
                  {headers.map(h=><option key={h} value={h}>{h}</option>)}
                </Sel>
              </Field>
            ))}
          </div>
        )}
        {preview.length>0&&(
          <div>
            <Cap>{preview.length} productos encontrados</Cap>
            <div style={{border:`1px solid ${T.border}`,borderRadius:4,marginTop:8,maxHeight:180,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted}}>
                  {["Producto","Stock actual","Nuevo stock","Δ"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {preview.map((r,i)=>{const diff=r.newStock-r.product.stock;return(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:500}}>{r.product.name}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,color:T.textSm}}>{r.product.stock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{r.newStock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:diff>=0?T.ok:T.danger}}>{diff>=0?"+":""}{diff}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>preview.length&&onApply(preview)} full disabled={!preview.length}>Aplicar actualización ({preview.length} productos)</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA SCANNER  (ZXing — Google barcode library)
// ─────────────────────────────────────────────────────────────────────────────
const CameraScanner = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastScan, setLastScan] = useState("");
  const lastScanRef = useRef(""); // prevent duplicate fires

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        // Load ZXing dynamically from CDN
        if (!window.ZXing) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/zxing.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("No se pudo cargar la librería de escaneo"));
            document.head.appendChild(s);
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const hints = new Map();
        hints.set(2, [1, 2, 3, 4, 5, 6, 7, 8, 13, 14]); // all barcode formats

        const codeReader = new window.ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = codeReader;
        setStatus("scanning");

        codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (cancelled) return;
          if (result) {
            const text = result.getText();
            // Debounce — ignore same code within 2 seconds
            if (text === lastScanRef.current) return;
            lastScanRef.current = text;
            setLastScan(text);
            setTimeout(() => { lastScanRef.current = ""; }, 2000);
            onDetected(text);
          }
        });

      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          if (e.name === "NotAllowedError") setErrorMsg("Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.");
          else if (e.name === "NotFoundError") setErrorMsg("No se encontró cámara en este dispositivo.");
          else setErrorMsg(e.message || "Error al acceder a la cámara.");
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      readerRef.current?.reset?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent)" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 20, color: "#fff", fontWeight: 500 }}>Escaneando con cámara</div>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>Apuntá al código de barras del producto</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, color: "#fff", padding: "8px 14px", cursor: "pointer", fontFamily: T.sans, fontSize: 12, fontWeight: 600 }}>Cerrar</button>
      </div>

      {/* Video */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, aspectRatio: "4/3" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, display: status === "error" ? "none" : "block" }}/>

        {/* Scan frame overlay */}
        {status === "scanning" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {/* Dimmed corners */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }}/>
            {/* Clear scan zone */}
            <div style={{ position: "relative", width: "72%", height: "35%", zIndex: 1 }}>
              <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.0)", background: "transparent" }}/>
              {/* Corner brackets */}
              {[["top:0,left:0","borderTop,borderLeft"],["top:0,right:0","borderTop,borderRight"],["bottom:0,left:0","borderBottom,borderLeft"],["bottom:0,right:0","borderBottom,borderRight"]].map(([pos, borders], i) => {
                const p = Object.fromEntries(pos.split(",").map(s => s.split(":")));
                const b = Object.fromEntries(borders.split(",").map(s => [s, `3px solid ${T.green}`]));
                return <div key={i} style={{ position: "absolute", width: 22, height: 22, ...p, ...b }}/>;
              })}
              {/* Scan line animation */}
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${T.green}, transparent)`, animation: "scanLine 2s ease-in-out infinite" }}/>
            </div>
          </div>
        )}

        {/* Starting overlay */}
        {status === "starting" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.7)", borderRadius: 4 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            <p style={{ fontFamily: T.sans, fontSize: 13, color: "#fff", marginTop: 14 }}>Iniciando cámara...</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📷</div>
            <p style={{ fontFamily: T.sans, fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 8 }}>No se pudo acceder a la cámara</p>
            <p style={{ fontFamily: T.sans, fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ marginTop: 20, background: T.green, border: "none", color: "#fff", padding: "10px 24px", borderRadius: 4, fontFamily: T.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Volver al scanner manual</button>
          </div>
        )}
      </div>

      {/* Last scan feedback */}
      {lastScan && (
        <div style={{ marginTop: 16, background: T.greenBg, border: `1px solid ${T.greenBd}`, borderRadius: 6, padding: "10px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: T.sans, fontSize: 12, color: T.green, fontWeight: 600 }}>Código detectado: {lastScan}</p>
        </div>
      )}

      <p style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 20, textAlign: "center", padding: "0 24px" }}>
        Funciona con códigos EAN-8, EAN-13, UPC, QR y más · Usá cámara trasera para mejores resultados
      </p>

      <style>{`
        @keyframes scanLine { 0%,100%{top:0;opacity:0;} 10%{opacity:1;} 90%{opacity:1;} 50%{top:calc(100% - 2px);} }
        @keyframes spin { to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER  (USB lector + Cámara del celular)
// ─────────────────────────────────────────────────────────────────────────────
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
          {id:"usb",   icon:"⌨", title:"Lector USB / Bluetooth", sub:"Lector físico conectado a la PC"},
          {id:"camera",icon:"📷", title:"Cámara del celular",     sub:"Usá la cámara para escanear"},
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
          <Cap>Campo de escaneo — click aquí antes de escanear</Cap>
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
            <span style={{fontSize:40}}>📷</span>
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


// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER RATING STARS
// ─────────────────────────────────────────────────────────────────────────────
const Stars = ({ value, onChange }) => (
  <div style={{display:"flex",gap:3}}>
    {[1,2,3,4,5].map(n => (
      <button key={n} onClick={()=>onChange&&onChange(n)}
        style={{background:"none",border:"none",cursor:onChange?"pointer":"default",
          fontSize:16,color:n<=value?"#f59e0b":"#ddd6cb",padding:"0 1px",lineHeight:1}}>★</button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────
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
          {tfs.map(([k,l],i)=>(
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

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
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
                {icon:"👤",label:"Contacto",val:supplier.contact},
                {icon:"✉",label:"Email",val:supplier.email,href:`mailto:${supplier.email}`},
                {icon:"📞",label:"Teléfono",val:supplier.phone,href:`tel:${supplier.phone}`},
                {icon:"💬",label:"WhatsApp",val:supplier.whatsapp,href:supplier.whatsapp?`https://wa.me/${supplier.whatsapp.replace(/\D/g,"")}`:""},
                {icon:"📍",label:"Ubicación",val:[supplier.city,supplier.country].filter(Boolean).join(", ")},
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
                {l:"Plazo de pago",v:`${supplier.paymentTerms||"—"} días`},
                {l:"Forma de pago",v:supplier.paymentMethod||"—"},
                {l:"Pedido mínimo",v:supplier.minOrder>0?`${supplier.currency||"USD"} ${supplier.minOrder}`:"Sin mínimo"},
                {l:"Descuento",v:supplier.discount>0?`${supplier.discount}% por volumen`:"Sin descuento"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<4?`1px solid ${T.muted}`:"none"}}>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.l}</span>
                  <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.v||r[1]||"—"}</span>
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
            {tfs.map(([k,l],i)=>(
              <div key={k} style={{flex:supplier.times[k]||0.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[i]}}>{l}</div>
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
          <Btn onClick={onEdit} full variant="ghost">✏ Editar proveedor</Btn>
          <Btn onClick={onClose} variant="ghost">Cerrar</Btn>
        </div>
      </div>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// PLANNING MODULE — Proyección 6 meses + temporadas + cuánto pedir
// ─────────────────────────────────────────────────────────────────────────────

// Months helper
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const getNextMonths = (n=6) => {
  const out = [];
  const d = new Date();
  for(let i=0;i<n;i++){
    const m = new Date(d.getFullYear(), d.getMonth()+i, 1);
    out.push({ key: m.toISOString().slice(0,7), label: MONTHS_ES[m.getMonth()]+" "+m.getFullYear().toString().slice(2) });
  }
  return out;
};

const SEASON_PRESETS = [
  { id:"none",    label:"Sin ajuste",      mult:1.0 },
  { id:"low",     label:"Temporada baja",  mult:0.7 },
  { id:"normal",  label:"Normal",          mult:1.0 },
  { id:"high",    label:"Temporada alta",  mult:1.3 },
  { id:"peak",    label:"Pico (diciembre/SS)", mult:1.6 },
];

const SeasonBadge = ({ mult }) => {
  const cfg = mult >= 1.5 ? {c:"#92400e",bg:"#fffbeb",bd:"#fde68a",l:"Pico"} :
              mult >= 1.2 ? {c:"#166534",bg:"#f0fdf4",bd:"#bbf7d0",l:"Alta"} :
              mult <= 0.8 ? {c:"#1e40af",bg:"#eff6ff",bd:"#bfdbfe",l:"Baja"} :
                            {c:T.textSm,bg:T.muted,bd:T.border,l:"Normal"};
  return <span style={{fontFamily:T.sans,fontSize:10,fontWeight:700,color:cfg.c,background:cfg.bg,border:`1px solid ${cfg.bd}`,padding:"2px 7px",borderRadius:2}}>{cfg.l} ×{mult}</span>;
};

// Main planning view
const PlanningView = ({ products, suppliers, orders, plans, setPlans }) => {
  const months = getNextMonths(6);
  const [selProduct, setSelProduct] = useState(products[0]?.id || null);
  const [viewMode, setViewMode]     = useState("product"); // "product" | "summary"

  const getSup = id => suppliers.find(s=>s.id===id);

  // Get or init plan for a product
  const getPlan = (pid) => plans[pid] || {
    months: Object.fromEntries(months.map(m=>[m.key,{mult:1.0,manualQty:null}])),
    coverageMonths: 2,
  };

  const updateMonth = (pid, monthKey, field, val) => {
    setPlans(p => {
      const plan = getPlan(pid);
      return { ...p, [pid]: { ...plan, months: { ...plan.months, [monthKey]: { ...(plan.months[monthKey]||{}), [field]: val } } } };
    });
  };

  const updateCoverage = (pid, val) => {
    setPlans(p => { const plan = getPlan(pid); return { ...p, [pid]: { ...plan, coverageMonths: val } }; });
  };

  // Calculate projected demand for a product in a month
  const projectedDemand = (product, monthKey) => {
    const base = avgDaily(product.history) * 30;
    const plan = getPlan(product.id);
    const m = plan.months[monthKey] || {};
    if(m.manualQty !== null && m.manualQty !== undefined && m.manualQty !== "") return +m.manualQty;
    return Math.ceil(base * (m.mult || 1.0));
  };

  // How much to order considering lead time and coverage target
  const calcOrderQty = (product) => {
    const sup = getSup(product.supplierId);
    const lead = totalLead(sup);
    const plan = getPlan(product.id);
    const coverage = plan.coverageMonths || 2;

    // Total projected demand over lead + coverage period
    const totalDays = lead + coverage * 30;
    const dailyBase = avgDaily(product.history);

    // Sum projected monthly demand for coverage window
    let projected = 0;
    for(let i=0; i<coverage; i++) {
      const mkey = months[i]?.key;
      if(mkey) projected += projectedDemand(product, mkey);
      else projected += dailyBase * 30;
    }
    // Add safety stock
    const ss = safetyStock(product.history, lead);
    const needed = projected + ss;
    return Math.max(0, Math.ceil(needed - product.stock));
  };

  // Total projected cost for all products needing order
  const allProductsWithOrders = useMemo(() => {
    return products.map(p => {
      const sup = getSup(p.supplierId);
      const plan = getPlan(p.id);
      const qtyNeeded = calcOrderQty(p);
      const projections = months.map(m => projectedDemand(p, m.key));
      const totalProjected = projections.reduce((a,b)=>a+b,0);
      return { ...p, sup, plan, qtyNeeded, projections, totalProjected };
    });
  }, [products, plans, suppliers]);

  const needsOrder = allProductsWithOrders.filter(p=>p.qtyNeeded>0);
  const totalOrderCost = needsOrder.reduce((s,p)=>s+(p.qtyNeeded*(p.unitCost||0)),0);

  const selectedProduct = allProductsWithOrders.find(p=>p.id===selProduct);
  const selPlan = selectedProduct ? getPlan(selectedProduct.id) : null;

  return (
    <div style={{display:"grid",gap:28}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <Cap style={{color:T.green}}>Proyección</Cap>
          <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>
            Planificación · próximos 6 meses
          </h1>
          <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:6,lineHeight:1.6}}>
            Ajustá la demanda esperada por mes, definí temporadas altas y bajas, y el sistema calcula exactamente cuánto pedir de cada producto.
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          {["product","summary"].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)}
              style={{padding:"8px 16px",fontFamily:T.sans,fontSize:12,fontWeight:600,cursor:"pointer",borderRadius:4,
                background:viewMode===m?T.green:"transparent",color:viewMode===m?"#fff":T.textSm,
                border:`1px solid ${viewMode===m?T.green:T.border}`}}>
              {m==="product"?"Por producto":"Resumen general"}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRODUCT VIEW ── */}
      {viewMode==="product" && (
        <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:16,alignItems:"start"}}>
          {/* Product list sidebar */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card,position:"sticky",top:20}}>
            <div style={{padding:"10px 14px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Productos</Cap></div>
            {allProductsWithOrders.map(p=>(
              <button key={p.id} onClick={()=>setSelProduct(p.id)}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selProduct===p.id?T.greenBg:"transparent",
                  border:"none",borderLeft:selProduct===p.id?`3px solid ${T.green}`:"3px solid transparent",
                  borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
                <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:selProduct===p.id?T.green:T.text}}>{p.name}</div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                  <span style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>[{p.sup?.flag}] {p.sup?.name}</span>
                  {p.qtyNeeded>0 && <span style={{fontFamily:T.sans,fontSize:10,fontWeight:700,color:T.danger}}>+{p.qtyNeeded} {p.unit}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Product detail planner */}
          {selectedProduct && selPlan && (
            <div style={{display:"grid",gap:16}}>
              {/* Product header */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div>
                    <Cap style={{color:T.green}}>[{selectedProduct.sup?.flag}] {selectedProduct.sup?.name} · Lead {totalLead(selectedProduct.sup)}d</Cap>
                    <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.text,marginTop:4}}>{selectedProduct.name}</h2>
                    <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Stock actual: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong></span>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Consumo histórico prom.: <strong>{Math.round(avgDaily(selectedProduct.history)*30)} {selectedProduct.unit}/mes</strong></span>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Costo unit.: <strong>{selectedProduct.currency||"USD"} {selectedProduct.unitCost}</strong></span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <Cap>Cobertura objetivo</Cap>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginTop:6}}>
                      <input type="range" min="1" max="6" value={selPlan.coverageMonths||2}
                        onChange={e=>updateCoverage(selectedProduct.id,+e.target.value)}
                        style={{width:100}}/>
                      <span style={{fontFamily:T.serif,fontSize:24,fontWeight:500,color:T.green,minWidth:60}}>{selPlan.coverageMonths||2} mes{(selPlan.coverageMonths||2)>1?"es":""}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly projections table */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
                <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <Cap>Demanda proyectada mes a mes</Cap>
                  <Cap style={{color:T.textXs}}>Base histórica: {Math.round(avgDaily(selectedProduct.history)*30)} {selectedProduct.unit}/mes · Editá cualquier celda para sobreescribir</Cap>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${T.border}`}}>
                        <th style={{padding:"10px 14px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,minWidth:100}}>Mes</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Temporada</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Multiplicador</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Qty manual</th>
                        <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Proyectado</th>
                        <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Costo est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m,i) => {
                        const mdata = selPlan.months[m.key] || {};
                        const isManual = mdata.manualQty !== null && mdata.manualQty !== undefined && mdata.manualQty !== "";
                        const projected = projectedDemand(selectedProduct, m.key);
                        const cost = projected * (selectedProduct.unitCost||0);
                        const mult = mdata.mult || 1.0;
                        return (
                          <tr key={m.key} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.cardWarm}}>
                            <td style={{padding:"11px 14px"}}>
                              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{m.label}</div>
                              {i < (selPlan.coverageMonths||2) && (
                                <div style={{fontFamily:T.sans,fontSize:10,color:T.green,marginTop:2}}>● en cobertura objetivo</div>
                              )}
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              <select value={isManual?"manual":SEASON_PRESETS.find(p=>p.mult===mult)?.id||"normal"}
                                onChange={e=>{
                                  if(e.target.value==="manual") return;
                                  const preset = SEASON_PRESETS.find(p=>p.id===e.target.value);
                                  updateMonth(selectedProduct.id, m.key, "mult", preset?.mult||1.0);
                                  updateMonth(selectedProduct.id, m.key, "manualQty", null);
                                }}
                                style={{fontFamily:T.sans,fontSize:11,border:`1px solid ${T.border}`,borderRadius:3,padding:"4px 6px",background:T.card,color:T.text,cursor:"pointer"}}>
                                {SEASON_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                                {isManual && <option value="manual">Manual</option>}
                              </select>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              {!isManual ? <SeasonBadge mult={mult}/> : <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,fontStyle:"italic"}}>manual</span>}
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              <input type="number" min="0"
                                value={isManual ? mdata.manualQty : ""}
                                placeholder={String(Math.ceil(avgDaily(selectedProduct.history)*30*(mult||1)))}
                                onChange={e=>updateMonth(selectedProduct.id, m.key, "manualQty", e.target.value===""?null:+e.target.value)}
                                style={{width:80,fontFamily:T.sans,fontSize:12,border:`1px solid ${isManual?T.green:T.border}`,borderRadius:3,padding:"5px 8px",textAlign:"center",background:isManual?T.greenBg:T.card,color:isManual?T.green:T.text}}/>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"right"}}>
                              <span style={{fontFamily:T.serif,fontSize:16,fontWeight:500,color:T.text}}>{projected}</span>
                              <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginLeft:4}}>{selectedProduct.unit}</span>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"right"}}>
                              <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>USD {cost.toFixed(0)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{borderTop:`2px solid ${T.border}`,background:T.muted}}>
                        <td colSpan={4} style={{padding:"12px 14px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.text}}>Total proyectado 6 meses</td>
                        <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.serif,fontSize:18,fontWeight:600,color:T.text}}>
                          {selectedProduct.projections.reduce((a,b)=>a+b,0)} {selectedProduct.unit}
                        </td>
                        <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>
                          USD {(selectedProduct.projections.reduce((a,b)=>a+b,0)*(selectedProduct.unitCost||0)).toFixed(0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Visual bar chart */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"16px 20px"}}>
                <Cap>Proyección visual</Cap>
                <div style={{display:"flex",gap:6,alignItems:"flex-end",height:90,marginTop:14,paddingBottom:4}}>
                  {months.map((m,i)=>{
                    const projected = projectedDemand(selectedProduct, m.key);
                    const maxP = Math.max(...months.map(mx=>projectedDemand(selectedProduct,mx.key)),1);
                    const pct = projected/maxP;
                    const mdata = selPlan.months[m.key]||{};
                    const isManual = mdata.manualQty !== null && mdata.manualQty !== undefined && mdata.manualQty !== "";
                    const inCoverage = i < (selPlan.coverageMonths||2);
                    return (
                      <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textSm}}>{projected}</div>
                        <div style={{width:"100%",height:Math.max(8,pct*70),
                          background:isManual?T.green:inCoverage?T.greenLt:T.muted,
                          borderRadius:"3px 3px 0 0",border:`1px solid ${inCoverage?T.greenBd:T.border}`,
                          transition:"height .3s"}}/>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs,textAlign:"center",lineHeight:1.2}}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:14,marginTop:8}}>
                  {[{c:T.green,l:"Ingreso manual"},{c:T.greenLt,l:"En cobertura (automático)"},{c:T.muted,l:"Fuera de cobertura"}].map(({c,l})=>(
                    <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontFamily:T.sans,fontSize:10,color:T.textSm}}>
                      <span style={{width:10,height:10,background:c,borderRadius:2,display:"inline-block"}}/>{l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Order recommendation */}
              <div style={{background:selectedProduct.qtyNeeded>0?T.dangerBg:T.okBg,border:`1px solid ${selectedProduct.qtyNeeded>0?T.dangerBd:T.okBd}`,borderRadius:8,padding:"16px 20px"}}>
                <Cap style={{color:selectedProduct.qtyNeeded>0?T.danger:T.ok}}>
                  {selectedProduct.qtyNeeded>0?"Recomendación de pedido":"Stock suficiente"}
                </Cap>
                {selectedProduct.qtyNeeded>0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,marginTop:10,alignItems:"center"}}>
                    <div>
                      <div style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.danger}}>
                        Pedir {selectedProduct.qtyNeeded} {selectedProduct.unit}
                      </div>
                      <p style={{fontFamily:T.sans,fontSize:12,color:T.textMd,marginTop:6,lineHeight:1.6}}>
                        Para cubrir la demanda proyectada de <strong>{selPlan.coverageMonths||2} meses</strong> + stock de seguridad ({safetyStock(selectedProduct.history,totalLead(selectedProduct.sup))} {selectedProduct.unit}),
                        considerando el lead time de <strong>{totalLead(selectedProduct.sup)} días</strong> de {selectedProduct.sup?.name}.
                        Costo estimado: <strong>USD {(selectedProduct.qtyNeeded*(selectedProduct.unitCost||0)).toFixed(2)}</strong>
                      </p>
                    </div>
                    <Btn onClick={()=>{}} variant="warning" small>Generar pedido</Btn>
                  </div>
                ) : (
                  <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,marginTop:6}}>
                    El stock actual ({selectedProduct.stock} {selectedProduct.unit}) es suficiente para cubrir los próximos {selPlan.coverageMonths||2} meses de demanda proyectada.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY VIEW ── */}
      {viewMode==="summary" && (
        <div style={{display:"grid",gap:20}}>
          {/* Summary stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
            {[
              {l:"Productos planificados", v:Object.keys(plans).length},
              {l:"Necesitan pedido",        v:needsOrder.length, c:needsOrder.length>0?T.danger:T.text},
              {l:"Total proyectado",        v:`USD ${allProductsWithOrders.reduce((s,p)=>s+(p.totalProjected*(p.unitCost||0)),0).toFixed(0)}`},
              {l:"Costo pedidos necesarios",v:`USD ${totalOrderCost.toFixed(0)}`, c:totalOrderCost>0?T.warning:T.text},
            ].map((s,i)=>(
              <div key={i} style={{background:T.card,padding:"18px 20px"}}>
                <Cap>{s.l}</Cap>
                <div style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:s.c||T.text,marginTop:6}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Monthly demand heatmap — all products */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto"}}>
            <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}>
              <Cap>Demanda proyectada total por mes (todos los productos)</Cap>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${T.border}`}}>
                  <th style={{padding:"10px 14px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm,minWidth:140}}>Producto</th>
                  {months.map(m=><th key={m.key} style={{padding:"10px 10px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm,minWidth:70}}>{m.label}</th>)}
                  <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm}}>Total</th>
                  <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm}}>Pedir</th>
                </tr>
              </thead>
              <tbody>
                {allProductsWithOrders.map((p,ri)=>{
                  const maxForRow = Math.max(...p.projections, 1);
                  return (
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:ri%2===0?T.card:T.cardWarm}}>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{p.name}</div>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>[{p.sup?.flag}] {p.sup?.name}</div>
                      </td>
                      {months.map((m,ci)=>{
                        const val = p.projections[ci];
                        const intensity = val/maxForRow;
                        return (
                          <td key={m.key} style={{padding:"8px 10px",textAlign:"center"}}>
                            <div style={{background:`rgba(45,90,27,${intensity*0.25+0.04})`,borderRadius:3,padding:"4px 6px",cursor:"pointer"}}
                              onClick={()=>{setSelProduct(p.id);setViewMode("product");}}>
                              <span style={{fontFamily:T.sans,fontSize:12,fontWeight:intensity>0.7?600:400,color:intensity>0.6?T.green:T.textMd}}>{val}</span>
                            </div>
                          </td>
                        );
                      })}
                      <td style={{padding:"11px 14px",textAlign:"right",fontFamily:T.serif,fontSize:15,fontWeight:500,color:T.text}}>{p.totalProjected} {p.unit}</td>
                      <td style={{padding:"11px 14px",textAlign:"right"}}>
                        {p.qtyNeeded>0
                          ? <span style={{fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.danger}}>+{p.qtyNeeded} {p.unit}</span>
                          : <span style={{fontFamily:T.sans,fontSize:12,color:T.ok}}>✓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:`2px solid ${T.border}`,background:T.muted}}>
                  <td style={{padding:"12px 14px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.text}}>Costo total estimado</td>
                  {months.map((m,i)=>(
                    <td key={m.key} style={{padding:"12px 10px",textAlign:"center",fontFamily:T.sans,fontSize:11,fontWeight:600,color:T.textMd}}>
                      USD {allProductsWithOrders.reduce((s,p)=>s+(p.projections[i]*(p.unitCost||0)),0).toFixed(0)}
                    </td>
                  ))}
                  <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>
                    USD {allProductsWithOrders.reduce((s,p)=>s+(p.totalProjected*(p.unitCost||0)),0).toFixed(0)}
                  </td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.danger}}>
                    USD {totalOrderCost.toFixed(0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Per-supplier order consolidation */}
          {needsOrder.length>0 && (
            <div>
              <div style={{marginBottom:10}}>
                <Cap>Pedidos consolidados por proveedor</Cap>
                <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:4}}>Agrupá tus pedidos para aprovechar mínimos y descuentos.</p>
              </div>
              <div style={{display:"grid",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                {suppliers.map(sup=>{
                  const supNeeds = needsOrder.filter(p=>p.supplierId===sup.id);
                  if(!supNeeds.length) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f7"}}><div style={{textAlign:"center",fontFamily:"sans-serif"}}><div style={{fontSize:40,marginBottom:12}}>🌿</div><p style={{color:"#666",fontSize:14}}>Cargando...</p></div></div>);
                  const totalCost = supNeeds.reduce((s,p)=>s+(p.qtyNeeded*(p.unitCost||0)),0);
                  const minOrder = +(sup.minOrder||0);
                  const meetsMin = totalCost >= minOrder || minOrder===0;
                  return (
                    <div key={sup.id} style={{background:T.card,padding:"16px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{background:sup.color+"22",color:sup.color,fontFamily:T.sans,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3}}>{sup.flag}</span>
                          <div>
                            <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text}}>{sup.name}</div>
                            {sup.company&&<div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>{sup.company}</div>}
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:meetsMin?T.ok:T.warning}}>
                            {sup.currency||"USD"} {totalCost.toFixed(0)}
                          </div>
                          {!meetsMin && <div style={{fontFamily:T.sans,fontSize:11,color:T.warning,marginTop:2}}>⚠ Mínimo: {sup.currency||"USD"} {minOrder} — faltan {sup.currency||"USD"} {(minOrder-totalCost).toFixed(0)}</div>}
                          {meetsMin && minOrder>0 && <div style={{fontFamily:T.sans,fontSize:11,color:T.ok,marginTop:2}}>✓ Supera pedido mínimo</div>}
                          {sup.discount>0 && totalCost >= minOrder && <div style={{fontFamily:T.sans,fontSize:11,color:T.green,marginTop:2}}>🏷 Descuento {sup.discount}% aplicable</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:1,background:T.border,borderRadius:4,overflow:"hidden"}}>
                        {supNeeds.map(p=>(
                          <div key={p.id} style={{background:T.cardWarm,padding:"8px 12px",flex:1}}>
                            <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div>
                            <div style={{fontFamily:T.serif,fontSize:16,fontWeight:500,color:T.danger,marginTop:2}}>{p.qtyNeeded} {p.unit}</div>
                            <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>USD {(p.qtyNeeded*(p.unitCost||0)).toFixed(0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENTS VIEW — Historial completo de movimientos
// ─────────────────────────────────────────────────────────────────────────────
const MOV_CFG = {
  order_placed: { icon:"📋", label:"Pedido generado",   color:"#1d4ed8", bg:"#eff6ff", bd:"#bfdbfe" },
  delivery:     { icon:"📦", label:"Mercadería recibida",color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  scanner_in:   { icon:"⌨", label:"Ingreso scanner",    color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  excel_in:     { icon:"📊", label:"Ajuste Excel +",     color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  excel_out:    { icon:"📊", label:"Ajuste Excel −",     color:"#b91c1c", bg:"#fef2f2", bd:"#fecaca" },
  manual_in:    { icon:"➕", label:"Entrada manual",     color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  manual_out:   { icon:"➖", label:"Salida manual",      color:"#b91c1c", bg:"#fef2f2", bd:"#fecaca" },
  adjustment:   { icon:"⚖", label:"Ajuste de inventario",color:"#92400e",bg:"#fffbeb",bd:"#fde68a" },
};

const MovTypeTag = ({type}) => {
  const c = MOV_CFG[type] || {icon:"•",label:type,color:T.textSm,bg:T.muted,bd:T.border};
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.bd}`,color:c.color,
      fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 8px",borderRadius:3}}>
      {c.icon} {c.label}
    </span>
  );
};

const MovementsView = ({ movements, products, suppliers, onAddManual }) => {
  const [filterProd, setFilterProd] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]   = useState("");
  const [search, setSearch] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);

  const filtered = useMemo(() => {
    return movements.filter(m => {
      if(filterProd !== "all" && m.productId !== filterProd) return false;
      if(filterType !== "all" && m.type !== filterType) return false;
      if(filterDateFrom && m.ts < filterDateFrom) return false;
      if(filterDateTo   && m.ts > filterDateTo+"T23:59:59") return false;
      if(search && !m.productName?.toLowerCase().includes(search.toLowerCase()) && !m.note?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [movements, filterProd, filterType, filterDateFrom, filterDateTo, search]);

  // Stats
  const totalIn  = filtered.filter(m=>["delivery","scanner_in","excel_in","manual_in"].includes(m.type)).reduce((s,m)=>s+m.qty,0);
  const totalOut = filtered.filter(m=>["excel_out","manual_out"].includes(m.type)).reduce((s,m)=>s+m.qty,0);
  const orderCount = filtered.filter(m=>m.type==="order_placed").length;

  // Product options for filter
  const prodOptions = [...new Set(movements.map(m=>m.productId))].map(id=>{
    const p = products.find(x=>x.id===id||x.id===+id);
    return { id, name: p?.name || id };
  });

  return (
    <div style={{display:"grid",gap:24}}>
      {showManualModal && <ManualMovModal products={products} onSave={(m)=>{onAddManual(m);setShowManualModal(false);}} onClose={()=>setShowManualModal(false)}/>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <Cap style={{color:T.green}}>Auditoría</Cap>
          <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Historial de movimientos</h1>
          <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:5,lineHeight:1.5}}>
            Registro completo de todas las entradas, salidas y ajustes de stock.
          </p>
        </div>
        <Btn onClick={()=>setShowManualModal(true)}>+ Movimiento manual</Btn>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
        {[
          {l:"Total movimientos",v:filtered.length},
          {l:"Entradas",         v:totalIn,  c:T.ok},
          {l:"Salidas",          v:totalOut, c:T.danger},
          {l:"Pedidos generados",v:orderCount,c:T.watch},
        ].map((s,i)=>(
          <div key={i} style={{background:T.card,padding:"18px 20px"}}>
            <Cap>{s.l}</Cap>
            <div style={{fontFamily:T.serif,fontSize:40,fontWeight:400,color:s.c||T.text,lineHeight:1,marginTop:8}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 18px"}}>
        <Cap>Filtros</Cap>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:12,marginTop:10}}>
          <Field label="Buscar">
            <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Producto o nota..."/>
          </Field>
          <Field label="Producto">
            <Sel value={filterProd} onChange={e=>setFilterProd(e.target.value)}>
              <option value="all">Todos los productos</option>
              {prodOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </Sel>
          </Field>
          <Field label="Tipo de movimiento">
            <Sel value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">Todos los tipos</option>
              {Object.entries(MOV_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </Sel>
          </Field>
          <Field label="Desde">
            <Inp type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}/>
          </Field>
          <Field label="Hasta">
            <Inp type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}/>
          </Field>
        </div>
        {(search||filterProd!=="all"||filterType!=="all"||filterDateFrom||filterDateTo) && (
          <button onClick={()=>{setSearch("");setFilterProd("all");setFilterType("all");setFilterDateFrom("");setFilterDateTo("");}}
            style={{fontFamily:T.sans,fontSize:11,color:T.green,background:"none",border:"none",cursor:"pointer",marginTop:8,fontWeight:600}}>
            × Limpiar filtros
          </button>
        )}
      </div>

      {/* Movements table */}
      {filtered.length === 0 ? (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>📋</div>
          <p style={{fontFamily:T.sans,fontSize:14,color:T.textSm,fontWeight:500}}>
            {movements.length===0 ? "Sin movimientos registrados aún." : "Sin movimientos que coincidan con los filtros."}
          </p>
          {movements.length===0 && (
            <p style={{fontFamily:T.sans,fontSize:12,color:T.textXs,marginTop:6,lineHeight:1.6}}>
              Los movimientos se registran automáticamente al generar pedidos, marcar entregas, usar el scanner o importar Excel.
            </p>
          )}
        </div>
      ) : (
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                {["Fecha y hora","Tipo","Producto","Proveedor","Cantidad","Nota / Referencia"].map(h=>(
                  <th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m,i)=>{
                const cfg = MOV_CFG[m.type]||{color:T.textSm};
                const isIn  = ["delivery","scanner_in","excel_in","manual_in"].includes(m.type);
                const isOut = ["excel_out","manual_out"].includes(m.type);
                const d = new Date(m.ts);
                return (
                  <tr key={m.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.cardWarm}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.cardWarm}>
                    <td style={{padding:"10px 13px",whiteSpace:"nowrap"}}>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>
                        {d.toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"})}
                      </div>
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>
                        {d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </td>
                    <td style={{padding:"10px 13px"}}><MovTypeTag type={m.type}/></td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>
                      {m.productName}
                    </td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>
                      {m.supplierName||"—"}
                    </td>
                    <td style={{padding:"10px 13px",whiteSpace:"nowrap"}}>
                      <span style={{fontFamily:T.serif,fontSize:16,fontWeight:600,
                        color:isIn?T.ok:isOut?T.danger:T.watch}}>
                        {isIn?"+":isOut?"−":""}{m.qty} {m.unit}
                      </span>
                    </td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm,maxWidth:280}}>
                      {m.note||"—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Export hint */}
      {filtered.length>0 && (
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={()=>{
            const rows=[["Fecha","Hora","Tipo","Producto","Proveedor","Cantidad","Unidad","Nota"],...filtered.map(m=>{const d=new Date(m.ts);return[d.toLocaleDateString("es-UY"),d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"}),(MOV_CFG[m.type]||{label:m.type}).label,m.productName,m.supplierName||"",m.qty,m.unit,m.note||""];})];
            const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,﻿"+encodeURIComponent(csv);a.download=`movimientos-${new Date().toISOString().slice(0,10)}.csv`;a.click();
          }} style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.green,background:T.greenBg,border:`1px solid ${T.greenBd}`,padding:"8px 16px",borderRadius:4,cursor:"pointer"}}>
            ↓ Exportar CSV ({filtered.length} registros)
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL MOVEMENT MODAL
// ─────────────────────────────────────────────────────────────────────────────
const ManualMovModal = ({ products, onSave, onClose }) => {
  const [f, setF] = useState({ productId:"", type:"manual_in", qty:1, note:"" });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const selProd = products.find(p=>p.id===+f.productId||p.id===f.productId);
  const valid = f.productId && f.qty > 0;
  const handle = () => {
    if(!valid) return;
    onSave({
      type: f.type,
      productId: selProd.id,
      productName: selProd.name,
      supplierId: selProd.supplierId,
      supplierName: "",
      qty: +f.qty,
      unit: selProd.unit,
      note: f.note || (f.type==="manual_in"?"Entrada manual":"Salida manual"),
    });
  };
  return (
    <Modal title="Registrar movimiento manual" sub="Historial" onClose={onClose}>
      <div style={{display:"grid",gap:16}}>
        <div style={{background:T.watchBg,border:`1px solid ${T.watchBd}`,borderRadius:4,padding:"10px 14px"}}>
          <p style={{fontFamily:T.sans,fontSize:12,color:T.watch,lineHeight:1.6}}>
            Usá esto para correcciones de inventario, mermas, ajustes por conteo físico, o cualquier movimiento que no fue capturado automáticamente.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Tipo de movimiento">
            <Sel value={f.type} onChange={e=>set("type",e.target.value)}>
              <option value="manual_in">➕ Entrada manual</option>
              <option value="manual_out">➖ Salida manual</option>
              <option value="adjustment">⚖ Ajuste de inventario</option>
            </Sel>
          </Field>
          <Field label="Producto">
            <Sel value={f.productId} onChange={e=>set("productId",e.target.value)}>
              <option value="">— Seleccioná —</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
            </Sel>
          </Field>
        </div>
        <Field label={`Cantidad${selProd?" ("+selProd.unit+")":""}`}>
          <Inp type="number" min="0" value={f.qty} onChange={e=>set("qty",+e.target.value)}/>
        </Field>
        {selProd && f.type !== "adjustment" && (
          <div style={{background:T.muted,borderRadius:4,padding:"10px 14px"}}>
            <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>
              Stock actual: <strong>{selProd.stock} {selProd.unit}</strong> →
              Stock después: <strong style={{color:f.type==="manual_in"?T.ok:T.danger}}>
                {f.type==="manual_in"?(selProd.stock+(+f.qty||0)):(selProd.stock-(+f.qty||0))} {selProd.unit}
              </strong>
            </p>
          </div>
        )}
        <Field label="Nota / Motivo" hint="Ej: Merma por vencimiento, Ajuste conteo físico, Cortesía cliente, etc.">
          <Inp value={f.note} onChange={e=>set("note",e.target.value)} placeholder="Motivo del movimiento..."/>
        </Field>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={handle} full disabled={!valid}>Registrar movimiento</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SETTINGS VIEW
// ─────────────────────────────────────────────────────────────────────────────
const EmailSettings = ({ cfg, setCfg, enriched, onTestSend, onManualSend }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const set = (k,v) => setCfg(c=>({...c,[k]:v}));
  const configured = cfg.serviceId && cfg.templateId && cfg.publicKey && cfg.toEmail;

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey,
          template_params: { to_email: cfg.toEmail, subject:"✓ Email de prueba funcionando", html_content:"<p style='font-family:sans-serif;padding:20px;'>✅ Las notificaciones están configuradas correctamente. Recibirás alertas automáticas cuando el stock cruce el punto de pedido.</p>", alert_count:0 }
        })
      });
      setTestResult(resp.status===200?"ok":"error");
    } catch { setTestResult("error"); }
    setTesting(false);
  };

  const alertProds = enriched.filter(p=>p.alert.level==="order_now"||p.alert.level==="order_soon");

  return (
    <div style={{display:"grid",gap:20,maxWidth:680}}>
      {/* Status banner */}
      <div style={{background:cfg.enabled&&configured?T.okBg:T.warnBg, border:`1px solid ${cfg.enabled&&configured?T.okBd:T.warnBd}`, borderRadius:8, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:cfg.enabled&&configured?T.ok:T.warning}}>
            {cfg.enabled&&configured ? "✓ Notificaciones activas" : configured ? "Notificaciones desactivadas" : "⚠ Pendiente de configuración"}
          </div>
          <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:3}}>
            {cfg.enabled&&configured ? `Enviando alertas a ${cfg.toEmail}` : !configured ? "Completá los datos de EmailJS para activar" : "Activá el switch para empezar a recibir alertas"}
          </p>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{cfg.enabled?"ON":"OFF"}</span>
          <div onClick={()=>set("enabled",!cfg.enabled)}
            style={{width:44,height:24,borderRadius:12,background:cfg.enabled?T.green:T.border,position:"relative",cursor:"pointer",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:cfg.enabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>

      {/* How to setup guide */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}>
          <Cap>Cómo configurar EmailJS (gratis — 200 emails/mes)</Cap>
        </div>
        <div style={{padding:"16px 18px",display:"grid",gap:10}}>
          {[
            {n:1, t:"Creá cuenta gratis", d:<>Entrá a <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{color:T.green,fontWeight:600}}>emailjs.com</a> → Sign Up gratis</>, },
            {n:2, t:"Conectá tu email",   d:"En el panel → Email Services → Add New Service → elegí Gmail, Outlook o el que uses → conectá tu cuenta"},
            {n:3, t:"Creá un template",   d:'En Email Templates → Create New → en el cuerpo del email escribí exactamente: {{{html_content}}} — así el sistema puede enviar el HTML del reporte'},
            {n:4, t:"Copiá las claves",   d:"Service ID (en Email Services), Template ID (en Email Templates), Public Key (en Account → API Keys)"},
            {n:5, t:"Pegá las claves abajo y activá", d:"Completá los 4 campos, activá el switch de arriba, y hacé click en 'Enviar email de prueba'"},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:T.green,color:"#fff",fontFamily:T.sans,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.n}</div>
              <div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{s.t}</div>
                <div style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:2,lineHeight:1.5}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config fields */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Configuración EmailJS</Cap></div>
        <div style={{padding:"16px 18px",display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Service ID" hint="Ej: service_abc123">
              <Inp value={cfg.serviceId} onChange={e=>set("serviceId",e.target.value)} placeholder="service_xxxxxxx"/>
            </Field>
            <Field label="Template ID" hint="Ej: template_abc123">
              <Inp value={cfg.templateId} onChange={e=>set("templateId",e.target.value)} placeholder="template_xxxxxxx"/>
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Public Key" hint="En Account → API Keys">
              <Inp value={cfg.publicKey} onChange={e=>set("publicKey",e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxx"/>
            </Field>
            <Field label="Email de destino" hint="Donde querés recibir las alertas">
              <Inp type="email" value={cfg.toEmail} onChange={e=>set("toEmail",e.target.value)} placeholder="tu@email.com"/>
            </Field>
          </div>
        </div>
      </div>

      {/* Test + manual send */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <Btn onClick={handleTest} full disabled={!configured||testing} variant="ghost">
            {testing ? "Enviando..." : "✉ Enviar email de prueba"}
          </Btn>
          {testResult==="ok" && <p style={{fontFamily:T.sans,fontSize:12,color:T.ok,marginTop:6,textAlign:"center"}}>✓ Email enviado correctamente</p>}
          {testResult==="error" && <p style={{fontFamily:T.sans,fontSize:12,color:T.danger,marginTop:6,textAlign:"center"}}>✗ Error — verificá las claves</p>}
        </div>
        <div>
          <Btn onClick={()=>onManualSend(alertProds)} full disabled={!configured||!alertProds.length}>
            📋 Enviar resumen ahora ({alertProds.length} alertas)
          </Btn>
          {!alertProds.length && <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:6,textAlign:"center"}}>Sin alertas activas ahora mismo</p>}
        </div>
      </div>

      {/* Alert behavior info */}
      <div style={{background:T.cardWarm,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 18px"}}>
        <Cap>Comportamiento de las alertas automáticas</Cap>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {[
            {icon:"🔴", t:"Pedir YA",     d:"Email inmediato cuando el stock cae por debajo del punto de pedido (ROP)"},
            {icon:"🟡", t:"Pedir pronto", d:"Email inmediato cuando quedan ≤5 días para cruzar el ROP"},
            {icon:"🔄", t:"Sin repetición", d:"No manda el mismo email dos veces para el mismo producto — espera hasta que el stock cambie"},
            {icon:"📋", t:"Resumen manual", d:"Podés pedir el resumen de todas las alertas activas en cualquier momento con el botón de arriba"},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
              <div>
                <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.t} — </span>
                <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER TAB — Catálogo Lovable (249 productos)
// ─────────────────────────────────────────────────────────────────────────────
const LOVABLE_CATALOG = [{"id":"p-0001","name":"Chocolate Cobertura Confeiteiro con Leche, Semiamargo y Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":336.07,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0002","name":"Chocolate Cobertura Supreme Amargo 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0003","name":"Chocolate Gotas Supreme con Leche, Semiamargo y Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0004","name":"Chocolate Ganache c/Leche, Semiamargo y Blanco 4 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0005","name":"Chocolate Chips Negro o Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0006","name":"Cacao polvo Namur 500 grs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":659.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0007","name":"Cacao polvo Namur 10 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":459.02,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0008","name":"Chocolate Granizado (mini gotas) semiamargo 8 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0009","name":"Microgalletitas b/chocolate 7 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":680.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0010","name":"Relleno y Cobertura Sabor Chantilly, Vainilla o Frutilla por 4,7 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0011","name":"Relleno y Cobertura Sabor Chantilly Vainilla o Frutilla por 1 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":250.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0012","name":"Relleno y Cobertura Sabor Chantilly Vainilla o Frutilla por 500 g.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":303.28,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0013","name":"Relleno y Cobertura Sabor Chocolate por 4,5 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0014","name":"Relleno y Cobertura Sabor Chocolate  por 1 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":327.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0015","name":"Relleno y Cobertura Sabor Chocolate  por 500 g.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":360.66,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0016","name":"Merengue en polvo por 250 grs. (1 kg. polvo + 400 cc.agua+12 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":385.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0017","name":"Merengue en polvo por 4 kgs. ( 1 kg. polvo + 400 cc.agua+12 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0018","name":"Crema pastelera por 250 grs. (750 cc. agua + 250 gr.polvo + 5 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":418.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0019","name":"Crema pastelera por 4 Kg. (750 cc. agua + 250 gr.polvo + 5 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":319.67,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0020","name":"Mousse Chantilly / Frutilla / Chocolate por 250 grs.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":627.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0021","name":"Mousse Chantilly / Frutilla / Chocolate por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":602.46,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0022","name":"Gel de Brillo Neutro / Frutilla por 310 grs.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":237.7,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0023","name":"Destello Neutro / Frutilla por 4,4 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":159.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0024","name":"Gel de Brillo Neutro en Caliente por 10 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":131.15,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0025","name":"Crema Paris (cubretortas chocolate intenso) por 280 grs.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":401.64,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0026","name":"Crema Paris (baño tipo ganache) por 4 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":327.89,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0027","name":"Mix Cupcake vainilla 500 grs.","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":233.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0028","name":"Mix Brownie 470 grs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":258.2,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0029","name":"Mix Brownie 4 kgs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0030","name":"Mix Budín vainilla 500 grs.","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0031","name":"Mix Macarrones 250 grs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":532.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0032","name":"Mix Macarron 3,5 kgs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":422.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0033","name":"Azúcar impalpable 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":176.23,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0034","name":"Glacé Real 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":213.11,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0035","name":"Fondant 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":196.72,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0036","name":"Pastamix 800 grs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":307.38,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0037","name":"Pastamix 3 kgs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":1020.49,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0038","name":"Pasta Americana Colorful 800 g.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":315.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0039","name":"Rendamix 100 g.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":155.74,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0040","name":"Pasta Americana Mix 4,5 kgs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":1536.89,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0041","name":"Azúcar Colores 80 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0042","name":"Azúcar Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":131.15,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0043","name":"Granas Colores 120 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0044","name":"Granas Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":131.15,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0045","name":"Grageas Colores 100 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":53.27,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0046","name":"Grageas Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":159.84,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0047","name":"Granas Colores 5 kgrs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":163.93,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0048","name":"AROMATIZANTES 30 ml: limón, nuez, chocolate, naranja,","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":61.48,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0049","name":"AROMATIZANTES  1 lt. Vainilla, Vainilla blanca","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":217.21,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0050","name":"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso, Panettone","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0051","name":"AROMATIZANTES  1 lt. Naranja, Limón, Menta","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":360.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0052","name":"Color gel 15 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":65.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0053","name":"Color softgel 25 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":110.66,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0054","name":"Color softgel Big 150 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":352.46,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0055","name":"Color polvo esfumado 3 g.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":139.34,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0056","name":"Color pen 60 g.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":135.25,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0057","name":"Color líquido 10 ml.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0058","name":"Colorante liquido 1 lt.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":155.74,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0059","name":"Acido Cítrico 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0060","name":"Agar Agar 30 g","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":299.18,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0061","name":"CMC (Carbometil Celulosa) 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":110.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0062","name":"Cremor Tártaro por 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0063","name":"Gel Confitero 50 grs","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0064","name":"Glucosa jarabe 150 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":98.36,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0065","name":"Glucosa jarabe 500 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":163.93,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0066","name":"Glucosa jarabe 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0067","name":"Glucosa polvo (dextrosa) 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0068","name":"Emustab (Emulsificante) 200 grs.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":121.32,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0069","name":"Emustab por 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":418.03,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0070","name":"Gelatina neutra por 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":1065.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0071","name":"CHOCOLATE AMARGO DARK 70% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1385.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0072","name":"CHOCOLATE AMARGO DARK 70% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1295.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0073","name":"CHOCOLATE AMARGO BLACK 65% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1229.51,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0074","name":"CHOCOLATE AMARGO BLACK 65% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1200.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0075","name":"CHOCOLATE FLUIDO 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0076","name":"CHOCOLATE FLUIDO 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1192.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0077","name":"CHOCOLATE S/AMARGO 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1118.85,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0078","name":"CHOCOLATE S/AMARGO 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0079","name":"CHOCOLATE C/LECHE CARAMELIZADO 40% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0080","name":"CHOCOLATE C/LECHE BLEND 35% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0081","name":"CHOCOLATE C/LECHE BLEND 35% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0082","name":"CHOCOLATE BLANCO C/MAIZ 33% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0083","name":"CHOCOLATE BLANCO 31% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0084","name":"CHOCOLATE BLANCO 31% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0085","name":"CACAO POLVO 22-24% 2,25 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0086","name":"NIBS CACAO 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":2049.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0087","name":"LICOR CACAO 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":2000.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0088","name":"CHOCOLATE S/AMARGO TRONADOR 55%","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0089","name":"CHOCOLATE C/LECHE TRONADOR","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0090","name":"CHOCOLATE BLANCO","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0091","name":"CHOCOLATE AMARGO 71%","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1135.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0092","name":"Preparado selecta top 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":286.88,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0093","name":"Crema Chocolat 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":442.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0094","name":"Variegato Frutales 2 Kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":565.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0095","name":"Variegato Frutales 12 Kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":528.69,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0096","name":"Variegato Frutales Zero 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":655.74,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0097","name":"Veteado Chocolat 2 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":545.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0098","name":"Veteado Chocolat 12 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":631.15,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0099","name":"Super liga Neutra por 20 kgs. estabilizante en frío ó caliente","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":245.9,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0100","name":"Emustab por 10 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0101","name":"Emustab por 3 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":327.86,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0102","name":"Estabilizante Aqua 5 por 1 kg. en frio","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":549.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0103","name":"Emulsificante y Estabilizante Laqua 10 por 500 grs. en frio","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0104","name":"Base Zero Aqua 1 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":549.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0105","name":"Cobertura Clásicas  1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0106","name":"Cobertura premium 1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":225.41,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0107","name":"Cobertura Clásicas  300 grs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0108","name":"Soft vainilla o chocolate por 1 kg.","brand":"Duas Rodas","category":"Food Service","supplierId":"arg","unitCost":270.49,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0109","name":"Chocolate caliente por 1 kg.","brand":"Duas Rodas","category":"Food Service","supplierId":"arg","unitCost":327.87,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0110","name":"Desmoldante Aerosol Lisse 600 ml","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":368.85,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0111","name":"Mejorador Enzipan 250","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":73.77,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0112","name":"Mix Pao de queijo por 1 kg.","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":172.13,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0113","name":"Caramelo Liquido 7 kg","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":139.34,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0114","name":"Lactofil Premium 1 L","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":250.0,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0115","name":"Aceite Doratta 15,8 L (14, kgs)","brand":"Agropalma","category":"Aceites y Grasas","supplierId":"arg","unitCost":2250.0,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0116","name":"Grasa Palma 20 kgs","brand":"Agropalma","category":"Aceites y Grasas","supplierId":"arg","unitCost":122.73,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0117","name":"Anana 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0118","name":"Banana  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0119","name":"Frambuesa 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0120","name":"Frutilla  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":918.03,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0121","name":"Mango  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0122","name":"Maracuyá 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0123","name":"Limón 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0124","name":"Azurro Cielo 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":799.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0125","name":"Bubbly 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0126","name":"Biscottino 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":995.9,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0127","name":"Biancocioc 6 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0128","name":"Cherry 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0129","name":"Cocco 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1032.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0130","name":"Caffe por 1 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0131","name":"Chantilly (pasta per cookies black) 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1086.07,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0132","name":"Cheese Cake en polvo 1 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1295.083,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0133","name":"Limoncello en polvo con estabilizante 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0134","name":"Mascarpone en polvo 2 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1500.0,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0135","name":"Yoghin yogurth en polvo 1 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1196.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0136","name":"Limone 50 en polvo con estabilizante 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1155.74,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0137","name":"Menta 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":952.82,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0138","name":"Mister Nico Pasta mani 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1180.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0139","name":"Pistacho California 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":4147.54,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0140","name":"Pistacho Pesto c/trozos 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":3581.97,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0141","name":"Nocciola Prima Fine (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2151.64,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0142","name":"Nocciola Selection (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0143","name":"Nocciola Oscura (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1627.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0144","name":"Nocciola Máxima (kinder) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2340.16,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0145","name":"Sinfonía Italiana KIT 12,7 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0146","name":"Tiramisu 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1040.98,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0147","name":"Vainilla French 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1159.84,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0148","name":"Zabaione 5,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0149","name":"Cookie Black Oreo 6 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0150","name":"Cookie Lemon 6 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0151","name":"Fiordibosco 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0152","name":"Mamá que buena kinder 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":967.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0153","name":"Mecralph 5,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1254.1,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0154","name":"Mecrock 6 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0155","name":"Mecrock Plus 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1176.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0156","name":"Mister Nico Snickers 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":877.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0157","name":"Quello Caramelo 6 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0158","name":"Wafer 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1073.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0159","name":"Base Soave 2 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":831.97,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0160","name":"Base Elena 1,8 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":840.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0161","name":"Supergelmix 3 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":938.52,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0162","name":"Cioki 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":655.74,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0163","name":"Cremfix 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":643.44,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0164","name":"Cacao polvo 20-22","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0165","name":"Stracciatella","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":606.56,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0166","name":"Gianduia 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0167","name":"Torrone Rustico 4,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0168","name":"Frollino 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0169","name":"Amore Nocciola 5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":950.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0170","name":"Arancio Variegato 3,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":778.68,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0171","name":"Pistacho al Gusto 4 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1729.51,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0172","name":"Pistacho Natura 2,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":3950.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0173","name":"Pistacho Maestro 2,5","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":2983.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0174","name":"Morettina Clásica 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0175","name":"Morettina Blanca 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0176","name":"Morettina Pepita Clásica 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0177","name":"Morettina Pepita Blanca ,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0178","name":"Morettina Pistacho 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1721.31,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0179","name":"Morettina Pastelera Clásica 12 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":614.75,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0180","name":"Morettina Pastelera Pistacho 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":942.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0181","name":"Cacao polvo Namur 10 Kgs.","brand":"Duas Rodas","category":"Chocolates","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0182","name":"Pasta Saborizante 2 kg.","brand":"Duas Rodas","category":"Pastas Saborizantes","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0183","name":"Dia & Light Vaniglia 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1159.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0184","name":"Dia & Light Fiordilatte 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1180.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0185","name":"Dia & Light Fuit 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1098.36,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0186","name":"Dia & Light Cioccolatto 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1295.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0187","name":"Chocolate Amargo Dark 70% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0188","name":"Chocolate Amargo Dark 70%  70% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0189","name":"Chocolate Amargo Black 65% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0190","name":"Chocolate s/Amargo 56% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":762.29,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0191","name":"Chocolate s/Amargo 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":688.52,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0192","name":"Chocolate s/Amargo 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":663.3,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0193","name":"Chocolate Fluido 56% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0194","name":"Chocolate Fluido 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":717.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0195","name":"Chocolate Fluido 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0196","name":"Chocolate c/Leche Caramelizado 40% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0197","name":"Chocolate c/Leche 35% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":872.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0198","name":"Chocolate c/Leche 35% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0199","name":"Chocolate c/Leche 35% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":786.89,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0200","name":"Chocolate Blanco c/Maiz 33% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0201","name":"Chocolate Blanco 31% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":946.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0202","name":"Chocolate Blanco 31% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0203","name":"Chocolate Blanco 31% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":786.9,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0204","name":"Cacao Polvo 22-24% 2,25 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0205","name":"Nibs Cacao 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0206","name":"Palitos Clásico enfajados 114x10x2mm por 10.000 (200x50 pcs)","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":2700.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0207","name":"Palitos Hélice enfajados 200x50 pcs 94x17-11x2 por 5.000 (100x50 pcs)","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":2573.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0208","name":"Palitos Redondo 160 x 6 mm  por 5.000","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":3565.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0209","name":"Mix Cupcake vainilla 500 grs. (6 kgs)","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":233.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0210","name":"Mix Budín vainilla 500 grs. (6 kgs)","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0211","name":"Cobertura Premium 1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":225.41,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0212","name":"Mousse Chantilly / Frutilla por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":573.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0213","name":"Mousse Chocolate por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":598.36,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0214","name":"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso,Banana,Panettone","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0215","name":"AROMATIZANTES  1 lt. Naranja, Limón, Menta , Banana","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":360.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"}];

const IMP_BRAND_COLORS = {"Adimix":"#e8735a","Agropalma":"#7ab648","Duas Rodas / Mix":"#f4a700","Ledevit":"#5b9bd5","MEC3":"#c0392b","Norohy":"#8e44ad","Pernigotti":"#2c3e50","República del Cacao":"#6d4c41","SOSA":"#16a085","Selecta":"#e67e22","Tronador":"#2980b9"};
const IMP_SUP_LABEL = {"arg":"🇦🇷 Argentina / Brasil","ecu":"🇪🇨 Ecuador","eur":"🇪🇺 Europa"};
const IMP_SUP_COLOR = {"arg":"#2980b9","ecu":"#27ae60","eur":"#8e44ad"};


// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return {hasError:true,error};}
  componentDidCatch(error,info){console.error('[Stock] ErrorBoundary caught:',error,info);}
  render(){
    if(this.state.hasError){
      return React.createElement('div',{style:{padding:'24px',fontFamily:'Inter,sans-serif',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,margin:16}},
        React.createElement('p',{style:{color:'#dc2626',fontWeight:600,marginBottom:8}},'Error al cargar este módulo'),
        React.createElement('p',{style:{color:'#7a7368',fontSize:12,marginBottom:12}},String(this.state.error?.message||'Error desconocido')),
        React.createElement('button',{onClick:()=>this.setState({hasError:false,error:null}),style:{background:'#dc2626',color:'#fff',border:'none',padding:'8px 16px',borderRadius:4,cursor:'pointer',fontSize:12,fontWeight:600}},'Reintentar')
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function UserMenuDropdown({session, userMenuOpen, setUserMenuOpen, canTab, setTab, handleLogout, T}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const initials = (session?.name || session?.email || 'U')[0].toUpperCase();
  const displayName = session?.name || session?.email?.split('@')[0] || 'Usuario';
  const roleLabel = session?.role === 'admin' ? 'Administrador' : session?.role === 'operador' ? 'Operador' : 'Vendedor';

  return React.createElement('div', {ref, style:{position:'relative'}},
    // Pill button
    React.createElement('div', {
      style:{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'6px 12px 6px 8px',borderRadius:8,
        border:`1px solid ${userMenuOpen ? T.greenBd : T.border}`,
        background: userMenuOpen ? T.greenBg : T.card, transition:'background .15s'},
      onMouseEnter: e => { if(!userMenuOpen) e.currentTarget.style.background = T.muted; },
      onMouseLeave: e => { if(!userMenuOpen) e.currentTarget.style.background = userMenuOpen ? T.greenBg : T.card; },
      onClick: () => setUserMenuOpen(m => !m)
    },
      React.createElement('div', {style:{width:30,height:30,borderRadius:'50%',background:T.greenBg,border:`2px solid ${T.greenBd}`,
        display:'flex',alignItems:'center',justifyContent:'center',fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.green,flexShrink:0}}, initials),
      React.createElement('div', null,
        React.createElement('div', {style:{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text,lineHeight:1.2}}, displayName),
        React.createElement('div', {style:{fontFamily:T.sans,fontSize:10,color:T.textXs,textTransform:'capitalize'}}, roleLabel)
      ),
      React.createElement('span', {style:{fontSize:10,color:T.textXs,marginLeft:2}}, userMenuOpen ? '▲' : '▾')
    ),
    // Dropdown
    userMenuOpen && React.createElement('div', {
      style:{position:'absolute',top:'calc(100% + 6px)',right:0,background:T.card,border:`1px solid ${T.border}`,
        borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,.1)',minWidth:200,zIndex:200,overflow:'hidden'}
    },
      React.createElement('div', {style:{padding:'12px 16px 10px',borderBottom:`1px solid ${T.border}`}},
        React.createElement('div', {style:{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}, displayName),
        React.createElement('div', {style:{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:2}}, session?.email || '')
      ),
      canTab('config') && React.createElement('button', {
        onClick: () => { setTab('config'); setUserMenuOpen(false); },
        style:{width:'100%',textAlign:'left',padding:'10px 16px',background:'none',border:'none',
          fontFamily:T.sans,fontSize:13,color:T.textMd,cursor:'pointer',display:'flex',alignItems:'center',gap:8}
      }, '⚙  Configuración'),
      React.createElement('div', {style:{borderTop:`1px solid ${T.border}`,margin:'4px 0'}}),
      React.createElement('button', {
        onClick: () => { setUserMenuOpen(false); handleLogout(); },
        style:{width:'100%',textAlign:'left',padding:'10px 16px',background:'none',border:'none',
          fontFamily:T.sans,fontSize:13,color:'#dc2626',cursor:'pointer',display:'flex',alignItems:'center',gap:8,marginBottom:4}
      }, '↩  Cerrar sesión')
    )
  );
}


// ─── Command Palette (⌘K) ─────────────────────────────────────────────────

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
          <QuickStats critN={critN} orders={orders} />
          <NotificationBell critN={critN} orders={orders} setTab={setTab} />
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
        {React.createElement(CommandPalette,{
          open:cmdOpen,
          onClose:()=>setCmdOpen(false),
          products:enriched||[],
          clientes:LS.get('aryes-clients',[]),
          cfes:LS.get('aryes-cfe',[]),
          setTab,
          onNewCFE:()=>{setTab('facturacion');setCmdOpen(false);}
        })}
        {/* ══ SMART TOASTS ══ */}
        <SmartToasts critN={critN} orders={orders} />
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
