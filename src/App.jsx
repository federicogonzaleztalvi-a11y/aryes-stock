import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
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
.au{animation:fadeUp .25s ease both;}
.pdot{animation:pulseDot 1.8s ease infinite;}
`;

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const SUPA_URL="https://mrotnqybqvmvlexncvno.supabase.co";
const SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI";
const _supaSync=async(key,value)=>{try{await fetch(SUPA_URL+"/rest/v1/aryes_data",{method:"POST",headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates"},body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});}catch(e){}};
const _supaLoad=async(key,def)=>{try{const r=await fetch(SUPA_URL+"/rest/v1/aryes_data?key=eq."+encodeURIComponent(key),{headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});const d=await r.json();if(d&&d[0]&&d[0].value!==undefined){localStorage.setItem(key,JSON.stringify(d[0].value));return d[0].value;}}catch(e){}return def;};
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d;}catch{return d;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));_supaSync(k,v);}catch{}},load:_supaLoad};
const SURL='https://mrotnqybqvmvlexncvno.supabase.co';
const SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI';
const SH={apikey:SKEY,'Authorization':'Bearer '+SKEY,'Content-Type':'application/json','Prefer':'return=representation'};
const db={
  async get(t,q=''){const r=await fetch(SURL+'/rest/v1/'+t+'?'+q,{headers:SH});return r.ok?r.json():[];},
  async upsert(t,data){const r=await fetch(SURL+'/rest/v1/'+t,{method:'POST',headers:{...SH,'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(data)});return r.ok?r.json():null;},
  async patch(t,data,match){const q=Object.entries(match).map(([k,v])=>k+'=eq.'+v).join('&');const r=await fetch(SURL+'/rest/v1/'+t+'?'+q,{method:'PATCH',headers:SH,body:JSON.stringify(data)});return r.ok?r.json():null;},
  async del(t,match){const q=Object.entries(match).map(([k,v])=>k+'=eq.'+v).join('&');await fetch(SURL+'/rest/v1/'+t+'?'+q,{method:'DELETE',headers:SH});}
};

const USERS=[
  {username:"admin",    password:"aryes2024", role:"admin",    name:"Administrador"},
  {username:"operador", password:"stock123",  role:"operador", name:"Operador"},
  {username:"vendedor", password:"ventas123", role:"vendedor", name:"Vendedor"},
];


// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — Aryes palette
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

  // Brand — Aryes green (bright leaf green from logo)
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
// ARYES LOGO SVG (hoja verde + wordmark, fiel al original)
// ─────────────────────────────────────────────────────────────────────────────
const ARYES_LOGO_B64 = "/aryes-logo.png";

const AryesLogo = ({ height = 72 }) => (
  <img src={ARYES_LOGO_B64} height={height} alt="Aryes" style={{display:"block"}}/>
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
   company:"Distribuidora del Sur S.A.",contact:"Martín Rodríguez",email:"martin@distrsur.com.ar",phone:"+54 11 4523-7890",whatsapp:"+54 9 11 4523-7890",
   country:"Argentina",city:"Buenos Aires",currency:"USD",paymentTerms:"30",paymentMethod:"Transferencia bancaria",
   minOrder:"500",discount:"5",rating:5,active:true,
   notes:"Proveedor principal. Envíos martes y jueves. Pedido mínimo USD 500. Descuento 5% por volumen >USD 2000."},
  {id:"ecu",name:"Ecuador",flag:"EC",color:"#15803d",times:{preparation:3,customs:4,freight:8,warehouse:2},
   company:"Tropical Ingredients Cia. Ltda.",contact:"Andrea Vásquez",email:"avasquez@tropicalingr.ec",phone:"+593 2 234-5678",whatsapp:"+593 99 234-5678",
   country:"Ecuador",city:"Guayaquil",currency:"USD",paymentTerms:"50",paymentMethod:"Carta de crédito",
   minOrder:"800",discount:"0",rating:4,active:true,
   notes:"Cacao y derivados. Temporada alta oct–dic coincide con cosecha. Precios suben ~15% en enero."},
  {id:"eur",name:"Europa",flag:"EU",color:"#6d28d9",times:{preparation:5,customs:10,freight:25,warehouse:3},
   company:"Europastry Ingredients GmbH",contact:"Klaus Bauer",email:"k.bauer@europastry.de",phone:"+49 89 1234-5678",whatsapp:"",
   country:"Alemania",city:"Múnich",currency:"EUR",paymentTerms:"60",paymentMethod:"Swift / Wire transfer",
   minOrder:"2000",discount:"8",rating:5,active:true,
   notes:"Vainilla, especias y mejoradores premium. Lead time muy largo — planificar con 2 meses de anticipación. Descuento 8% en pedidos >EUR 5000."},
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
  const [waTpl,setWaTpl]=useState(()=>localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos! - Aryes');
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
    id: Date.now().toString(), name:"", flag:"", color:"#1d4ed8",
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
            const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,﻿"+encodeURIComponent(csv);a.download=`aryes-movimientos-${new Date().toISOString().slice(0,10)}.csv`;a.click();
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
          template_params: { to_email: cfg.toEmail, subject:"✓ Aryes — Email de prueba funcionando", html_content:"<p style='font-family:sans-serif;padding:20px;'>✅ Las notificaciones de Aryes están configuradas correctamente. Recibirás alertas automáticas cuando el stock cruce el punto de pedido.</p>", alert_count:0 }
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
            {n:3, t:"Creá un template",   d:'En Email Templates → Create New → en el cuerpo del email escribí exactamente: {{{html_content}}} — así Aryes puede enviar el HTML del reporte'},
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

function ImporterTab({onDone}){
  const [step,setStep]=useState("select");
  const [sel,setSel]=useState(()=>Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));
  const [fb,setFb]=useState("all");
  const [fs,setFs]=useState("all");
  const [search,setSearch]=useState("");
  const [progress,setProgress]=useState(0);
  const [result,setResult]=useState(null);
  const existingCount=LS.get("aryes6-products",[]).length;

  const brands=["all",...Object.keys(IMP_BRAND_COLORS)];
  const suppliers=["all","arg","ecu","eur"];

  const filtered=LOVABLE_CATALOG.filter(p=>{
    const mb=fb==="all"||p.brand===fb;
    const ms=fs==="all"||p.supplierId===fs;
    const mq=!search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mb&&ms&&mq;
  });

  const toggleSel=(id)=>setSel(prev=>({...prev,[id]:!prev[id]}));
  const selAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=true;});setSel(s);};
  const deselAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=false;});setSel(s);};
  const selAllCatalog=()=>setSel(Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));

  const selCount=Object.values(sel).filter(Boolean).length;
  const selProducts=LOVABLE_CATALOG.filter(p=>sel[p.id]);

  const doImport=async()=>{
    setStep("importing");
    const out=[];
    for(let i=0;i<selProducts.length;i++){
      setProgress(Math.round(((i+1)/selProducts.length)*100));
      await new Promise(r=>setTimeout(r,6));
      const p=selProducts[i];
      out.push({id:p.id,name:p.name,description:p.description,unitCost:p.unitCost,unit:p.unit,stock:p.stock,minStock:p.minStock||Math.max(5,Math.floor(p.stock/4)),supplierId:p.supplierId,brand:p.brand,category:p.category,dailyUsage:p.dailyUsage||0.5,createdAt:new Date().toISOString(),source:"lovable"});
    }
    LS.set("aryes6-products",out);
    setResult({total:out.length});
    setStep("done");
  };

  const pill=(active)=>({background:active?T.green:"#f0ece4",color:active?"#fff":T.textSm,border:"none",borderRadius:20,padding:"5px 13px",fontSize:12,cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap"});
  const byBrand=selProducts.reduce((a,p)=>{(a[p.brand]=a[p.brand]||[]).push(p);return a;},{});
  const bySup=selProducts.reduce((a,p)=>{a[p.supplierId]=(a[p.supplierId]||0)+1;return a;},{});

  if(step==="done")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:48,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:52,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.green,marginBottom:8}}>Inventario cargado</h2>
        <p style={{color:T.textSm,marginBottom:32}}>Los productos demo fueron eliminados y reemplazados por el catálogo real de Aryes</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:32}}>
          {[{n:result.total,l:"productos cargados",c:T.green},{n:11,l:"marcas",c:"#e67e22"},{n:3,l:"proveedores",c:"#8e44ad"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,borderRadius:10,padding:"16px 24px",textAlign:"center",minWidth:120}}>
              <div style={{fontSize:32,fontWeight:700,color:s.c}}>{s.n}</div>
              <div style={{color:T.textSm,fontSize:13}}>{s.l}</div>
            </div>
          ))}
        </div>
        <Btn onClick={onDone}>Ir al inventario →</Btn>
      </div>
    </div>
  );

  if(step==="importing")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:64,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:44,marginBottom:20}}>⏳</div>
        <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginBottom:6}}>Cargando inventario...</h2>
        <p style={{color:T.textSm,marginBottom:28,fontSize:14}}>{progress}% — {Math.round(selProducts.length*progress/100)} de {selProducts.length} productos</p>
        <div style={{background:T.muted,borderRadius:20,height:8,maxWidth:360,margin:"0 auto"}}>
          <div style={{background:T.green,borderRadius:20,height:8,width:`${progress}%`,transition:"width .15s"}}/>
        </div>
      </div>
    </div>
  );

  if(step==="preview")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
        <div style={{display:"flex",gap:10}}><Btn secondary onClick={()=>setStep("select")}>← Volver</Btn><Btn onClick={doImport}>✓ Cargar {selProducts.length} productos</Btn></div>
      </div>
      <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"16px 20px"}}>
        <div style={{fontWeight:600,color:"#b45309",marginBottom:6}}>⚠ Se borrarán los productos demo</div>
        <div style={{fontSize:13,color:"#78350f"}}>El sistema tiene <strong>{existingCount}</strong> producto{existingCount!==1?"s":""} actualmente. Al confirmar, <strong>se eliminarán todos</strong> y se cargarán los {selProducts.length} productos seleccionados.</div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
          <div style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
            <div style={{fontSize:28,fontWeight:700,color:T.green}}>{selProducts.length}</div>
            <div style={{fontSize:12,color:T.textSm}}>a cargar</div>
          </div>
          {Object.entries(bySup).map(([s,c])=>(
            <div key={s} style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
              <div style={{fontSize:22,fontWeight:700,color:IMP_SUP_COLOR[s]}}>{c}</div>
              <div style={{fontSize:12,color:T.textSm}}>{IMP_SUP_LABEL[s]}</div>
            </div>
          ))}
        </div>
        <Cap style={{marginBottom:10}}>Desglose por marca</Cap>
        <div style={{maxHeight:320,overflow:"auto"}}>
          {Object.entries(byBrand).sort((a,b)=>b[1].length-a[1].length).map(([brand,prods])=>(
            <div key={brand} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:IMP_BRAND_COLORS[brand]||"#ccc",flexShrink:0}}/>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{brand}</span>
              <span style={{background:(IMP_BRAND_COLORS[brand]||"#888")+"18",color:IMP_BRAND_COLORS[brand]||"#888",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>{prods.length} productos</span>
              <span style={{fontSize:12,color:IMP_SUP_COLOR[prods[0].supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prods[0].supplierId]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const visByBrand={};
  filtered.forEach(p=>{visByBrand[p.brand]=(visByBrand[p.brand]||0)+1;});

  return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar catálogo</h1></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {existingCount>0&&<span style={{fontSize:12,background:"#fff8e1",color:"#b45309",borderRadius:6,padding:"4px 10px"}}>⚠ {existingCount} productos actuales serán reemplazados</span>}
          <span style={{color:T.textSm,fontSize:13,fontWeight:600}}>{selCount} seleccionados</span>
          <Btn disabled={selCount===0} onClick={()=>setStep("preview")} style={{opacity:selCount===0?.4:1}}>Continuar →</Btn>
        </div>
      </div>
      <div style={{background:"#f0f7ed",borderRadius:10,padding:"14px 18px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",border:"1px solid #c8e0b8"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.green}}>Selección rápida:</span>
        <Btn onClick={selAllCatalog}>★ Todos los 249 productos</Btn>
        <Btn secondary onClick={selAll}>✓ Visibles ({filtered.length})</Btn>
        <Btn secondary onClick={deselAll}>✕ Deseleccionar visibles</Btn>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <input placeholder="🔍 Buscar por nombre, marca o categoría..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 14px",fontSize:13,background:T.cardWarm,width:"100%",marginBottom:12}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Marca:</span>
          {brands.map(b=>(
            <button key={b} onClick={()=>setFb(b)} style={pill(fb===b)}>
              {b==="all"?"Todas":b}{b!=="all"&&visByBrand[b]?` (${visByBrand[b]})`:""}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Proveedor:</span>
          {suppliers.map(s=>(
            <button key={s} onClick={()=>setFs(s)} style={pill(fs===s)}>
              {s==="all"?"Todos":IMP_SUP_LABEL[s]}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm}}>{filtered.length} productos · {selCount} seleccionados</span>
        </div>
        <div style={{maxHeight:480,overflow:"auto",display:"grid",gap:4}}>
          {filtered.map(prod=>{
            const isSel=!!sel[prod.id];
            return(
              <div key={prod.id} onClick={()=>toggleSel(prod.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",borderRadius:8,background:isSel?"#f0f7ed":T.cardWarm,border:`1px solid ${isSel?T.green+"40":"transparent"}`,cursor:"pointer",transition:"all .12s"}}>
                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{width:15,height:15,accentColor:T.green,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13,color:T.text}}>{prod.name}</span>
                    <span style={{background:(IMP_BRAND_COLORS[prod.brand]||"#888")+"18",color:IMP_BRAND_COLORS[prod.brand]||"#888",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{prod.brand}</span>
                    <span style={{fontSize:11,color:T.textXs}}>{prod.category}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{prod.unitCost>0?`$${prod.unitCost.toFixed(0)} / ${prod.unit}`:"—"}</div>
              {p.salePrice>0&&<span style={{fontSize:11,color:'#16a34a',marginLeft:8}}>Venta: $${p.salePrice.toFixed(2)} · <strong>${p.unitCost>0?Math.round((p.salePrice-p.unitCost)/p.salePrice*100):0}% margen</strong></span>}
                  <div style={{fontSize:11,color:IMP_SUP_COLOR[prod.supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prod.supplierId]}</div>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:T.textXs}}>Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}


const LoginScreen=({onLogin})=>{
  const [user,setUser]=useState('');
  const [pass,setPass]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const go=()=>{
    if(!user||!pass) return;
    setLoading(true);setErr('');
    setTimeout(()=>{
      const users=LS.get('aryes-users',USERS);
      const found=users.find(u=>u.username===user.trim()&&u.password===pass);
      if(found){onLogin(found);}else{setErr('Usuario o contraseña incorrectos');setLoading(false);}
    },350);
  };
  return(
    <div style={{minHeight:'100vh',background:'#f9f9f7',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:16,padding:'44px 40px',width:340,boxShadow:'0 4px 24px rgba(0,0,0,.07)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <img src={ARYES_LOGO_B64} height={44} alt="Aryes" style={{display:'block',margin:'0 auto 14px'}}/>
          <div style={{fontSize:11,letterSpacing:'.12em',color:'#6a6a68',fontWeight:600,textTransform:'uppercase'}}>Gestión de Stock · UY</div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,letterSpacing:'.08em',textTransform:'uppercase'}}>Usuario</label>
          <input value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder="usuario" autoFocus
            style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,letterSpacing:'.08em',textTransform:'uppercase'}}>Contraseña</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder="••••••••"
            style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        {err&&<div style={{color:'#dc2626',fontSize:12,marginBottom:14,textAlign:'center'}}>{err}</div>}
        <button onClick={go} disabled={loading||!user||!pass}
          style={{width:'100%',padding:'11px',background:(!user||!pass)?'#d0d0cc':'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:(!user||!pass)?'not-allowed':'pointer',fontFamily:'inherit',transition:'background .15s'}}>
          {loading?'Ingresando…':'Ingresar'}
        </button>
      </div>
    </div>
  );
};


const UsersTab=({session})=>{
  const [users,setUsers]=useState(()=>LS.get('aryes-users',USERS));
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({username:'',password:'',name:'',role:'operador'});
  const [msg,setMsg]=useState('');

  const save=()=>{
    if(!form.username||!form.password||!form.name){setMsg('Completá todos los campos');return;}
    let updated;
    if(editing==='new'){
      if(users.find(u=>u.username===form.username)){setMsg('Ese usuario ya existe');return;}
      updated=[...users,{...form}];
    } else {
      updated=users.map(u=>u.username===editing?{...form}:u);
    }
    LS.set('aryes-users',updated); setUsers(updated); setEditing(null); setMsg('Guardado ✓');
    setTimeout(()=>setMsg(''),2000);
  };

  const del=(username)=>{
    if(username===session.username){setMsg('No podés eliminarte a vos mismo');return;}
    if(!confirm(`¿Eliminar usuario "${username}"?`)) return;
    const updated=users.filter(u=>u.username!==username);
    LS.set('aryes-users',updated); setUsers(updated);
  };

  const startEdit=(u)=>{ setForm({...u}); setEditing(u.username); setMsg(''); };
  const startNew=()=>{ setForm({username:'',password:'',name:'',role:'operador'}); setEditing('new'); setMsg(''); };

  const roleLabel=r=>r==='admin'?'Administrador':r==='operador'?'Operador':'Vendedor (solo lectura)';
  const roleColor=r=>r==='admin'?'#3a7d1e':r==='operador'?'#2563eb':'#9a9a98';

  return(
    <div style={{padding:'32px 40px',maxWidth:700}}>
      <div style={{marginBottom:28,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Configuración</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Usuarios</h1>
        </div>
        <button onClick={startNew} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Agregar usuario</button>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {/* User list */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:editing?24:0}}>
        {users.map(u=>(
          <div key={u.username} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
                {u.role==='admin'?'👑':u.role==='operador'?'🔧':'👁'}
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'#1a1a18'}}>{u.name}</div>
                <div style={{fontSize:12,color:'#9a9a98',marginTop:2}}>@{u.username} · <span style={{color:roleColor(u.role),fontWeight:500}}>{roleLabel(u.role)}</span></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>startEdit(u)} style={{padding:'6px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
              {u.username!==session.username&&<button onClick={()=>del(u.username)} style={{padding:'6px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Eliminar</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/New form */}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginTop:16}}>
          <h3 style={{fontSize:16,fontWeight:600,margin:'0 0 18px',color:'#1a1a18'}}>{editing==='new'?'Nuevo usuario':'Editar usuario'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre completo</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre de usuario</label>
              <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} disabled={editing!=='new'}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:editing!=='new'?'#f5f5f3':'#fff'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Contraseña</label>
              <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Rol</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:'#fff'}}>
                <option value="admin">Administrador (acceso total)</option>
                <option value="operador">Operador (stock y pedidos)</option>
                <option value="vendedor">Vendedor (solo lectura)</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{marginTop:24,padding:'14px 16px',background:'#f0f7ec',borderRadius:10,fontSize:12,color:'#5a7a4a'}}>
        <strong>Roles:</strong> Administrador puede hacer todo incluyendo gestionar usuarios · Operador puede actualizar stock y pedidos · Vendedor solo puede consultar
      </div>
    </div>
  );
};


// ── Lotes Tab ────────────────────────────────────────────────────────────
const LotsTab=({products,session})=>{
  const [lots,setLots]=useState(()=>LS.get('aryes-lots',[]));
  const [filter,setFilter]=useState('all');
  const [editing,setEditing]=useState(null);
  const [selProd,setSelProd]=useState('');
  const [form,setForm]=useState({lotNumber:'',quantity:'',expiryDate:'',notes:''});
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';
  const today=new Date(); today.setHours(0,0,0,0);
  const daysTo=d=>Math.floor((new Date(d)-today)/86400000);
  const st=l=>!l.expiryDate?'ok':daysTo(l.expiryDate)<0?'expired':daysTo(l.expiryDate)<=30?'expiring':'ok';
  const stColor=s=>s==='expired'?'#dc2626':s==='expiring'?'#d97706':'#16a34a';
  const stBg=s=>s==='expired'?'#fef2f2':s==='expiring'?'#fffbeb':'#f0fdf4';
  const stLabel=s=>s==='expired'?'VENCIDO':s==='expiring'?'POR VENCER':'OK';
  const expired=lots.filter(l=>st(l)==='expired').length;
  const expiring=lots.filter(l=>st(l)==='expiring').length;
  const filtered=lots.filter(l=>filter==='all'?true:filter==='expiring'?st(l)!=='ok':st(l)==='expired');

  const save=()=>{
    if(!selProd||!form.lotNumber||!form.quantity){setMsg('Completá producto, lote y cantidad');return;}
    const prod=products.find(p=>String(p.id)===String(selProd));
    const lot={id:editing&&editing!=='new'?editing:'lot-'+Date.now(),productId:Number(selProd),productName:prod?.name||'',lotNumber:form.lotNumber,quantity:Number(form.quantity),expiryDate:form.expiryDate||null,entryDate:new Date().toISOString().split('T')[0],notes:form.notes};
    const updated=editing&&editing!=='new'?lots.map(l=>l.id===editing?lot:l):[...lots,lot];
    LS.set('aryes-lots',updated);setLots(updated);setEditing(null);setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');
    setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:860}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Control de calidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Lotes y Vencimientos</h1>
        </div>
        {canEdit&&<button onClick={()=>{setEditing('new');setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');}} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Registrar lote</button>}
      </div>
      {(expired>0||expiring>0)&&<div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {expired>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>🚨</span><div><div style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{expired} lote{expired>1?'s':''} vencido{expired>1?'s':''}</div><div style={{fontSize:11,color:'#9a9a98'}}>Revisar y dar de baja</div></div></div>}
        {expiring>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>⚠</span><div><div style={{fontSize:13,fontWeight:700,color:'#d97706'}}>{expiring} lote{expiring>1?'s':''} por vencer</div><div style={{fontSize:11,color:'#9a9a98'}}>Priorizar salida (FEFO)</div></div></div>}
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['all','Todos',lots.length],['expiring','Por vencer',expired+expiring],['expired','Vencidos',expired]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:'7px 14px',background:filter===v?'#1a1a18':'#f0f0ec',color:filter===v?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{l}{c>0&&' ('+c+')'}</button>
        ))}
      </div>
      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo lote':'Editar lote'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar...</option>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name}</option>)}
              </select>
            </div>
            {[['Nº de lote','lotNumber','text','Ej: LOT-2024-001'],['Cantidad','quantity','number','0'],['Fecha vencimiento','expiryDate','date',''],['Notas','notes','text','Opcional']].map(([label,key,type,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>{label}</label>
                <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}
      {filtered.length===0?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📦</div><div>{lots.length===0?'No hay lotes registrados':'Sin resultados en este filtro'}</div></div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.sort((a,b)=>(!a.expiryDate?1:!b.expiryDate?-1:new Date(a.expiryDate)-new Date(b.expiryDate))).map(l=>{
            const s=st(l),d=l.expiryDate?daysTo(l.expiryDate):null;
            return <div key={l.id} style={{background:'#fff',border:'1px solid '+stColor(s)+'40',borderLeft:'4px solid '+stColor(s),borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{l.productName}</span>
                  <span style={{fontSize:11,background:stBg(s),color:stColor(s),padding:'2px 8px',borderRadius:10,fontWeight:600}}>{stLabel(s)}</span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'#6a6a68',flexWrap:'wrap'}}>
                  <span>Lote: <strong>{l.lotNumber}</strong></span>
                  <span>Cant: <strong>{l.quantity}</strong></span>
                  {l.expiryDate&&<span style={{color:stColor(s)}}>Vence: <strong>{l.expiryDate} ({d<0?Math.abs(d)+' días vencido':d+' días'})</strong></span>}
                  {l.notes&&<span>{l.notes}</span>}
                </div>
              </div>
              {canEdit&&<div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setSelProd(String(l.productId));setForm({lotNumber:l.lotNumber,quantity:String(l.quantity),expiryDate:l.expiryDate||'',notes:l.notes||''});setEditing(l.id);}} style={{padding:'5px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
                <button onClick={()=>{if(!confirm('¿Eliminar?'))return;const u=lots.filter(x=>x.id!==l.id);LS.set('aryes-lots',u);setLots(u);}} style={{padding:'5px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
              </div>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

// ── Excel Importer Tab ───────────────────────────────────────────────────
const ExcelImportTab=({products,setProducts,session})=>{
  const [step,setStep]=useState('upload'); // upload | preview | done
  const [rows,setRows]=useState([]);
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);

  const parseCSV=(text)=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
    return lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/['"]/g,''));
      const obj={};
      headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return obj;
    }).filter(r=>r.nombre||r.name||r.producto);
  };

  const mapRow=(r)=>({
    name: r.nombre||r.name||r.producto||'',
    brand: r.marca||r.brand||'',
    category: r.categoria||r.category||'',
    supplierId: (r.proveedor||r.supplier||'arg').toLowerCase().includes('ecu')?'ecu':(r.proveedor||r.supplier||'').toLowerCase().includes('eur')?'eur':'arg',
    unit: r.unidad||r.unit||'kg',
    stock: Number(r.stock||r.cantidad||0)||0,
    unitCost: Number((r.costo||r.precio_costo||r.price||r['precio costo']||'0').replace(/[^\d.]/g,''))||0,
    barcode: r.barcode||r.codigo||r['código']||'',
    minStock: Number(r.min_stock||r.stock_minimo||5)||5,
    dailyUsage: Number(r.uso_diario||r.daily_usage||0.5)||0.5,
  });

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);
    const text=await file.text();
    const parsed=parseCSV(text).map(mapRow).filter(r=>r.name);
    setRows(parsed);
    setStep(parsed.length>0?'preview':'upload');
    if(parsed.length===0) setMsg('No se encontraron productos. Verificá que el archivo sea CSV con columnas: nombre, marca, categoria, stock, costo');
    setLoading(false);
  };

  const applyImport=()=>{
    const maxId=products.reduce((m,p)=>Math.max(m,p.id),0);
    const newProds=rows.map((r,i)=>({...r,id:maxId+i+1,history:[]}));
    const updated=[...products,...newProds];
    LS.set('aryes6-products',updated);
    setProducts(updated);
    // Sync to Supabase
    const dbRows=newProds.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplier_id:p.supplierId,unit:p.unit,stock:p.stock,unit_cost:p.unitCost,min_stock:p.minStock,daily_usage:p.dailyUsage,category:p.category,brand:p.brand,history:[]}));
    db.upsert('products',dbRows).catch(e=>console.warn('sync:',e));
    setStep('done');
    setMsg(newProds.length+' productos importados correctamente ✓');
  };

  const downloadTemplate=()=>{
    const csv='nombre,marca,categoria,proveedor,unidad,stock,costo,barcode\nChocolate Cobertura Leche 1kg,Selecta,Chocolates,arg,kg,0,336.07,\nPasta Pistacho 1.5kg,MEC3,Gelato,eur,kg,0,1250,';
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='template_aryes.csv';a.click();
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Carga masiva</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Importar Excel / CSV</h1>
      </div>

      {step==='upload'&&(
        <div>
          <div style={{background:'#fff',border:'2px dashed #e2e2de',borderRadius:12,padding:40,textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:12}}>📂</div>
            <div style={{fontSize:15,fontWeight:600,color:'#3a3a38',marginBottom:8}}>Subí tu archivo CSV</div>
            <div style={{fontSize:13,color:'#9a9a98',marginBottom:20}}>Exportá desde Excel como CSV y subilo acá</div>
            <label style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',display:'inline-block'}}>
              Elegir archivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:'none'}}/>
            </label>
            {loading&&<div style={{marginTop:16,color:'#9a9a98',fontSize:13}}>Procesando...</div>}
          </div>
          <div style={{background:'#f0f7ec',borderRadius:10,padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>Columnas aceptadas en el CSV:</div>
            <div style={{fontSize:12,color:'#5a7a4a',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
              <span><strong>nombre</strong> — nombre del producto</span>
              <span><strong>marca</strong> — ej: Selecta, MEC3</span>
              <span><strong>categoria</strong> — ej: Chocolates</span>
              <span><strong>proveedor</strong> — arg / ecu / eur</span>
              <span><strong>unidad</strong> — kg / lt / u</span>
              <span><strong>stock</strong> — cantidad actual</span>
              <span><strong>costo</strong> — precio de costo</span>
              <span><strong>barcode</strong> — código de barras</span>
            </div>
          </div>
          <button onClick={downloadTemplate} style={{padding:'8px 16px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>⬇ Descargar template de ejemplo</button>
          {msg&&<div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',color:'#dc2626',borderRadius:8,fontSize:13}}>{msg}</div>}
        </div>
      )}

      {step==='preview'&&(
        <div>
          <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,color:'#3a7d1e',fontWeight:600}}>✓ {rows.length} productos detectados</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('upload')} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
              <button onClick={applyImport} style={{padding:'7px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Importar {rows.length} productos</button>
            </div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9f9f7'}}>
                {['Nombre','Marca','Categoría','Proveedor','Unidad','Stock','Costo'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6a6a68',fontSize:11,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0,20).map((r,i)=><tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 14px',color:'#1a1a18',fontWeight:500}}>{r.name}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.brand||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.category||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.supplierId}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unit}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.stock}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unitCost}</td>
                </tr>)}
                {rows.length>20&&<tr><td colSpan={7} style={{padding:'9px 14px',color:'#9a9a98',fontSize:12,textAlign:'center'}}>... y {rows.length-20} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step==='done'&&(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:56,marginBottom:16}}>✅</div>
          <div style={{fontSize:22,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>{msg}</div>
          <div style={{fontSize:14,color:'#9a9a98',marginBottom:32}}>Los productos ya están disponibles en el inventario</div>
          <button onClick={()=>{setStep('upload');setRows([]);setMsg('');}} style={{padding:'10px 24px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Importar otro archivo</button>
        </div>
      )}
    </div>
  );
};


// ── Generar PDF de Orden de Compra ───────────────────────────────────────
const generateOrderPDF = (order, suppliers, products) => {
  const sup = suppliers.find(s => s.id === order.supplierId) || {};
  const today = new Date().toLocaleDateString('es-UY');
  const orderNum = 'OC-' + Date.now().toString().slice(-6);

  const rows = (order.items || []).map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    const subtotal = (item.qty * (prod.unitCost || 0)).toFixed(2);
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:10px 12px">${prod.name || item.productName || ''}</td>
      <td style="padding:10px 12px;text-align:center">${item.qty} ${prod.unit || ''}</td>
      <td style="padding:10px 12px;text-align:right">$ ${(prod.unitCost || 0).toFixed(2)}</td>
      <td style="padding:10px 12px;text-align:right">$ ${subtotal}</td>
    </tr>`;
  }).join('');

  const total = (order.items || []).reduce((sum, item) => {
    const prod = products.find(p => p.id === item.productId) || {};
    return sum + item.qty * (prod.unitCost || 0);
  }, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orden de Compra ${orderNum}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a18; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #3a7d1e; padding-bottom: 24px; }
    .logo-area h1 { font-size: 28px; color: #3a7d1e; margin: 0 0 4px; font-weight: 700; }
    .logo-area p { color: #6a6a68; margin: 0; font-size: 13px; }
    .oc-info { text-align: right; }
    .oc-info .num { font-size: 22px; font-weight: 700; color: #1a1a18; }
    .oc-info .date { color: #6a6a68; font-size: 13px; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; color: #9a9a98; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    .sup-box { background: #f9f9f7; border: 1px solid #e2e2de; border-radius: 8px; padding: 16px 20px; }
    .sup-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .sup-detail { font-size: 13px; color: #6a6a68; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead { background: #f9f9f7; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6a6a68; text-transform: uppercase; letter-spacing: .07em; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(2) { text-align: right; }
    .total-row { background: #f0f7ec; }
    .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e2de; display: flex; justify-content: space-between; }
    .sign-box { text-align: center; }
    .sign-line { width: 180px; border-top: 1px solid #3a3a38; margin: 40px auto 8px; }
    .sign-label { font-size: 12px; color: #6a6a68; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-top: 16px; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>ARYES</h1>
      <p>Distribuidora de Insumos Gastronómicos</p>
      <p>Montevideo, Uruguay</p>
    </div>
    <div class="oc-info">
      <div class="num">Orden de Compra</div>
      <div class="num" style="color:#3a7d1e">${orderNum}</div>
      <div class="date">Fecha: ${today}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Proveedor</div>
    <div class="sup-box">
      <div class="sup-name">${sup.name || order.supplierId || ''}</div>
      ${sup.company ? `<div class="sup-detail">${sup.company}</div>` : ''}
      ${sup.contact ? `<div class="sup-detail">Contacto: ${sup.contact}</div>` : ''}
      ${sup.email ? `<div class="sup-detail">Email: ${sup.email}</div>` : ''}
      ${sup.phone ? `<div class="sup-detail">Tel: ${sup.phone}</div>` : ''}
      <div class="sup-detail" style="margin-top:6px">
        Plazo de pago: ${sup.paymentTerms || '30'} días · Moneda: ${sup.currency || 'USD'}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle de productos</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align:center">Cantidad</th>
          <th style="text-align:right">Precio unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" style="text-align:right;padding:14px 12px;font-weight:700">TOTAL ESTIMADO</td>
          <td style="text-align:right;padding:14px 12px;font-weight:700;color:#3a7d1e">$ ${total.toFixed(2)} ${sup.currency || 'USD'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${order.notes ? `<div class="notes">📝 <strong>Notas:</strong> ${order.notes}</div>` : ''}

  <div class="footer">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Solicitado por</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">Autorizado por</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#9a9a98;align-self:flex-end">
      <div>Aryes — Gestión de Stock</div>
      <div>Generado el ${today}</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('',"_blank","noopener,noreferrer");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
};

// ── Dashboard Charts Components ─────────────────────────────────────────
const MiniBar=({value,max,color='#3a7d1e'})=>{
  const pct=max>0?Math.min(100,Math.round(value/max*100)):0;
  return <div style={{width:'100%',height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden'}}>
    <div style={{width:pct+'%',height:'100%',background:color,borderRadius:3,transition:'width .3s'}}/>
  </div>;
};

const DashboardExtra=({products,suppliers,orders})=>{
  // Valor total inventario
  const totalValue = products.reduce((s,p)=>s+(p.stock||0)*(p.unitCost||0),0);
  const totalSaleValue = products.reduce((s,p)=>s+(p.stock||0)*(p.salePrice||p.unitCost||0),0);
  const totalMargin = totalSaleValue - totalValue;

  // Top 10 productos por valor en stock
  const byValue = [...products]
    .filter(p=>p.stock>0&&p.unitCost>0)
    .sort((a,b)=>(b.stock*b.unitCost)-(a.stock*a.unitCost))
    .slice(0,10);
  const maxVal = byValue[0]?(byValue[0].stock*byValue[0].unitCost):1;

  // Rotación por marca
  const byBrand = {};
  products.forEach(p=>{
    if(!p.brand) return;
    if(!byBrand[p.brand]) byBrand[p.brand]={brand:p.brand,count:0,value:0,lowStock:0};
    byBrand[p.brand].count++;
    byBrand[p.brand].value += (p.stock||0)*(p.unitCost||0);
    if((p.stock||0)<(p.minStock||5)) byBrand[p.brand].lowStock++;
  });
  const brands = Object.values(byBrand).sort((a,b)=>b.value-a.value);
  const maxBrandVal = brands[0]?.value||1;

  // Proyección quiebres próximos 30 días
  const today = new Date();
  const breakRisk = products.filter(p=>{
    const daily = p.dailyUsage||0.5;
    const daysLeft = daily>0?(p.stock||0)/daily:999;
    return daysLeft<30 && daysLeft>0;
  }).sort((a,b)=>{
    const da=(a.dailyUsage||.5)>0?(a.stock||0)/(a.dailyUsage||.5):999;
    const db=(b.dailyUsage||.5)>0?(b.stock||0)/(b.dailyUsage||.5):999;
    return da-db;
  }).slice(0,8);

  // Stock por proveedor
  const bySupplier = {};
  products.forEach(p=>{
    const s = p.supplierId||'arg';
    if(!bySupplier[s]) bySupplier[s]={id:s,count:0,value:0};
    bySupplier[s].count++;
    bySupplier[s].value += (p.stock||0)*(p.unitCost||0);
  });

  const supNames = {arg:'Argentina',ecu:'Ecuador',eur:'Europa',other:'Otros'};
  const supColors = {arg:'#2563eb',ecu:'#16a34a',eur:'#7c3aed',other:'#9a9a98'};

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginTop:24}}>

      {/* Valor de inventario */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,gridColumn:'1/-1'}}>
        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          {[
            {label:'Valor en stock (costo)',value:'$ '+totalValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#3a3a38',bg:'#f9f9f7'},
            {label:'Valor en stock (venta)',value:'$ '+totalSaleValue.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#2563eb',bg:'#eff6ff'},
            {label:'Margen potencial',value:'$ '+totalMargin.toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}),color:'#16a34a',bg:'#f0fdf4'},
            {label:'Productos en stock',value:products.filter(p=>p.stock>0).length+' / '+products.length,color:'#3a3a38',bg:'#f9f9f7'},
          ].map(({label,value,color,bg})=>(
            <div key={label} style={{flex:1,minWidth:180,background:bg,borderRadius:10,padding:'16px 20px'}}>
              <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{label}</div>
              <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos por valor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Top 10 por valor en stock</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {byValue.map((p,i)=>{
            const val = p.stock*p.unitCost;
            return <div key={p.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:12,color:'#3a3a38',fontWeight:500,flex:1,marginRight:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i+1}. {p.name}</span>
                <span style={{fontSize:12,color:'#6a6a68',flexShrink:0}}>$ {val.toFixed(0)}</span>
              </div>
              <MiniBar value={val} max={maxVal} color={i<3?'#3a7d1e':'#b8d9a8'}/>
            </div>;
          })}
        </div>
      </div>

      {/* Rotación por marca */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Inventario por marca</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {brands.map(b=>(
            <div key={b.brand}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600}}>{b.brand}</span>
                <div style={{display:'flex',gap:12,fontSize:11,color:'#6a6a68'}}>
                  <span>{b.count} prod.</span>
                  {b.lowStock>0&&<span style={{color:'#dc2626',fontWeight:600}}>⚠ {b.lowStock} bajo mín.</span>}
                  <span style={{fontWeight:600,color:'#3a3a38'}}>$ {b.value.toFixed(0)}</span>
                </div>
              </div>
              <MiniBar value={b.value} max={maxBrandVal}/>
            </div>
          ))}
        </div>
      </div>

      {/* Proyección de quiebres */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Proyección quiebres — próx. 30 días</div>
        {breakRisk.length===0
          ?<div style={{textAlign:'center',padding:'24px 0',color:'#9a9a98',fontSize:13}}>✅ Sin riesgo de quiebre en 30 días</div>
          :<div style={{display:'flex',flexDirection:'column',gap:8}}>
            {breakRisk.map(p=>{
              const daysLeft = (p.dailyUsage||.5)>0?(p.stock||0)/(p.dailyUsage||.5):999;
              const urgency = daysLeft<7?'#dc2626':daysLeft<15?'#d97706':'#2563eb';
              return <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:'#f9f9f7',borderRadius:8,borderLeft:'3px solid '+urgency}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#1a1a18'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'#9a9a98'}}>{p.brand} · stock: {p.stock} {p.unit}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:urgency}}>{Math.ceil(daysLeft)}d</div>
                  <div style={{fontSize:10,color:'#9a9a98'}}>restantes</div>
                </div>
              </div>;
            })}
          </div>
        }
      </div>

      {/* Stock por proveedor */}
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:16}}>Distribución por proveedor</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {Object.values(bySupplier).sort((a,b)=>b.value-a.value).map(s=>{
            const pct = totalValue>0?Math.round(s.value/totalValue*100):0;
            const sup = suppliers.find(x=>x.id===s.id)||{};
            return <div key={s.id}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center'}}>
                <span style={{fontSize:13,color:'#3a3a38',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:supColors[s.id]||'#9a9a98',display:'inline-block'}}/>
                  {sup.name||supNames[s.id]||s.id}
                </span>
                <div style={{fontSize:11,color:'#6a6a68',display:'flex',gap:12}}>
                  <span>{s.count} prod.</span>
                  <span style={{fontWeight:600}}>{pct}%</span>
                </div>
              </div>
              <MiniBar value={s.value} max={totalValue} color={supColors[s.id]||'#9a9a98'}/>
            </div>;
          })}
        </div>
      </div>

    </div>
  );
};



// ── Price History Tab ────────────────────────────────────────────────────
const PriceHistoryTab=({products,session})=>{
  const [priceHistory,setPriceHistory]=useState(()=>LS.get('aryes-price-history',[]));
  const [selProduct,setSelProduct]=useState('');
  const [search,setSearch]=useState('');

  const filtered = selProduct
    ? priceHistory.filter(h=>String(h.productId)===String(selProduct))
    : search
    ? priceHistory.filter(h=>h.productName.toLowerCase().includes(search.toLowerCase()))
    : priceHistory;

  const sorted = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Group by product for summary view
  const byProduct = {};
  priceHistory.forEach(h=>{
    if(!byProduct[h.productId]) byProduct[h.productId]={name:h.productName,entries:[]};
    byProduct[h.productId].entries.push(h);
  });

  const productSummaries = Object.values(byProduct).map(p=>{
    const sorted = [...p.entries].sort((a,b)=>new Date(b.date)-new Date(a.date));
    const latest = sorted[0];
    const prev = sorted[1];
    const change = prev ? ((latest.cost - prev.cost)/prev.cost*100).toFixed(1) : null;
    return {...p, latest, prev, change};
  }).sort((a,b)=>new Date(b.latest.date)-new Date(a.latest.date));

  return(
    <div style={{padding:'32px 40px',maxWidth:900}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Análisis de costos</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Historial de Precios</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Los cambios de costo se registran automáticamente cada vez que editás un producto.</p>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setSelProduct('');}} placeholder="Buscar producto..."
          style={{flex:1,minWidth:200,padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        <select value={selProduct} onChange={e=>{setSelProduct(e.target.value);setSearch('');}}
          style={{padding:'9px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff',minWidth:220}}>
          <option value=''>Todos los productos</option>
          {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selProduct&&!search?(
        // Summary view
        <div>
          <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Últimos cambios de precio</div>
          {productSummaries.length===0
            ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>Los cambios de precio aparecerán acá automáticamente</div></div>
            :<div style={{display:'flex',flexDirection:'column',gap:8}}>
              {productSummaries.slice(0,20).map((p,i)=>{
                const up = p.change!==null&&Number(p.change)>0;
                const down = p.change!==null&&Number(p.change)<0;
                return <div key={i} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#1a1a18',marginBottom:2}}>{p.name}</div>
                    <div style={{fontSize:11,color:'#9a9a98'}}>{p.latest.brand} · {new Date(p.latest.date).toLocaleDateString('es-UY')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>$ {p.latest.cost.toFixed(2)}</div>
                    {p.change!==null&&<div style={{fontSize:11,fontWeight:600,color:up?'#dc2626':down?'#16a34a':'#9a9a98'}}>
                      {up?'↑':'↓'} {Math.abs(p.change)}% {down?'(bajó)':'(subió)'}
                    </div>}
                  </div>
                </div>;
              })}
            </div>
          }
        </div>
      ):(
        // Detail view for specific product
        <div>
          {selProduct&&<div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#3a7d1e',fontWeight:600}}>
            {products.find(p=>String(p.id)===String(selProduct))?.name}
          </div>}
          {sorted.length===0
            ?<div style={{textAlign:'center',padding:'32px',color:'#9a9a98'}}>Sin registros</div>
            :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr style={{background:'#f9f9f7'}}>
                  {['Fecha','Producto','Costo anterior','Costo nuevo','Variación','Registrado por'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {sorted.map((h,i)=>{
                    const change = h.prevCost>0?((h.cost-h.prevCost)/h.prevCost*100).toFixed(1):null;
                    const up = change!==null&&Number(change)>0;
                    return <tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{new Date(h.date).toLocaleDateString('es-UY')}</td>
                      <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a18'}}>{h.productName}</td>
                      <td style={{padding:'10px 14px',color:'#9a9a98'}}>{h.prevCost>0?'$ '+h.prevCost.toFixed(2):'—'}</td>
                      <td style={{padding:'10px 14px',fontWeight:600,color:'#1a1a18'}}>$ {h.cost.toFixed(2)}</td>
                      <td style={{padding:'10px 14px'}}>
                        {change!==null?<span style={{color:up?'#dc2626':'#16a34a',fontWeight:600}}>{up?'↑ +':'↓ '}{change}%</span>:<span style={{color:'#9a9a98'}}>—</span>}
                      </td>
                      <td style={{padding:'10px 14px',color:'#6a6a68'}}>{h.user||'—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}
    </div>
  );
};



// ── Clients Tab ──────────────────────────────────────────────────────────
const ClientsTab=({products,session})=>{
  const [clients,setClients]=useState(()=>LS.get('aryes-clients',[]));
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({name:'',type:'panaderia',contact:'',phone:'',email:'',address:'',notes:'',products:[]});
  const [detail,setDetail]=useState(null);
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';

  const clientTypes={panaderia:'🥖 Panadería',heladeria:'🍦 Heladería',horeca:'🏨 HORECA',otro:'📦 Otro'};

  const save=()=>{
    if(!form.name){setMsg('El nombre es obligatorio');return;}
    const client={...form,id:editing&&editing!=='new'?editing:'cli-'+Date.now()};
    const updated=editing&&editing!=='new'?clients.map(c=>c.id===editing?client:c):[...clients,client];
    LS.set('aryes-clients',updated);setClients(updated);
    db.upsert('clients',[{id:client.id,name:client.name,type:client.type,contact:client.contact,phone:client.phone,email:client.email,address:client.address,notes:client.notes,products:client.products}]).catch(e=>console.warn(e));
    setEditing(null);setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  const del=(id)=>{
    if(!confirm('¿Eliminar cliente?')) return;
    const updated=clients.filter(c=>c.id!==id);
    LS.set('aryes-clients',updated);setClients(updated);
    if(detail?.id===id) setDetail(null);
  };

  const startEdit=(c)=>{setForm({...c,products:c.products||[]});setEditing(c.id);setDetail(null);};
  const startNew=()=>{setForm({name:'',type:'panaderia',contact:'',phone:'',email:'',address:'',notes:'',products:[]});setEditing('new');setDetail(null);};

  const toggleProduct=(prodId)=>{
    const current=form.products||[];
    const updated=current.includes(prodId)?current.filter(x=>x!==prodId):[...current,prodId];
    setForm(f=>({...f,products:updated}));
  };

  if(detail) return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <button onClick={()=>setDetail(null)} style={{background:'none',border:'none',fontSize:13,color:'#3a7d1e',cursor:'pointer',fontFamily:'inherit',marginBottom:20,display:'flex',alignItems:'center',gap:6}}>← Volver a clientes</button>
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:28,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:'#9a9a98',marginBottom:4}}>{clientTypes[detail.type]||detail.type}</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:500,margin:0}}>{detail.name}</h2>
          </div>
          {canEdit&&<div style={{display:'flex',gap:8}}>
            <button onClick={()=>startEdit(detail)} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
            <button onClick={()=>del(detail.id)} style={{padding:'7px 14px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Eliminar</button>
          </div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',fontSize:13}}>
          {detail.contact&&<div><span style={{color:'#9a9a98'}}>Contacto: </span><strong>{detail.contact}</strong></div>}
          {detail.phone&&<div><span style={{color:'#9a9a98'}}>Tel: </span><strong>{detail.phone}</strong></div>}
          {detail.email&&<div><span style={{color:'#9a9a98'}}>Email: </span><strong>{detail.email}</strong></div>}
          {detail.address&&<div><span style={{color:'#9a9a98'}}>Dirección: </span><strong>{detail.address}</strong></div>}
        </div>
        {detail.notes&&<div style={{marginTop:12,padding:'10px 14px',background:'#f9f9f7',borderRadius:8,fontSize:13,color:'#6a6a68'}}>{detail.notes}</div>}
      </div>
      {detail.products?.length>0&&<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
        <div style={{fontSize:12,fontWeight:700,color:'#9a9a98',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:14}}>Productos que compra ({detail.products.length})</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {detail.products.map(pid=>{
            const p=products.find(x=>x.id===pid||String(x.id)===String(pid));
            if(!p) return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f9f9f7"}}><div style={{textAlign:"center",fontFamily:"sans-serif"}}><div style={{fontSize:40,marginBottom:12}}>🌿</div><p style={{color:"#666",fontSize:14}}>Cargando...</p></div></div>);
            return <div key={pid} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'#f9f9f7',borderRadius:8,fontSize:13}}>
              <span style={{color:'#3a3a38',fontWeight:500}}>{p.name}</span>
              <span style={{color:'#9a9a98'}}>{p.brand} · {p.unit}</span>
            </div>;
          })}
        </div>
      </div>}
    </div>
  );

  return(
    <div style={{padding:'32px 40px',maxWidth:900}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Cartera comercial</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Clientes</h1>
        </div>
        {canEdit&&<button onClick={startNew} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Nuevo cliente</button>}
      </div>

      {/* Summary cards */}
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {Object.entries(clientTypes).map(([type,label])=>{
          const count=clients.filter(c=>c.type===type).length;
          return <div key={type} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'12px 18px',minWidth:120,flex:1}}>
            <div style={{fontSize:18,marginBottom:4}}>{label.split(' ')[0]}</div>
            <div style={{fontSize:20,fontWeight:700,color:'#1a1a18'}}>{count}</div>
            <div style={{fontSize:11,color:'#9a9a98'}}>{label.split(' ').slice(1).join(' ')}</div>
          </div>;
        })}
        <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 18px',minWidth:120,flex:1}}>
          <div style={{fontSize:18,marginBottom:4}}>👥</div>
          <div style={{fontSize:20,fontWeight:700,color:'#3a7d1e'}}>{clients.length}</div>
          <div style={{fontSize:11,color:'#9a9a98'}}>Total clientes</div>
        </div>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {/* Edit form */}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo cliente':'Editar cliente'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Nombre *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre del cliente"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Tipo</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                {Object.entries(clientTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Contacto</label>
              <input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} placeholder="Nombre del contacto"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Teléfono / WhatsApp</label>
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+598 99 xxx xxx"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Email</label>
              <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@cliente.com"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Dirección</label>
              <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Dirección"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Notas</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observaciones, frecuencia de pedido, etc."
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:8,textTransform:'uppercase'}}>Productos que compra</label>
              <div style={{maxHeight:200,overflowY:'auto',border:'1px solid #e2e2de',borderRadius:8,padding:8}}>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=>(
                  <label key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',cursor:'pointer',borderRadius:6,fontSize:13,':hover':{background:'#f0f0ec'}}}>
                    <input type="checkbox" checked={(form.products||[]).includes(p.id)||(form.products||[]).includes(String(p.id))}
                      onChange={()=>toggleProduct(p.id)} style={{accentColor:'#3a7d1e'}}/>
                    <span style={{color:'#3a3a38'}}>{p.name}</span>
                    <span style={{color:'#9a9a98',fontSize:11}}>{p.brand}</span>
                  </label>
                ))}
              </div>
              <div style={{fontSize:11,color:'#9a9a98',marginTop:6}}>{(form.products||[]).length} productos seleccionados</div>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Client list */}
      {clients.length===0&&!editing
        ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>👥</div><div>No hay clientes cargados todavía</div>{canEdit&&<div style={{fontSize:13,marginTop:6}}>Agregá tu primer cliente con el botón de arriba</div>}</div>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {clients.map(c=>(
            <div key={c.id} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:20,cursor:'pointer',transition:'box-shadow .15s'}}
              onClick={()=>setDetail(c)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:'#9a9a98',marginBottom:3}}>{clientTypes[c.type]||c.type}</div>
                  <div style={{fontSize:15,fontWeight:700,color:'#1a1a18'}}>{c.name}</div>
                </div>
                {canEdit&&<button onClick={e=>{e.stopPropagation();startEdit(c);}} style={{padding:'4px 10px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>}
              </div>
              {c.contact&&<div style={{fontSize:12,color:'#6a6a68',marginBottom:2}}>👤 {c.contact}</div>}
              {c.phone&&<div style={{fontSize:12,color:'#6a6a68',marginBottom:2}}>📞 {c.phone}</div>}
              {c.products?.length>0&&<div style={{fontSize:11,color:'#3a7d1e',marginTop:8,fontWeight:600}}>{c.products.length} productos asignados</div>}
              {c.notes&&<div style={{fontSize:11,color:'#9a9a98',marginTop:6,borderTop:'1px solid #f0f0ec',paddingTop:6}}>{c.notes.substring(0,80)}{c.notes.length>80?'...':''}</div>}
            </div>
          ))}
        </div>
      }
    </div>
  );
};



// ── Movements Tab ────────────────────────────────────────────────────────
const MovementsTab=({products,setProducts,session})=>{
  const [movements,setMovements]=useState(()=>LS.get('aryes-movements',[]));
  const [form,setForm]=useState({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
  const [filter,setFilter]=useState('all');
  const [search,setSearch]=useState('');
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';

  const reasons={
    entrada:['compra','devolucion_cliente','ajuste_positivo','produccion'],
    salida:['venta','devolucion_proveedor','ajuste_negativo','merma','muestra']
  };
  const reasonLabel={
    compra:'Compra a proveedor',devolucion_cliente:'Devolución de cliente',
    ajuste_positivo:'Ajuste positivo',produccion:'Producción interna',
    venta:'Venta',devolucion_proveedor:'Devolución a proveedor',
    ajuste_negativo:'Ajuste negativo',merma:'Merma / vencimiento',muestra:'Muestra'
  };

  const filtered = movements
    .filter(m => filter==='all' ? true : m.type===filter)
    .filter(m => !search || m.productName.toLowerCase().includes(search.toLowerCase()) || (m.reference||'').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const save=()=>{
    if(!form.productId||!form.qty||Number(form.qty)<=0){setMsg('Completá producto y cantidad');return;}
    const prod=products.find(p=>p.id===Number(form.productId));
    if(!prod){setMsg('Producto no encontrado');return;}
    const qty=Number(form.qty);
    const newStock=form.type==='entrada'?(prod.stock||0)+qty:Math.max(0,(prod.stock||0)-qty);
    const mov={
      id:'mov-'+Date.now(),
      productId:prod.id,productName:prod.name,brand:prod.brand||'',
      type:form.type,qty,
      stockBefore:prod.stock||0,stockAfter:newStock,
      reason:form.reason,reference:form.reference,notes:form.notes,
      user:session.name||session.username||'',
      date:new Date().toISOString()
    };
    // Save movement
    const updatedMovs=[mov,...movements];
    LS.set('aryes-movements',updatedMovs);setMovements(updatedMovs);
    // Update product stock
    const updatedProds=products.map(p=>p.id===prod.id?{...p,stock:newStock}:p);
    LS.set('aryes6-products',updatedProds);setProducts(updatedProds);
    // Sync to Supabase
    db.patch('products',{stock:newStock},{id:prod.id}).catch(e=>console.warn(e));
    // Check low stock alert
    if(newStock<(prod.minStock||5)){
      const alreadySent=LS.get('aryes-alerts-sent',{});
      if(!alreadySent[prod.id]){
        sendLowStockAlert(prod,newStock);
        alreadySent[prod.id]=new Date().toISOString();
        LS.set('aryes-alerts-sent',alreadySent);
      }
    } else {
      // Reset alert flag when stock is restored
      const alreadySent=LS.get('aryes-alerts-sent',{});
      delete alreadySent[prod.id];
      LS.set('aryes-alerts-sent',alreadySent);
    }
    setForm({productId:'',type:'entrada',qty:'',reason:'compra',reference:'',notes:''});
    setMsg((form.type==='entrada'?'✓ Entrada':'✓ Salida')+' registrada — stock actualizado');
    setTimeout(()=>setMsg(''),3000);
  };

  // Stats
  const today=new Date().toISOString().split('T')[0];
  const todayMovs=movements.filter(m=>m.date.startsWith(today));
  const entradas=movements.filter(m=>m.type==='entrada').reduce((s,m)=>s+m.qty,0);
  const salidas=movements.filter(m=>m.type==='salida').reduce((s,m)=>s+m.qty,0);

  return(
    <div style={{padding:'32px 40px',maxWidth:920}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Trazabilidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Movimientos de Stock</h1>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        {[
          {label:'Total movimientos',value:movements.length,color:'#3a3a38',bg:'#f9f9f7'},
          {label:'Entradas acumuladas',value:entradas,color:'#16a34a',bg:'#f0fdf4'},
          {label:'Salidas acumuladas',value:salidas,color:'#dc2626',bg:'#fef2f2'},
          {label:'Movimientos hoy',value:todayMovs.length,color:'#2563eb',bg:'#eff6ff'},
        ].map(({label,value,color,bg})=>(
          <div key={label} style={{flex:1,minWidth:140,background:bg,borderRadius:10,padding:'14px 18px'}}>
            <div style={{fontSize:11,color:'#9a9a98',fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>{label}</div>
            <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13,fontWeight:500}}>{msg}</div>}

      {/* Register movement form */}
      {canEdit&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:'#1a1a18',marginBottom:16}}>Registrar movimiento</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={form.productId} onChange={e=>setForm(f=>({...f,productId:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar producto...</option>
                {[...products].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>(
                  <option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name} (stock: {p.stock||0} {p.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Tipo</label>
              <div style={{display:'flex',gap:8}}>
                {['entrada','salida'].map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,type:t,reason:t==='entrada'?'compra':'venta'}))}
                    style={{flex:1,padding:'9px',border:'2px solid '+(form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#e2e2de'),borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                    background:form.type===t?(t==='entrada'?'#f0fdf4':'#fef2f2'):'#fff',
                    color:form.type===t?(t==='entrada'?'#16a34a':'#dc2626'):'#6a6a68'}}>
                    {t==='entrada'?'↑ Entrada':'↓ Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Cantidad</label>
              <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} placeholder="0" min="0" step="0.01"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Motivo</label>
              <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                {(reasons[form.type]||[]).map(r=><option key={r} value={r}>{reasonLabel[r]}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Referencia (Factura / OC)</label>
              <input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="Ej: FC-001, OC-023"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Notas</label>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Opcional"
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
          </div>
          {form.productId&&form.qty&&(
            <div style={{padding:'10px 14px',background:'#f9f9f7',borderRadius:8,fontSize:13,color:'#6a6a68',marginBottom:12}}>
              Stock actual: <strong>{products.find(p=>p.id===Number(form.productId))?.stock||0}</strong>
              {' → '}
              <strong style={{color:form.type==='entrada'?'#16a34a':'#dc2626'}}>
                {form.type==='entrada'
                  ?(products.find(p=>p.id===Number(form.productId))?.stock||0)+Number(form.qty||0)
                  :Math.max(0,(products.find(p=>p.id===Number(form.productId))?.stock||0)-Number(form.qty||0))
                }
              </strong>
              {' '}{products.find(p=>p.id===Number(form.productId))?.unit||''}
            </div>
          )}
          <button onClick={save} style={{padding:'10px 24px',background:form.type==='entrada'?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {form.type==='entrada'?'↑ Registrar entrada':'↓ Registrar salida'}
          </button>
        </div>
      )}

      {/* Filters + list */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o referencia..."
          style={{flex:1,minWidth:200,padding:'8px 14px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
        {['all','entrada','salida'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'7px 14px',background:filter===f?'#1a1a18':'#f0f0ec',color:filter===f?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            {f==='all'?'Todos':f==='entrada'?'↑ Entradas':'↓ Salidas'}
          </button>
        ))}
        <button onClick={()=>{
          const csv=['Fecha,Producto,Marca,Tipo,Cantidad,Stock Antes,Stock Después,Motivo,Referencia,Usuario',
            ...filtered.map(m=>[new Date(m.date).toLocaleString('es-UY'),m.productName,m.brand,m.type,m.qty,m.stockBefore,m.stockAfter,m.reason,m.reference||'',m.user].join(','))
          ].join('\n');
          const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
          a.download='movimientos_aryes.csv';a.click();
        }} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          ⬇ Exportar CSV
        </button>
      </div>

      {filtered.length===0
        ?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>No hay movimientos registrados todavía</div></div>
        :<div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#f9f9f7'}}>
              {['Fecha','Producto','Tipo','Cantidad','Stock','Motivo','Ref.','Usuario'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:'#6a6a68',textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0,50).map(m=>(
                <tr key={m.id} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 12px',color:'#9a9a98',whiteSpace:'nowrap'}}>{new Date(m.date).toLocaleDateString('es-UY')} {new Date(m.date).toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{padding:'9px 12px'}}><div style={{fontWeight:600,color:'#1a1a18'}}>{m.productName}</div><div style={{fontSize:11,color:'#9a9a98'}}>{m.brand}</div></td>
                  <td style={{padding:'9px 12px'}}><span style={{padding:'3px 8px',borderRadius:10,fontSize:11,fontWeight:600,background:m.type==='entrada'?'#f0fdf4':'#fef2f2',color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'↑ Entrada':'↓ Salida'}</span></td>
                  <td style={{padding:'9px 12px',fontWeight:700,color:m.type==='entrada'?'#16a34a':'#dc2626'}}>{m.type==='entrada'?'+':'-'}{m.qty}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.stockBefore} → <strong>{m.stockAfter}</strong></td>
                  <td style={{padding:'9px 12px',color:'#6a6a68'}}>{reasonLabel[m.reason]||m.reason}</td>
                  <td style={{padding:'9px 12px',color:'#6a6a68',fontSize:12}}>{m.reference||'—'}</td>
                  <td style={{padding:'9px 12px',color:'#9a9a98',fontSize:12}}>{m.user||'—'}</td>
                </tr>
              ))}
              {filtered.length>50&&<tr><td colSpan={8} style={{padding:'10px',textAlign:'center',color:'#9a9a98',fontSize:12}}>Mostrando 50 de {filtered.length} movimientos — exportá CSV para ver todos</td></tr>}
            </tbody>
          </table>
        </div>
      }
    </div>
  );
};


// ── Email Alerts via EmailJS ─────────────────────────────────────────────
const sendLowStockAlert = async (product, currentStock) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: product.name,
          brand: product.brand || '',
          current_stock: currentStock,
          min_stock: product.minStock || 5,
          unit: product.unit || '',
          date: new Date().toLocaleDateString('es-UY'),
        }
      })
    });
  } catch(e) { console.warn('Email alert failed:', e); }
};

const sendDailyAlertSummary = async (lowStockProducts) => {
  const cfg = LS.get('aryes-email-config', {});
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || !cfg.toEmail) return;
  if (lowStockProducts.length === 0) return;
  const productList = lowStockProducts.map(p =>
    p.name + ' (stock: ' + (p.stock||0) + ' ' + (p.unit||'') + ', mín: ' + (p.minStock||5) + ')'
  ).join(', ');
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: {
          to_email: cfg.toEmail,
          product_name: lowStockProducts.length + ' productos bajo stock mínimo',
          brand: 'Resumen diario Aryes',
          current_stock: lowStockProducts.length,
          min_stock: 0,
          unit: 'productos',
          date: new Date().toLocaleDateString('es-UY'),
          extra: productList,
        }
      })
    });
  } catch(e) { console.warn('Daily summary failed:', e); }
};

// ── Email Config Tab ─────────────────────────────────────────────────────
const EmailConfigTab=({products,session})=>{
  const [cfg,setCfg]=useState(()=>LS.get('aryes-email-config',{serviceId:'',templateId:'',publicKey:'',toEmail:''}));
  const [msg,setMsg]=useState('');
  const [testing,setTesting]=useState(false);
  const canEdit=session.role==='admin';

  const save=()=>{
    LS.set('aryes-email-config',cfg);
    setMsg('Configuración guardada ✓');
    setTimeout(()=>setMsg(''),2500);
  };

  const test=async()=>{
    if(!cfg.serviceId||!cfg.templateId||!cfg.publicKey||!cfg.toEmail){setMsg('Completá todos los campos primero');return;}
    setTesting(true);
    const testProd={name:'Chocolate Cobertura Leche 1kg (TEST)',brand:'Selecta',stock:2,minStock:10,unit:'kg'};
    await sendLowStockAlert(testProd,2);
    setTesting(false);
    setMsg('Email de prueba enviado a '+cfg.toEmail+' ✓');
    setTimeout(()=>setMsg(''),4000);
  };

  const lowCount=products.filter(p=>(p.stock||0)<(p.minStock||5)).length;

  const sendSummary=async()=>{
    const low=products.filter(p=>(p.stock||0)<(p.minStock||5));
    await sendDailyAlertSummary(low);
    setMsg('Resumen enviado con '+low.length+' productos ✓');
    setTimeout(()=>setMsg(''),3000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:680}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Notificaciones</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Alertas por Email</h1>
        <p style={{color:'#9a9a98',fontSize:13,marginTop:8}}>Recibí un email automático cuando el stock cae por debajo del mínimo.</p>
      </div>

      {/* Status summary */}
      <div style={{background:lowCount>0?'#fef2f2':'#f0f7ec',border:'1px solid '+(lowCount>0?'#fecaca':'#b8d9a8'),borderRadius:12,padding:'16px 20px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>{lowCount>0?'🚨':'✅'}</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:lowCount>0?'#dc2626':'#16a34a'}}>
              {lowCount>0?lowCount+' productos bajo stock mínimo':'Todos los productos con stock suficiente'}
            </div>
            <div style={{fontSize:12,color:'#9a9a98'}}>Revisado ahora</div>
          </div>
        </div>
        {lowCount>0&&canEdit&&<button onClick={sendSummary}
          style={{padding:'8px 16px',background:'#dc2626',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
          Enviar resumen ahora
        </button>}
      </div>

      {/* Setup guide */}
      <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'16px 20px',marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:'#3a7d1e',marginBottom:8}}>Cómo configurar (gratis con EmailJS):</div>
        <ol style={{fontSize:12,color:'#5a7a4a',margin:0,paddingLeft:20,lineHeight:1.8}}>
          <li>Entrá a <strong>emailjs.com</strong> y creá una cuenta gratuita</li>
          <li>En "Email Services" conectá tu Gmail o email de Aryes</li>
          <li>En "Email Templates" creá una plantilla — usá estas variables: <code style={{background:'#fff',padding:'1px 4px',borderRadius:3}}>{'{{product_name}} {{current_stock}} {{min_stock}} {{unit}} {{date}}'}</code></li>
          <li>Copiá tu Service ID, Template ID y Public Key abajo</li>
        </ol>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {canEdit?(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {[
              {label:'Email destino',key:'toEmail',ph:'alertas@aryes.com.uy',type:'email'},
              {label:'Service ID (EmailJS)',key:'serviceId',ph:'service_xxxxxxx',type:'text'},
              {label:'Template ID (EmailJS)',key:'templateId',ph:'template_xxxxxxx',type:'text'},
              {label:'Public Key (EmailJS)',key:'publicKey',ph:'xxxxxxxxxxxxxxxxxxxxxx',type:'text'},
            ].map(({label,key,ph,type})=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>{label}</label>
                <input type={type} value={cfg[key]||''} onChange={e=>setCfg(c=>({...c,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button onClick={save} style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
              <button onClick={test} disabled={testing} style={{padding:'10px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit',opacity:testing?.6:1}}>
                {testing?'Enviando...':'Enviar email de prueba'}
              </button>
            </div>
          </div>
        </div>
      ):<div style={{padding:'20px',background:'#f9f9f7',borderRadius:10,color:'#9a9a98',fontSize:13}}>Solo el administrador puede configurar las alertas.</div>}
    </div>
  );
};

function ClientesTab(){
  const G="#3a7d1e";
  const KCLI="aryes-clients";
  const TIPOS=["Panadería","Heladería","Pastelería","HORECA","Catering","Supermercado","Otro"];
  const TCOLOR={"Panadería":"#f59e0b","Heladería":"#3b82f6","Pastelería":"#ec4899","HORECA":"#8b5cf6","Catering":"#06b6d4","Supermercado":"#10b981","Otro":"#6b7280"};
  const emptyForm={nombre:'',tipo:'Panadería',rut:'',telefono:'',email:'',direccion:'',ciudad:'',contacto:'',notas:''};
  const [items,setItems]=useState(()=>LS.get(KCLI,[]));
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  const [fotoModal,setFotoModal]=useState(null);
  const [notaInput,setNotaInput]=useState('');
  const [q,setQ]=useState('');
  const [filtro,setFiltro]=useState('Todos');
  const [vista,setVista]=useState('lista');
  const [selId,setSelId]=useState(null);
  const [msg,setMsg]=useState('');
  const sel=items.find(x=>x.id===selId);
  const save=()=>{
    if(!form.nombre.trim()){setMsg('Nombre obligatorio');return;}
    const upd=editId?items.map(x=>x.id===editId?{...x,...form}:x):[...items,{...form,id:Date.now(),creado:new Date().toISOString()}];
    setItems(upd);LS.set(KCLI,upd);
    setMsg(editId?'Cliente actualizado':'Cliente agregado');
    setForm(emptyForm);setEditId(null);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const del=(id)=>{if(!confirm('¿Eliminar?'))return;const upd=items.filter(x=>x.id!==id);setItems(upd);LS.set(KCLI,upd);setVista('lista');};
  const edit=(x)=>{setForm({nombre:x.nombre,tipo:x.tipo,rut:x.rut||'',telefono:x.telefono||'',email:x.email||'',direccion:x.direccion||'',ciudad:x.ciudad||'',contacto:x.contacto||'',notas:x.notas||''});setEditId(x.id);setVista('form');};
  const filtered=items.filter(x=>(!q||x.nombre.toLowerCase().includes(q.toLowerCase())||(x.ciudad||'').toLowerCase().includes(q.toLowerCase()))&&(filtro==='Todos'||x.tipo===filtro));
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const backBtn=<button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>←</button>;
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>{backBtn}<h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar cliente':'Nuevo cliente'}</h2></div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'Nombre *',k:'nombre',full:true},{l:'Tipo',k:'tipo',sel:true},{l:'RUT',k:'rut'},{l:'Teléfono',k:'telefono'},{l:'Email',k:'email'},{l:'Contacto',k:'contacto'},{l:'Dirección',k:'direccion',full:true},{l:'Ciudad',k:'ciudad'},{l:'Notas',k:'notas',full:true,ta:true}].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
            {f.sel?<select value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{...inp,background:'#fff'}}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select>
            :f.ta?<textarea value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}} />
            :<input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inp} />}
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
          <button onClick={()=>{setVista('lista');setEditId(null);}} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={save} style={{padding:'9px 24px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>{editId?'Guardar':'Agregar cliente'}</button>
        </div>
      </div>
    </section>
  );
  if(vista==='detalle'&&sel)return(
    <section style={{padding:'32px 40px',maxWidth:700,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:24}}>{backBtn}<h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0,flex:1}}>{sel.nombre}</h2><span style={{background:TCOLOR[sel.tipo]||'#6b7280',color:'#fff',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20}}>{sel.tipo}</span></div>
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[{l:'RUT',v:sel.rut||'—'},{l:'Teléfono',v:sel.telefono||'—'},{l:'Email',v:sel.email||'—'},{l:'Contacto',v:sel.contacto||'—'},{l:'Dirección',v:sel.direccion||'—',full:true},{l:'Ciudad',v:sel.ciudad||'—'},{l:'Cliente desde',v:sel.creado?new Date(sel.creado).toLocaleDateString('es-UY'):'—'},{l:'Notas',v:sel.notas||'—',full:true}].map(f=>(
          <div key={f.l} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#999',textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{f.l}</div>
            <div style={{fontSize:14,color:'#1a1a1a'}}>{f.v}</div>
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:8,borderTop:'1px solid #f3f4f6',paddingTop:16}}>
          <button onClick={()=>del(sel.id)} style={{padding:'8px 18px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',color:'#dc2626',cursor:'pointer',fontSize:13}}>Eliminar</button>
          <button onClick={()=>edit(sel)} style={{padding:'8px 20px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Editar</button>
        </div>
      </div>
    </section>
  );
  return(
    <section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Clientes <span style={{fontSize:16,color:'#888',fontWeight:400}}>({filtered.length})</span></h2>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nuevo cliente</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        <input placeholder="Buscar nombre o ciudad..." value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,minWidth:200,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>👥</div>
          <p style={{fontSize:15,marginBottom:4}}>{items.length===0?'Todavía no hay clientes cargados':'Sin resultados para esa búsqueda'}</p>
          {items.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Agregar primer cliente</button>}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {filtered.map(x=>(
            <div key={x.id} onClick={()=>{setSelId(x.id);setVista('detalle');}} style={{background:'#fff',borderRadius:10,padding:18,boxShadow:'0 1px 4px rgba(0,0,0,.06)',cursor:'pointer',border:'1px solid #f3f4f6'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontWeight:600,fontSize:15,color:'#1a1a1a',lineHeight:1.3}}>{x.nombre}</div>
                <span style={{background:TCOLOR[x.tipo]||'#6b7280',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,flexShrink:0,marginLeft:8}}>{x.tipo}</span>
              </div>
              {x.ciudad&&<div style={{fontSize:12,color:'#666',marginBottom:4}}>📍 {x.ciudad}</div>}
              {x.telefono&&<div style={{fontSize:12,color:'#666',marginBottom:4}}>📞 {x.telefono}</div>}
              {x.contacto&&<div style={{fontSize:12,color:'#666'}}>👤 {x.contacto}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MovimientosTab(){
  const G="#3a7d1e";
  const KMOV="aryes-movements";
  const KPROD="aryes6-products";
  const TIPOS=["Entrada","Salida","Ajuste","Devolucion","Transferencia"];
  const TCOLOR={"Entrada":"#10b981","Salida":"#ef4444","Ajuste":"#f59e0b","Devolucion":"#3b82f6","Transferencia":"#8b5cf6"};
  const emptyForm={tipo:"Entrada",productoId:'',cantidad:1,referencia:'',notas:'',fecha:new Date().toISOString().split('T')[0]};
  const [movs,setMovs]=useState(()=>LS.get(KMOV,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [form,setForm]=useState(emptyForm);
  const [vista,setVista]=useState('lista');
  const [filtroTipo,setFiltroTipo]=useState('Todos');
  const [filtroProd,setFiltroProd]=useState('');
  const [msg,setMsg]=useState('');
  const [pag,setPag]=useState(0);
  const POR_PAG=25;
  const prodNombre=(id)=>{const p=prods.find(x=>String(x.id)===String(id));return p?p.nombre:id;};
  const registrar=()=>{
    if(!form.productoId){setMsg('Selecciona un producto');return;}
    if(!form.cantidad||form.cantidad<=0){setMsg('Cantidad debe ser mayor a 0');return;}
    const nuevo={id:Date.now(),tipo:form.tipo,productoId:form.productoId,productoNombre:prodNombre(form.productoId),cantidad:Number(form.cantidad),referencia:form.referencia,notas:form.notas,fecha:form.fecha,timestamp:new Date().toISOString()};
    const esEntrada=(form.tipo==='Entrada'||form.tipo==='Devolucion');
    const updProds=prods.map(p=>{
      if(String(p.id)===String(form.productoId)){
        const stock=Number(p.stock)||0;
        const delta=esEntrada?Number(form.cantidad):-Number(form.cantidad);
        return {...p,stock:Math.max(0,stock+delta)};
      }
      return p;
    });
    const updMovs=[nuevo,...movs];
    setMovs(updMovs);LS.set(KMOV,updMovs);
    setProds(updProds);LS.set(KPROD,updProds);
    setMsg('Movimiento registrado');
    setForm(emptyForm);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const filtered=movs.filter(m=>{ const mt=filtroTipo==='Todos'||m.tipo===filtroTipo; const mp=!filtroProd||m.productoNombre.toLowerCase().includes(filtroProd.toLowerCase()); return mt&&mp; });
  const paginated=filtered.slice(pag*POR_PAG,(pag+1)*POR_PAG);
  const totalPags=Math.ceil(filtered.length/POR_PAG);
  const hoy=new Date();
  const mesActual=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0');
  const movMes=movs.filter(m=>m.fecha&&m.fecha.startsWith(mesActual));
  const entradas=movMes.filter(m=>m.tipo==='Entrada').reduce((a,m)=>a+m.cantidad,0);
  const salidas=movMes.filter(m=>m.tipo==='Salida').reduce((a,m)=>a+m.cantidad,0);
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:600,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>
        <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>&#8592;</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Registrar movimiento</h2>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gap:16}}>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:6}}>Tipo</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {TIPOS.map(t=>(
              <button key={t} onClick={()=>setForm(p=>({...p,tipo:t}))} style={{padding:'7px 14px',borderRadius:20,border:'2px solid '+(form.tipo===t?TCOLOR[t]:'#e5e7eb'),background:form.tipo===t?TCOLOR[t]:'#fff',color:form.tipo===t?'#fff':'#666',fontWeight:600,fontSize:12,cursor:'pointer'}}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto</label>
          <select value={form.productoId} onChange={e=>setForm(p=>({...p,productoId:e.target.value}))} style={{...inp,background:'#fff'}}>
            <option value=''>- Selecciona un producto -</option>
            {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=>(
              <option key={p.id} value={p.id}>{p.nombre}{p.stock!=null?' (stock: '+p.stock+')':''}</option>
            ))}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cantidad</label>
            <input type='number' min='1' value={form.cantidad} onChange={e=>setForm(p=>({...p,cantidad:e.target.value}))} style={inp} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type='date' value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={inp} />
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Referencia (factura, remito...)</label>
          <input value={form.referencia} onChange={e=>setForm(p=>({...p,referencia:e.target.value}))} placeholder='Ej: Factura A-001' style={inp} />
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Notas</label>
          <textarea value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button onClick={()=>setVista('lista')} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={registrar} style={{padding:'9px 24px',background:TCOLOR[form.tipo]||G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar {form.tipo}</button>
        </div>
      </div>
    </section>
  );
  return(
    <section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Movimientos de Stock</h2>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Registrar movimiento</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {[{label:'Este mes',val:movMes.length,color:'#6b7280'},{label:'Entradas (uds)',val:entradas,color:'#10b981'},{label:'Salidas (uds)',val:salidas,color:'#ef4444'}].map(s=>(
          <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'16px 20px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input placeholder='Buscar producto...' value={filtroProd} onChange={e=>{setFiltroProd(e.target.value);setPag(0);}} style={{flex:1,minWidth:180,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
        <select value={filtroTipo} onChange={e=>{setFiltroTipo(e.target.value);setPag(0);}} style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>&#128203;</div>
          <p style={{fontSize:15}}>{movs.length===0?'Todavia no hay movimientos registrados':'Sin movimientos para ese filtro'}</p>
          {movs.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar primer movimiento</button>}
        </div>
      ):(
        <>
          <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                  {['Fecha','Tipo','Producto','Cantidad','Referencia','Notas'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((m,i)=>(
                  <tr key={m.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px',color:'#6b7280',whiteSpace:'nowrap'}}>{m.fecha||'-'}</td>
                    <td style={{padding:'10px 14px'}}><span style={{background:TCOLOR[m.tipo]||'#6b7280',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:20}}>{m.tipo}</span></td>
                    <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a1a',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.productoNombre}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:(m.tipo==='Entrada'||m.tipo==='Devolucion')?'#10b981':'#ef4444'}}>{(m.tipo==='Entrada'||m.tipo==='Devolucion')?'+':'-'}{m.cantidad}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12}}>{m.referencia||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.notas||'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPags>1&&(
            <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:16}}>
              <button onClick={()=>setPag(p=>Math.max(0,p-1))} disabled={pag===0} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:pag===0?'#f3f4f6':'#fff',cursor:pag===0?'default':'pointer',fontSize:13}}>Anterior</button>
              <span style={{padding:'6px 14px',fontSize:13,color:'#666'}}>{pag+1} / {totalPags}</span>
              <button onClick={()=>setPag(p=>Math.min(totalPags-1,p+1))} disabled={pag===totalPags-1} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:pag===totalPags-1?'#f3f4f6':'#fff',cursor:pag===totalPags-1?'default':'pointer',fontSize:13}}>Siguiente</button>
            </div>
          )}
          <div style={{textAlign:'right',marginTop:8,fontSize:12,color:'#aaa'}}>{filtered.length} movimientos totales</div>
        </>
      )}
    </section>
  );
}

function LotesTab(){
  const G="#3a7d1e";
  const KLOTES="aryes-lots";
  const KPROD="aryes6-products";
  const emptyForm={productoId:'',productoNombre:'',lote:'',fechaVenc:'',cantidad:0,proveedor:'',notas:''};
  const [lotes,setLotes]=useState(()=>LS.get(KLOTES,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);
  const [vista,setVista]=useState('lista');
  const [filtro,setFiltro]=useState('todos');
  const [q,setQ]=useState('');
  const [msg,setMsg]=useState('');

  const hoy=new Date();
  const enXDias=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d;};
  const diasParaVencer=(fechaStr)=>{
    if(!fechaStr)return 9999;
    const diff=new Date(fechaStr)-hoy;
    return Math.ceil(diff/(1000*60*60*24));
  };
  const estadoLote=(l)=>{
    const dias=diasParaVencer(l.fechaVenc);
    if(dias<0)return{label:'Vencido',color:'#ef4444',bg:'#fef2f2'};
    if(dias<=30)return{label:'Vence pronto',color:'#f59e0b',bg:'#fffbeb'};
    if(dias<=90)return{label:'Atención',color:'#f97316',bg:'#fff7ed'};
    return{label:'OK',color:'#10b981',bg:'#f0fdf4'};
  };
  const guardar=()=>{
    if(!form.productoId){setMsg('Selecciona un producto');return;}
    if(!form.fechaVenc){setMsg('La fecha de vencimiento es obligatoria');return;}
    if(!form.cantidad||form.cantidad<=0){setMsg('La cantidad debe ser mayor a 0');return;}
    const pNombre=prods.find(p=>String(p.id)===String(form.productoId))?.nombre||form.productoId;
    const item={...form,productoNombre:pNombre,cantidad:Number(form.cantidad),id:editId||Date.now(),creado:new Date().toISOString()};
    const upd=editId?lotes.map(l=>l.id===editId?item:l):[...lotes,item];
    setLotes(upd);LS.set(KLOTES,upd);
    setMsg(editId?'Lote actualizado':'Lote registrado');
    setForm(emptyForm);setEditId(null);setVista('lista');
    setTimeout(()=>setMsg(''),3000);
  };
  const eliminar=(id)=>{
    if(!confirm('Eliminar este lote?'))return;
    const upd=lotes.filter(l=>l.id!==id);
    setLotes(upd);LS.set(KLOTES,upd);
  };
  const editar=(l)=>{
    setForm({productoId:l.productoId,productoNombre:l.productoNombre,lote:l.lote||'',fechaVenc:l.fechaVenc,cantidad:l.cantidad,proveedor:l.proveedor||'',notas:l.notas||''});
    setEditId(l.id);setVista('form');
  };

  // FEFO sort: first expired first, then by vencimiento date asc
  const lotesFEFO=[...lotes].sort((a,b)=>new Date(a.fechaVenc)-new Date(b.fechaVenc));

  const filtered=lotesFEFO.filter(l=>{
    const matchQ=!q||(l.productoNombre||'').toLowerCase().includes(q.toLowerCase())||(l.lote||'').toLowerCase().includes(q.toLowerCase());
    const dias=diasParaVencer(l.fechaVenc);
    const matchF=filtro==='todos'||(filtro==='vencidos'&&dias<0)||(filtro==='pronto'&&dias>=0&&dias<=30)||(filtro==='atencion'&&dias>30&&dias<=90)||(filtro==='ok'&&dias>90);
    return matchQ&&matchF;
  });

  const vencidos=lotes.filter(l=>diasParaVencer(l.fechaVenc)<0).length;
  const proximos=lotes.filter(l=>{const d=diasParaVencer(l.fechaVenc);return d>=0&&d<=30;}).length;
  const atencion=lotes.filter(l=>{const d=diasParaVencer(l.fechaVenc);return d>30&&d<=90;}).length;
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  if(vista==='form')return(
    <section style={{padding:'32px 40px',maxWidth:600,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:28}}>
        <button onClick={()=>{setVista('lista');setEditId(null);setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666',marginRight:8}}>&#8592;</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>{editId?'Editar lote':'Registrar lote'}</h2>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}
      <div style={{background:'#fff',borderRadius:12,padding:28,boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{gridColumn:'1/-1'}}>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto *</label>
          <select value={form.productoId} onChange={e=>setForm(p=>({...p,productoId:e.target.value}))} style={{...inp,background:'#fff'}}>
            <option value=''>- Selecciona un producto -</option>
            {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {[
          {l:'N° de Lote',k:'lote',ph:'Ej: L240315'},
          {l:'Fecha Vencimiento *',k:'fechaVenc',type:'date'},
          {l:'Cantidad (unidades)',k:'cantidad',type:'number'},
          {l:'Proveedor',k:'proveedor',ph:'Ej: Selecta'},
          {l:'Notas',k:'notas',full:true,ta:true},
        ].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?'1/-1':'auto'}}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
            {f.ta?
              <textarea value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} />:
              <input type={f.type||'text'} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph||''} min={f.type==='number'?0:undefined} style={inp} />
            }
          </div>
        ))}
        <div style={{gridColumn:'1/-1',display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button onClick={()=>{setVista('lista');setEditId(null);}} style={{padding:'9px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={guardar} style={{padding:'9px 24px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>{editId?'Guardar cambios':'Registrar lote'}</button>
        </div>
      </div>
    </section>
  );
  return(
    <section style={{padding:'32px 40px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Lotes / Vencimientos</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0',fontStyle:'italic'}}>Ordenados por FEFO — First Expired, First Out</p>
        </div>
        <button onClick={()=>setVista('form')} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Registrar lote</button>
      </div>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Total lotes',val:lotes.length,color:'#6b7280',filtro:'todos'},
          {label:'Vencidos',val:vencidos,color:'#ef4444',filtro:'vencidos'},
          {label:'Vencen en 30 dias',val:proximos,color:'#f59e0b',filtro:'pronto'},
          {label:'Atencion (90d)',val:atencion,color:'#f97316',filtro:'atencion'},
        ].map(s=>(
          <div key={s.label} onClick={()=>setFiltro(filtro===s.filtro?'todos':s.filtro)} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',cursor:'pointer',border:'2px solid '+(filtro===s.filtro?s.color:'transparent'),transition:'border .15s'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <input placeholder='Buscar producto o lote...' value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit'}} />
      </div>

      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>&#128197;</div>
          <p style={{fontSize:15}}>{lotes.length===0?'No hay lotes registrados todavia':'Sin lotes para ese filtro'}</p>
          {lotes.length===0&&<button onClick={()=>setVista('form')} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Registrar primer lote</button>}
        </div>
      ):(
        <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['Estado','Producto','N Lote','Vencimiento','Dias','Cantidad','Proveedor',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l,i)=>{
                const est=estadoLote(l);
                const dias=diasParaVencer(l.fechaVenc);
                return(
                  <tr key={l.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{background:est.bg,color:est.color,fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:20,border:'1px solid '+est.color}}>{est.label}</span>
                    </td>
                    <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a1a',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.productoNombre}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontFamily:'monospace',fontSize:12}}>{l.lote||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#1a1a1a',whiteSpace:'nowrap'}}>{l.fechaVenc||'-'}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:est.color}}>{dias<0?Math.abs(dias)+' vencido':dias===0?'Hoy':dias+' dias'}</td>
                    <td style={{padding:'10px 14px',color:'#1a1a1a'}}>{l.cantidad||'-'}</td>
                    <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12}}>{l.proveedor||'-'}</td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>editar(l)} style={{padding:'4px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:G,fontWeight:600}}>Editar</button>
                        <button onClick={()=>eliminar(l.id)} style={{padding:'4px 10px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:11,color:'#dc2626'}}>x</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{padding:'10px 14px',fontSize:12,color:'#aaa',textAlign:'right'}}>{filtered.length} lotes (ordenados por FEFO)</div>
        </div>
      )}
    </section>
  );
}

// WhatsApp notification helper
const waLink=(telefono,mensaje)=>{
  const num=telefono?telefono.replace(/[^0-9]/g,''):'';
  const txt=encodeURIComponent(mensaje);
  return num?'https://wa.me/598'+num+'?text='+txt:'https://wa.me/?text='+txt;
};
const waMensaje=(cliente,tipo,detalle)=>{
  const tpl=localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos! - Aryes';
  return tpl.replace('{cliente}',cliente||'cliente').replace('{detalle}',detalle||'');
};

function DepositoTab(){
  const G="#3a7d1e";
  const KDEP="aryes-deposito";
  const KPROD="aryes6-products";
  const KLOTES="aryes-lots";
  const ZONAS=[{id:'A',label:'Zona A - Ambiente',color:'#3b82f6'},{id:'F',label:'Zona F - Frio/Freezer',color:'#06b6d4'}];
  const [config,setConfig]=useState(()=>LS.get(KDEP,{pasillos:8,estantes:4,niveles:3,posiciones:6,zonas:['A','F']}));
  const [ubicaciones,setUbicaciones]=useState(()=>LS.get('aryes-ubicaciones',[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [lotes,setLotes]=useState(()=>LS.get(KLOTES,[]));
  const [vista,setVista]=useState('mapa');
  const [zonaActiva,setZonaActiva]=useState('A');
  const [prodSelec,setProdSelec]=useState('');
  const [ubSelec,setUbSelec]=useState(null);
  const [msg,setMsg]=useState('');
  const [showConfig,setShowConfig]=useState(false);

  const genId=(zona,pasillo,estante,nivel,pos)=>
    zona+'-'+String(pasillo).padStart(2,'0')+'-'+estante+'-'+nivel+'-'+String(pos).padStart(2,'0');

  const getUbicacion=(id)=>ubicaciones.find(u=>u.id===id);
  const getProducto=(id)=>prods.find(p=>String(p.id)===String(id));

  const asignar=(ubId,prodId)=>{
    if(!prodId){setMsg('Selecciona un producto');return;}
    const upd=ubicaciones.filter(u=>u.id!==ubId);
    upd.push({id:ubId,productoId:prodId,asignado:new Date().toISOString()});
    setUbicaciones(upd);LS.set('aryes-ubicaciones',upd);
    setProdSelec('');setUbSelec(null);
    setMsg('Producto asignado a '+ubId);
    setTimeout(()=>setMsg(''),3000);
  };

  const desasignar=(ubId)=>{
    const upd=ubicaciones.filter(u=>u.id!==ubId);
    setUbicaciones(upd);LS.set('aryes-ubicaciones',upd);
    setMsg('Ubicacion liberada');
    setTimeout(()=>setMsg(''),2000);
  };

  const ocupadas=ubicaciones.length;
  const totalUbs=config.pasillos*config.estantes*config.niveles*config.posiciones*ZONAS.length;
  const pctOcup=totalUbs>0?Math.round(ocupadas/totalUbs*100):0;

  const letras='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const estanteLetra=(i)=>letras[i]||String(i);
  // Generar picking list optimizado (recorrido en serpentina FEFO)
  const generarPicking=(items)=>{
    // items = [{productoId, cantidad}]
    const picks=[];
    for(const item of items){
      const ub=ubicaciones.find(u=>String(u.productoId)===String(item.productoId));
      const prod=getProducto(item.productoId);
      const lotesItem=lotes.filter(l=>String(l.productoId)===String(item.productoId))
        .sort((a,b)=>new Date(a.fechaVenc)-new Date(b.fechaVenc));
      picks.push({
        ubId:ub?ub.id:'SIN UBICACION',
        producto:prod?prod.nombre:'Desconocido',
        cantidad:item.cantidad,
        lote:lotesItem[0]?.lote||'-',
        venc:lotesItem[0]?.fechaVenc||'-',
        zona:ub?ub.id.split('-')[0]:'-',
        pasillo:ub?parseInt(ub.id.split('-')[1]):999,
      });
    }
    // Sort: zona A primero, luego pasillo impar ida, par vuelta (serpentina)
    picks.sort((a,b)=>{
      if(a.zona!==b.zona)return a.zona.localeCompare(b.zona);
      const aP=a.pasillo,bP=b.pasillo;
      if(aP%2===1&&bP%2===1)return aP-bP;
      if(aP%2===0&&bP%2===0)return bP-aP;
      return aP-bP;
    });
    return picks;
  };

  const [pickingItems,setPickingItems]=useState(()=>{
    const pending=LS.get('aryes-picking-pendiente',[]);
    if(pending&&pending.length>0){
      LS.set('aryes-picking-pendiente',[]);
      return pending.map(p=>({
        productoId:p.productoId||prods.find(x=>x.nombre===p.productoNombre)?.id||p.productoNombre,
        cantidad:p.cantidad
      }));
    }
    return [];
  });
  const [pickingList,setPickingList]=useState([]);
  const [showPicking,setShowPicking]=useState(()=>{
    const pending=JSON.parse(localStorage.getItem('aryes-picking-pendiente-check')||'false');
    localStorage.removeItem('aryes-picking-pendiente-check');
    return pending||LS.get('aryes-picking-pendiente',[]).length>0;
  });

  const addPickingItem=(prodId,cant)=>{
    if(!prodId||!cant)return;
    setPickingItems(p=>{
      const ex=p.find(x=>x.productoId===prodId);
      if(ex)return p.map(x=>x.productoId===prodId?{...x,cantidad:Number(x.cantidad)+Number(cant)}:x);
      return [...p,{productoId:prodId,cantidad:Number(cant)}];
    });
  };
  // CONFIG PANEL
  const ConfigPanel=()=>(
    <div style={{background:'#fff',borderRadius:12,padding:24,marginBottom:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
      <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700,color:'#1a1a1a'}}>Configuracion del deposito</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {l:'Pasillos',k:'pasillos',min:1,max:20},
          {l:'Estantes por pasillo',k:'estantes',min:1,max:10},
          {l:'Niveles de altura',k:'niveles',min:1,max:6},
          {l:'Posiciones por estante',k:'posiciones',min:1,max:20},
        ].map(f=>(
          <div key={f.k}>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
            <input type='number' min={f.min} max={f.max} value={config[f.k]}
              onChange={e=>{const v=Math.max(f.min,Math.min(f.max,Number(e.target.value)));const nc={...config,[f.k]:v};setConfig(nc);LS.set(KDEP,nc);}}
              style={{width:'100%',padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}} />
          </div>
        ))}
      </div>
      <div style={{marginTop:12,fontSize:12,color:'#888'}}>
        Total ubicaciones: <strong>{config.pasillos*config.estantes*config.niveles*config.posiciones*2}</strong> (x2 zonas)
      </div>
    </div>
  );

  // MAPA DEL DEPOSITO
  const MapaZona=({zona})=>{
    const pasillos=Array.from({length:config.pasillos},(_,pi)=>pi+1);
    const estantes=Array.from({length:config.estantes},(_,ei)=>estanteLetra(ei));
    const niveles=Array.from({length:config.niveles},(_,ni)=>ni+1);
    return(
      <div style={{overflowX:'auto'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {pasillos.map(p=>(
            <div key={p} style={{minWidth:120}}>
              <div style={{textAlign:'center',fontSize:11,fontWeight:700,color:'#666',marginBottom:4}}>Pasillo {p}</div>
              {estantes.map(e=>(
                <div key={e} style={{marginBottom:4}}>
                  <div style={{fontSize:10,color:'#999',marginBottom:2}}>Est. {e}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    {niveles.map(n=>(
                      <div key={n} style={{display:'flex',gap:2}}>
                        <div style={{fontSize:9,color:'#bbb',width:12,display:'flex',alignItems:'center'}}>N{n}</div>
                        {Array.from({length:config.posiciones},(_,pi2)=>{
                          const ubId=genId(zona,p,e,n,pi2+1);
                          const ub=getUbicacion(ubId);
                          const prod=ub?getProducto(ub.productoId):null;
                          const selected=ubSelec===ubId;
                          return(
                            <div key={pi2} title={ub?(prod?prod.nombre:'Ocupado'):'Libre'} onClick={()=>{setUbSelec(selected?null:ubId);setProdSelec('');}}
                              style={{width:14,height:14,borderRadius:2,cursor:'pointer',
                                background:selected?'#f59e0b':ub?G:'#e5e7eb',
                                border:'1px solid '+(selected?'#d97706':ub?'#166534':'#d1d5db'),
                                transition:'all .1s'}} />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };
  return(
    <section style={{padding:'24px 32px',maxWidth:1300,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Deposito</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Ubicaciones fisicas + picking optimizado</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowConfig(!showConfig)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,color:'#374151'}}>
            {showConfig?'Ocultar config':'Configurar deposito'}
          </button>
          <button onClick={()=>setShowPicking(!showPicking)} style={{padding:'8px 16px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
            {showPicking?'Ver mapa':'Generar picking list'}
          </button>
        </div>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {showConfig&&<ConfigPanel />}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {l:'Total ubicaciones',v:totalUbs,c:'#6b7280'},
          {l:'Ocupadas',v:ocupadas,c:G},
          {l:'Libres',v:totalUbs-ocupadas,c:'#3b82f6'},
          {l:'Ocupacion',v:pctOcup+'%',c:pctOcup>80?'#ef4444':pctOcup>50?'#f59e0b':G},
        ].map(s=>(
          <div key={s.l} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:26,fontWeight:700,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {!showPicking?(
        <>
          {/* Zona tabs */}
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {ZONAS.map(z=>(
              <button key={z.id} onClick={()=>setZonaActiva(z.id)} style={{padding:'8px 20px',borderRadius:20,border:'2px solid '+(zonaActiva===z.id?z.color:'#e5e7eb'),background:zonaActiva===z.id?z.color:'#fff',color:zonaActiva===z.id?'#fff':'#666',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                {z.label}
              </button>
            ))}
          </div>

          {/* Panel asignacion */}
          {ubSelec&&(
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:16,marginBottom:16,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400e'}}>Ubicacion seleccionada: <code style={{background:'#fef3c7',padding:'2px 6px',borderRadius:4}}>{ubSelec}</code></div>
              {getUbicacion(ubSelec)?(
                <>
                  <span style={{fontSize:13,color:'#666'}}>Producto actual: <strong>{getProducto(getUbicacion(ubSelec).productoId)?.nombre||'Desconocido'}</strong></span>
                  <button onClick={()=>desasignar(ubSelec)} style={{padding:'6px 14px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',color:'#dc2626',cursor:'pointer',fontSize:12,fontWeight:600}}>Liberar</button>
                </>
              ):(
                <>
                  <select value={prodSelec} onChange={e=>setProdSelec(e.target.value)} style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',background:'#fff',flex:1,minWidth:200}}>
                    <option value=''>- Selecciona producto a asignar -</option>
                    {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button onClick={()=>asignar(ubSelec,prodSelec)} style={{padding:'6px 16px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:600}}>Asignar</button>
                </>
              )}
              <button onClick={()=>setUbSelec(null)} style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12,color:'#666'}}>Cancelar</button>
            </div>
          )}

          {/* Leyenda */}
          <div style={{display:'flex',gap:16,marginBottom:12,fontSize:12,color:'#666',alignItems:'center'}}>
            <span>&#9632; <span style={{color:G}}>Ocupada</span></span>
            <span>&#9632; <span style={{color:'#e5e7eb'}}>Libre</span></span>
            <span>&#9632; <span style={{color:'#f59e0b'}}>Seleccionada</span></span>
            <span style={{marginLeft:'auto',fontStyle:'italic'}}>Hace clic en una celda para asignar o liberar</span>
          </div>

          <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',overflowX:'auto'}}>
            <MapaZona zona={zonaActiva} />
          </div>

          {/* Lista de asignaciones */}
          {ubicaciones.length>0&&(
            <div style={{marginTop:20}}>
              <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Productos ubicados ({ubicaciones.length})</h3>
              <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                      {['Ubicacion','Zona','Producto','Asignado'].map(h=>(
                        <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ubicaciones.sort((a,b)=>a.id.localeCompare(b.id)).map((u,i)=>{
                      const prod=getProducto(u.productoId);
                      return(
                        <tr key={u.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                          <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:G,fontSize:12}}>{u.id}</td>
                          <td style={{padding:'9px 14px'}}><span style={{background:u.id.startsWith('F')?'#e0f2fe':'#eff6ff',color:u.id.startsWith('F')?'#0369a1':'#1d4ed8',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{u.id.startsWith('F')?'Frio':'Ambiente'}</span></td>
                          <td style={{padding:'9px 14px',fontWeight:500,color:'#1a1a1a'}}>{prod?prod.nombre:'Desconocido'}</td>
                          <td style={{padding:'9px 14px',color:'#6b7280',fontSize:12}}>{u.asignado?new Date(u.asignado).toLocaleDateString('es-UY'):'-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ):(
        /* PICKING LIST */
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:'#1a1a1a',marginBottom:16}}>Generar Picking List</h3>
          <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:2,minWidth:200}}>
                <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Producto</label>
                <select id='pk-prod' style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
                  <option value=''>- Selecciona -</option>
                  {prods.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{width:100}}>
                <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cantidad</label>
                <input type='number' id='pk-cant' min='1' defaultValue='1' style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}} />
              </div>
              <button onClick={()=>{const s=document.getElementById('pk-prod');const c=document.getElementById('pk-cant');if(s?.value)addPickingItem(s.value,c?.value||1);}} style={{padding:'8px 16px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>+ Agregar</button>
            </div>
            {pickingItems.length>0&&(
              <>
                <div style={{marginBottom:12}}>
                  {pickingItems.map(it=>{
                    const p=getProducto(it.productoId);
                    return(
                      <div key={it.productoId} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid #f3f4f6'}}>
                        <span style={{flex:1,fontSize:13}}>{p?p.nombre:'?'}</span>
                        <span style={{fontSize:13,fontWeight:700,color:G}}>{it.cantidad} uds</span>
                        <button onClick={()=>setPickingItems(p=>p.filter(x=>x.productoId!==it.productoId))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:14}}>x</button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={()=>setPickingList(generarPicking(pickingItems))} style={{padding:'9px 24px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
                  Generar recorrido optimo
                </button>
              </>
            )}
          </div>
          {pickingList.length>0&&(
            <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <div style={{padding:'12px 16px',background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,color:G,fontSize:14}}>Recorrido optimizado (serpentina FEFO)</span>
                <span style={{fontSize:12,color:'#666'}}>{pickingList.length} productos</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                    {['#','Ubicacion','Producto','Cantidad','Lote','Vence'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pickingList.map((p,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                      <td style={{padding:'10px 14px',fontWeight:700,color:'#374151'}}>{i+1}</td>
                      <td style={{padding:'10px 14px',fontFamily:'monospace',fontWeight:700,color:p.ubId==='SIN UBICACION'?'#ef4444':G,fontSize:12}}>{p.ubId}</td>
                      <td style={{padding:'10px 14px',fontWeight:500,color:'#1a1a1a'}}>{p.producto}</td>
                      <td style={{padding:'10px 14px',fontWeight:700,color:G}}>{p.cantidad} uds</td>
                      <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12,fontFamily:'monospace'}}>{p.lote}</td>
                      <td style={{padding:'10px 14px',color:'#6b7280',fontSize:12}}>{p.venc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RutasTab(){
  const G="#3a7d1e";
  const [rutas,setRutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [clientes]=useState(()=>LS.get("aryes-clients",[]));
  const [vista,setVista]=useState("lista");
  const [rutaActiva,setRutaActiva]=useState(null);
  const [form,setForm]=useState({vehiculo:"",zona:"",dia:"",notas:""});
  const [msg,setMsg]=useState("");
  const [busqCli,setBusqCli]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  const ruta=rutas.find(r=>r.id===rutaActiva)||null;

  const crearRuta=()=>{
    if(!form.vehiculo||!form.zona){setMsg("Completa vehiculo y zona");return;}
    const nueva={id:Date.now(),vehiculo:form.vehiculo,zona:form.zona,dia:form.dia,notas:form.notas,entregas:[],creadoEn:new Date().toISOString()};
    const upd=[nueva,...rutas];
    setRutas(upd);LS.set("aryes-rutas",upd);
    setForm({vehiculo:"",zona:"",dia:"",notas:""});
    setMsg("Ruta creada");setTimeout(()=>setMsg(""),3000);
  };

  const eliminarRuta=(id)=>{
    if(!confirm("Eliminar esta ruta?"))return;
    const upd=rutas.filter(r=>r.id!==id);
    setRutas(upd);LS.set("aryes-rutas",upd);
  };

  const agregarEntrega=(cli)=>{
    if(!ruta)return;
    if(ruta.entregas.find(e=>e.clienteId===cli.id)){setMsg("Ya esta en la ruta");return;}
    const e={clienteId:cli.id,clienteNombre:cli.nombre,ciudad:cli.ciudad||"",telefono:cli.telefono||"",estado:"pendiente",hora:"",nota:"",foto:""};
    const upd=rutas.map(r=>r.id===rutaActiva?{...r,entregas:[...r.entregas,e]}:r);
    setRutas(upd);LS.set("aryes-rutas",upd);
    setBusqCli("");
  };

  const marcarEntregado=(rutaId,clienteId)=>{
    const hora=new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"entregado",hora}:ev)}:r);
    setRutas(upd);LS.set("aryes-rutas",upd);
  };

  const marcarNoEntregado=(rutaId,clienteId)=>{
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"no_entregado",hora:new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})}:ev)}:r);
    setRutas(upd);LS.set("aryes-rutas",upd);
  };

  const revertirEntrega=(rutaId,clienteId)=>{
    const upd=rutas.map(r=>r.id===rutaId?{...r,entregas:r.entregas.map(ev=>ev.clienteId===clienteId?{...ev,estado:"pendiente",hora:""}:ev)}:r);
    setRutas(upd);LS.set("aryes-rutas",upd);
  };

  const abrirMaps=(e)=>{
    const q=encodeURIComponent((e.ciudad||e.clienteNombre)+" Uruguay");
    window.open("https://maps.google.com/?q="+q,"_blank","noopener,noreferrer");
  };

  const exportarCSV=()=>{
    if(!ruta)return;
    const rows=[["Cliente","Ciudad","Estado","Hora","Nota"],...ruta.entregas.map(e=>[e.clienteNombre,e.ciudad,e.estado,e.hora,e.nota||""])];
    const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="ruta-"+ruta.vehiculo+".csv";a.click();
    URL.revokeObjectURL(url);
  };

  const clientesFiltrados=clientes.filter(c=>c.nombre&&c.nombre.toLowerCase().includes(busqCli.toLowerCase())).slice(0,6);
  const pendientes=ruta?ruta.entregas.filter(e=>e.estado==="pendiente").length:0;
  const entregados=ruta?ruta.entregas.filter(e=>e.estado==="entregado").length:0;

  // HISTORIAL VIEW
  if(vista==="historial"){
    const hist=rutas.flatMap(r=>r.entregas.filter(e=>e.estado==="entregado").map(e=>({...e,vehiculo:r.vehiculo,zona:r.zona})));
    const exportarHist=()=>{
      const rows=[["Vehiculo","Zona","Cliente","Ciudad","Hora","Nota"],...hist.map(h=>[h.vehiculo,h.zona,h.clienteNombre,h.ciudad||"",h.hora,h.nota||""])];
      const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
      const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download="historial-entregas.csv";a.click();
      URL.revokeObjectURL(url);
    };
    return(
      <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setVista("lista")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Historial de entregas</h2>
          <button onClick={exportarHist} style={{marginLeft:"auto",padding:"7px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700}}>Exportar CSV</button>
        </div>
        {hist.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin entregas registradas</div>):(
          <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {hist.map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <span style={{fontSize:16}}>&#128666;</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{h.clienteNombre}</div>
                  <div style={{fontSize:11,color:"#888"}}>{h.vehiculo} · {h.zona} · {h.ciudad||""}</div>
                </div>
                <div style={{fontSize:12,color:G,fontWeight:700}}>{h.hora}</div>
                <span style={{background:"#f0fdf4",color:G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>Entregado</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // DETALLE VIEW
  if(vista==="detalle"&&ruta){
    return(
      <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>{setVista("lista");setRutaActiva(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:"Playfair Display,serif",fontSize:22,color:"#1a1a1a",margin:0}}>&#128666; {ruta.vehiculo} — {ruta.zona}</h2>
            <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{ruta.dia||"Sin dia asignado"} · {ruta.entregas.length} paradas</p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={exportarCSV} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:12}}>CSV</button>
            <button onClick={()=>setVista("historial")} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:12}}>Historial</button>
          </div>
        </div>
        {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:G}}>{entregados}</div><div style={{fontSize:11,color:"#888"}}>Entregados</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#f59e0b"}}>{pendientes}</div><div style={{fontSize:11,color:"#888"}}>Pendientes</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#1a1a1a"}}>{ruta.entregas.length}</div><div style={{fontSize:11,color:"#888"}}>Total</div></div>
        </div>
        <div style={{background:"#fff",borderRadius:10,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
          <input value={busqCli} onChange={e=>setBusqCli(e.target.value)} placeholder="Buscar cliente para agregar..." style={{...inp,marginBottom:busqCli?8:0}} />
          {busqCli&&clientesFiltrados.map(c=>(
            <div key={c.id} onClick={()=>agregarEntrega(c)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,cursor:"pointer",background:"#f9fafb",marginBottom:4}}>
              <span style={{fontSize:14}}>&#128100;</span>
              <div style={{flex:1,fontSize:13,fontWeight:600}}>{c.nombre}</div>
              <span style={{fontSize:11,color:"#888"}}>{c.ciudad||""}</span>
              <span style={{fontSize:12,color:G,fontWeight:700}}>+</span>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gap:8}}>
          {ruta.entregas.map((e,i)=>{
            const isEntregado=e.estado==="entregado";
            const isNoEnt=e.estado==="no_entregado";
            return(
              <div key={e.clienteId} style={{background:isEntregado?"#f0fdf4":isNoEnt?"#fef2f2":"#fff",border:"1px solid "+(isEntregado?"#bbf7d0":isNoEnt?"#fecaca":"#e5e7eb"),borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:18,opacity:.7}}>&#128205;</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{e.clienteNombre}</div>
                    <div style={{fontSize:12,color:"#888"}}>{e.ciudad||""}{e.hora?" · "+e.hora:""}</div>
                  </div>
                  <span style={{fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:700,background:isEntregado?"#f0fdf4":isNoEnt?"#fef2f2":"#fffbeb",color:isEntregado?G:isNoEnt?"#dc2626":"#92400e"}}>{e.estado==="pendiente"?"Pendiente":e.estado==="entregado"?"Entregado":"No entregado"}</span>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {!isEntregado&&!isNoEnt&&(
                    <>
                      <button onClick={()=>marcarEntregado(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700}}>Entregado</button>
                      <button onClick={()=>marcarNoEntregado(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,cursor:"pointer",fontSize:12}}>No entregado</button>
                    </>
                  )}
                  {(isEntregado||isNoEnt)&&(
                    <button onClick={()=>revertirEntrega(ruta.id,e.clienteId)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",color:"#374151",borderRadius:6,cursor:"pointer",fontSize:12}}>Revertir</button>
                  )}
                  <button onClick={()=>abrirMaps(e)} style={{padding:"6px 12px",background:"#fff",border:"1px solid #e5e7eb",color:"#374151",borderRadius:6,cursor:"pointer",fontSize:12}}>Maps</button>
                </div>
              </div>
            );
          })}
        </div>
        {ruta.entregas.length===0&&<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Buscá clientes arriba para agregar paradas</div>}
      </section>
    );
  }

  // LISTA VIEW (default)
  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Rutas de Reparto</h2>
          <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Planifica y gestiona las rutas de entrega</p>
        </div>
        <button onClick={()=>setVista("historial")} style={{padding:"8px 16px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:13}}>Ver historial</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:14}}>Nueva ruta</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Vehiculo</label>
          <input value={form.vehiculo} onChange={e=>setForm(f=>({...f,vehiculo:e.target.value}))} placeholder="Ej: Camion A" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Zona</label>
          <input value={form.zona} onChange={e=>setForm(f=>({...f,zona:e.target.value}))} placeholder="Ej: Montevideo Norte" style={inp} /></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Dia</label>
          <input value={form.dia} onChange={e=>setForm(f=>({...f,dia:e.target.value}))} placeholder="Ej: Lunes" style={inp} /></div>
        </div>
        <button onClick={crearRuta} style={{padding:"9px 22px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Crear ruta</button>
      </div>
      <div style={{display:"grid",gap:10}}>
        {rutas.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin rutas creadas</div>):(
          rutas.map(r=>{
            const pend=r.entregas.filter(e=>e.estado==="pendiente").length;
            const ent=r.entregas.filter(e=>e.estado==="entregado").length;
            return(
              <div key={r.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <span style={{fontSize:22}}>&#128666;</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{r.vehiculo} — {r.zona}</div>
                  <div style={{fontSize:12,color:"#888"}}>{r.dia||"Sin dia"} · {ent}/{r.entregas.length} entregas</div>
                </div>
                {pend>0&&<span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{pend} pendientes</span>}
                <button onClick={()=>{setRutaActiva(r.id);setVista("detalle");}} style={{padding:"7px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Ver ruta</button>
                <button onClick={()=>eliminarRuta(r.id)} style={{padding:"7px 10px",background:"#fff",border:"1px solid #fecaca",color:"#dc2626",borderRadius:8,cursor:"pointer",fontSize:12}}>&#10005;</button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
function RecepcionTab(){
  const G="#3a7d1e";
  const KORD="aryes6-orders";
  const KPROD="aryes6-products";
  const KLOTES="aryes-lots";
  const KREC="aryes-recepciones";
  const [pedidos]=useState(()=>LS.get(KORD,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [lotes,setLotes]=useState(()=>LS.get(KLOTES,[]));
  const [recepciones,setRecepciones]=useState(()=>LS.get(KREC,[]));
  const [vista,setVista]=useState('lista');
  const [pedidoSel,setPedidoSel]=useState(null);
  const [items,setItems]=useState([]);
  const [proveedor,setProveedor]=useState('');
  const [nroRemito,setNroRemito]=useState('');
  const [fecha,setFecha]=useState(new Date().toISOString().split('T')[0]);
  const [notas,setNotas]=useState('');
  const [msg,setMsg]=useState('');

  const pendientes=pedidos.filter(p=>p.status==='pending'||p.status==='ordered'||!p.status);

  const iniciarRecepcion=(ped)=>{
    setPedidoSel(ped);
    setProveedor(ped.supplierName||'');
    // Build items from order
    const its=ped?[{
      productoId: ped.productId||ped.id,
      nombre: ped.productName||ped.nombre||'Producto',
      cantidadEsperada: Number(ped.qty||ped.cantidad||0),
      cantidadRecibida: Number(ped.qty||ped.cantidad||0),
      cantidadRechazada: 0,
      unidad: ped.unit||ped.unidad||'u',
      lote: '',
      vencimiento: '',
      calidad: 'ok',
      motivoRechazo: '',
      diferencia: 0,
    }]:[];
    setItems(its);
    setVista('recepcion');
  };

  const iniciarManual=()=>{
    setPedidoSel(null);
    setProveedor('');
    setItems([{
      productoId:'',nombre:'',
      cantidadEsperada:0,cantidadRecibida:0,cantidadRechazada:0,
      unidad:'u',lote:'',vencimiento:'',calidad:'ok',motivoRechazo:'',diferencia:0
    }]);
    setVista('recepcion');
  };

  const updateItem=(idx,field,val)=>{
    setItems(prev=>prev.map((it,i)=>{
      if(i!==idx)return it;
      const upd={...it,[field]:val};
      if(field==='cantidadRecibida'||field==='cantidadEsperada'){
        upd.diferencia=Number(upd.cantidadRecibida)-Number(upd.cantidadEsperada);
      }
      return upd;
    }));
  };

  const agregarItem=()=>setItems(prev=>[...prev,{
    productoId:'',nombre:'',
    cantidadEsperada:0,cantidadRecibida:0,cantidadRechazada:0,
    unidad:'u',lote:'',vencimiento:'',calidad:'ok',motivoRechazo:'',diferencia:0
  }]);

  const confirmarRecepcion=()=>{
    if(items.length===0){setMsg('No hay items');return;}
    const ahora=new Date().toISOString();

    // 1. Update stock
    let updProds=[...prods];
    items.forEach(it=>{
      if(!it.nombre||Number(it.cantidadRecibida)===0)return;
      // Find product by name or id
      const idx=updProds.findIndex(p=>
        String(p.id)===String(it.productoId)||
        p.nombre?.toLowerCase()===it.nombre.toLowerCase()||
        p.name?.toLowerCase()===it.nombre.toLowerCase()
      );
      if(idx>-1){
        updProds[idx]={...updProds[idx],stock:(Number(updProds[idx].stock||0)+Number(it.cantidadRecibida))};
      }
    });
    setProds(updProds);
    LS.set(KPROD,updProds);

    // 2. Create lots for items with vencimiento
    let updLotes=[...lotes];
    items.forEach(it=>{
      if(!it.vencimiento||Number(it.cantidadRecibida)===0)return;
      const prod=updProds.find(p=>String(p.id)===String(it.productoId)||p.nombre?.toLowerCase()===it.nombre.toLowerCase()||p.name?.toLowerCase()===it.nombre.toLowerCase());
      updLotes.push({
        id:Date.now()+Math.random(),
        productoId:prod?.id||it.productoId,
        productoNombre:it.nombre,
        lote:it.lote||('REC-'+Date.now()),
        cantidad:Number(it.cantidadRecibida),
        fechaVenc:it.vencimiento,
        fechaIngreso:ahora,
        proveedor:proveedor
      });
    });
    setLotes(updLotes);
    LS.set(KLOTES,updLotes);

    // 3. Save recepcion record
    const rec={
      id:Date.now(),
      fecha,
      proveedor,
      nroRemito,
      notas,
      pedidoId:pedidoSel?.id||null,
      items,
      estado:'completada',
      creadoEn:ahora,
      diferencias:items.filter(it=>it.diferencia!==0).length
    };
    const updRec=[rec,...recepciones];
    setRecepciones(updRec);
    LS.set(KREC,updRec);

    setMsg('Recepcion confirmada. Stock actualizado.');
    setVista('lista');
    setTimeout(()=>setMsg(''),4000);
  };
  const inp={padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};

  // VISTA RECEPCION - formulario guiado
  if(vista==='recepcion')return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
        <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>&#8592;</button>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Recepcion de mercaderia</h2>
          <p style={{fontSize:12,color:'#888',margin:'2px 0 0'}}>{pedidoSel?'Basado en pedido a '+proveedor:'Recepcion manual'}</p>
        </div>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Header data */}
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Proveedor</label>
            <input style={inp} value={proveedor} onChange={e=>setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Nro. Remito</label>
            <input style={inp} value={nroRemito} onChange={e=>setNroRemito(e.target.value)} placeholder="Ej: 0001-000123" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type="date" style={inp} value={fecha} onChange={e=>setFecha(e.target.value)} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Notas</label>
            <input style={inp} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{padding:'12px 16px',background:'#f9fafb',borderBottom:'2px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,color:'#374151',fontSize:14}}>Detalle de mercaderia recibida</span>
          <button onClick={agregarItem} style={{padding:'5px 14px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>+ Agregar item</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                {['Producto','Esperado','Recibido','Rechazado','Unidad','Lote','Vencimiento','Calidad','Diferencia',''].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it,i)=>(
                <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:it.diferencia<0?'#fef2f2':it.diferencia>0?'#fffbeb':'#fff'}}>
                  <td style={{padding:'8px 10px',minWidth:180}}>
                    {pedidoSel?(
                      <span style={{fontWeight:600,color:'#1a1a1a'}}>{it.nombre}</span>
                    ):(
                      <input style={{...inp,minWidth:160}} value={it.nombre} onChange={e=>updateItem(i,'nombre',e.target.value)} placeholder="Nombre del producto" />
                    )}
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80}} value={it.cantidadEsperada} onChange={e=>updateItem(i,'cantidadEsperada',e.target.value)} min="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80,fontWeight:700,borderColor:it.diferencia!==0?'#f59e0b':'#e5e7eb'}} value={it.cantidadRecibida} onChange={e=>updateItem(i,'cantidadRecibida',e.target.value)} min="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:90}}>
                    <input type="number" style={{...inp,width:80,fontWeight:700,borderColor:Number(it.cantidadRechazada||0)>0?'#ef4444':'#e5e7eb',color:Number(it.cantidadRechazada||0)>0?'#dc2626':'#1a1a1a'}} value={it.cantidadRechazada||0} onChange={e=>updateItem(i,'cantidadRechazada',e.target.value)} min="0" placeholder="0" />
                  </td>
                  <td style={{padding:'8px 10px',width:80}}>
                    <input style={{...inp,width:70}} value={it.unidad} onChange={e=>updateItem(i,'unidad',e.target.value)} placeholder="u" />
                  </td>
                  <td style={{padding:'8px 10px',width:120}}>
                    <input style={{...inp,width:110,fontFamily:'monospace'}} value={it.lote} onChange={e=>updateItem(i,'lote',e.target.value)} placeholder="Nro. lote" />
                  </td>
                  <td style={{padding:'8px 10px',width:130}}>
                    <input type="date" style={{...inp,width:120}} value={it.vencimiento} onChange={e=>updateItem(i,'vencimiento',e.target.value)} />
                  </td>
                  <td style={{padding:'8px 10px',width:100}}>
                    <select value={it.calidad||'ok'} onChange={e=>updateItem(i,'calidad',e.target.value)} style={{padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,fontWeight:700,fontFamily:'inherit',color:it.calidad==='rechazado'?'#dc2626':it.calidad==='observado'?'#f59e0b':'#3a7d1e',background:it.calidad==='rechazado'?'#fef2f2':it.calidad==='observado'?'#fffbeb':'#f0fdf4'}}>
                      <option value="ok">OK</option>
                      <option value="observado">Observado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                  </td>
                  <td style={{padding:'8px 12px',width:90,textAlign:'center'}}>
                    <span style={{
                      fontWeight:700,fontSize:13,
                      color:it.diferencia===0?'#6b7280':it.diferencia>0?'#059669':'#dc2626',
                      background:it.diferencia===0?'#f3f4f6':it.diferencia>0?'#f0fdf4':'#fef2f2',
                      padding:'3px 10px',borderRadius:20,display:'inline-block'
                    }}>
                      {it.diferencia>0?'+':''}{it.diferencia}
                    </span>
                  </td>
                  <td style={{padding:'8px 8px'}}>
                    <button onClick={()=>setItems(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:14}}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {items.some(it=>it.diferencia!==0)&&(
        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:700,color:'#92400e',fontSize:13,marginBottom:6}}>Diferencias detectadas:</div>
          {items.filter(it=>it.diferencia!==0).map((it,i)=>(
            <div key={i} style={{fontSize:12,color:'#78350f',padding:'2px 0'}}>
              <strong>{it.nombre}</strong>: esperado {it.cantidadEsperada} {it.unidad}, recibido {it.cantidadRecibida} {it.unidad}
              <span style={{color:it.diferencia>0?'#059669':'#dc2626',fontWeight:700}}> ({it.diferencia>0?'+':''}{it.diferencia})</span>
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={()=>setVista('lista')} style={{padding:'10px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
        <button onClick={confirmarRecepcion} style={{padding:'10px 28px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>
          Confirmar recepcion y actualizar stock
        </button>
      </div>
    </section>
  );

  // VISTA LISTA
  return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Recepcion de Mercaderia</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Confirmacion guiada de llegadas + actualizacion automatica de stock</p>
        </div>
        <button onClick={iniciarManual} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Recepcion manual</button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Pedidos pendientes */}
      {pendientes.length>0&&(
        <div style={{marginBottom:24}}>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Pedidos pendientes de recepcion ({pendientes.length})</h3>
          <div style={{display:'grid',gap:8}}>
            {pendientes.map(ped=>(
              <div key={ped.id} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a'}}>{ped.productName||ped.nombre}</div>
                  <div style={{fontSize:12,color:'#666',marginTop:2}}>
                    {ped.supplierName&&<span>&#127981; {ped.supplierName} · </span>}
                    <span>{ped.qty||ped.cantidad} {ped.unit||ped.unidad}</span>
                    {ped.expectedDate&&<span> · Esperado: {ped.expectedDate}</span>}
                  </div>
                </div>
                <button onClick={()=>iniciarRecepcion(ped)} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
                  Recibir mercaderia
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length===0&&(
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'16px 20px',marginBottom:20,fontSize:13,color:G}}>
          No hay pedidos pendientes. Podés hacer una recepcion manual de cualquier mercaderia.
        </div>
      )}

      {/* Historial */}
      {recepciones.length>0&&(
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',marginBottom:12}}>Historial de recepciones ({recepciones.length})</h3>
          <div style={{background:'#fff',borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                  {['Fecha','Proveedor','Remito','Items','Diferencias','Estado'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recepciones.map((rec,i)=>(
                  <tr key={rec.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'10px 14px',fontWeight:500}}>{rec.fecha}</td>
                    <td style={{padding:'10px 14px',color:'#374151'}}>{rec.proveedor||'-'}</td>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{rec.nroRemito||'-'}</td>
                    <td style={{padding:'10px 14px',fontWeight:700,color:G}}>{rec.items?.length||0} productos</td>
                    <td style={{padding:'10px 14px'}}>
                      {rec.diferencias>0?(
                        <span style={{background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>{rec.diferencias} diferencias</span>
                      ):(
                        <span style={{background:'#f0fdf4',color:G,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>Sin diferencias</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{background:'#f0fdf4',color:G,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20}}>Completada</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function VentasTab(){
  const G="#3a7d1e";
  const KVEN="aryes-ventas";
  const KCLI="aryes-clients";
  const KPROD="aryes6-products";
  const ESTADOS={pendiente:'#f59e0b',confirmada:'#3b82f6',preparada:'#8b5cf6',entregada:'#3a7d1e',cancelada:'#ef4444'};

  const [ventas,setVentas]=useState(()=>LS.get(KVEN,[]));
  const [clientes]=useState(()=>LS.get(KCLI,[]));
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [vista,setVista]=useState('lista');
  const [ventaSel,setVentaSel]=useState(null);
  const [msg,setMsg]=useState('');
  const [filtroEstado,setFiltroEstado]=useState('todos');
  const [busqueda,setBusqueda]=useState('');

  // Form state
  const emptyForm={clienteId:'',clienteNombre:'',fecha:new Date().toISOString().split('T')[0],items:[],notas:'',descuento:0};
  const [form,setForm]=useState(emptyForm);
  const [itemProd,setItemProd]=useState('');
  const [itemCant,setItemCant]=useState(1);
  const [itemPrecio,setItemPrecio]=useState(0);

  const totalVenta=(items,desc=0)=>{
    const sub=items.reduce((a,it)=>a+Number(it.cantidad)*Number(it.precioUnit),0);
    return sub*(1-Number(desc)/100);
  };

  const agregarItem=()=>{
    if(!itemProd||Number(itemCant)<=0)return;
    const prod=prods.find(p=>String(p.id)===String(itemProd));
    if(!prod)return;
    const precio=itemPrecio>0?itemPrecio:(prod.precio||prod.price||0);
    setForm(f=>({...f,items:[...f.items,{
      productoId:prod.id,
      nombre:prod.nombre||prod.name,
      cantidad:Number(itemCant),
      precioUnit:Number(precio),
      unidad:prod.unidad||prod.unit||'u',
      subtotal:Number(itemCant)*Number(precio)
    }]}));
    setItemProd('');setItemCant(1);setItemPrecio(0);
  };

  const guardarVenta=()=>{
    if(!form.clienteNombre&&!form.clienteId){setMsg('Selecciona un cliente');return;}
    if(form.items.length===0){setMsg('Agrega al menos un producto');return;}
    const cl=clientes.find(c=>String(c.id)===String(form.clienteId));
    const venta={
      ...form,
      id:Date.now(),
      clienteNombre:cl?.nombre||form.clienteNombre,
      total:totalVenta(form.items,form.descuento),
      estado:'pendiente',
      nroVenta:'V-'+String(ventas.length+1).padStart(4,'0'),
      creadoEn:new Date().toISOString()
    };
    const upd=[venta,...ventas];
    setVentas(upd);LS.set(KVEN,upd);
    setForm(emptyForm);setVista('lista');
    setMsg('Venta '+venta.nroVenta+' creada');
    setTimeout(()=>setMsg(''),3000);
  };

  const cambiarEstado=(id,estado)=>{
    let updProds=[...prods];
    const venta=ventas.find(v=>v.id===id);
    // If confirming delivery, discount stock
    if(estado==='entregada'&&venta&&venta.estado!=='entregada'){
      venta.items.forEach(it=>{
        const idx=updProds.findIndex(p=>String(p.id)===String(it.productoId));
        if(idx>-1){
          const newStock=Math.max(0,Number(updProds[idx].stock||0)-Number(it.cantidad));
          updProds[idx]={...updProds[idx],stock:newStock};
        }
      });
      setProds(updProds);LS.set(KPROD,updProds);
    }
    const upd=ventas.map(v=>v.id===id?{...v,estado,updatedAt:new Date().toISOString()}:v);
    setVentas(upd);LS.set(KVEN,upd);
    if(ventaSel?.id===id)setVentaSel({...ventaSel,estado});
    if(estado==='entregada'){
      const cl=clientes.find(c=>String(c.id)===String(venta?.clienteId));
      const tel=cl?.telefono||'';
      const det='su pedido '+venta?.nroVenta+' fue entregado hoy '+new Date().toLocaleDateString('es-UY');
      const link=waLink(tel,waMensaje(venta?.clienteNombre||cl?.nombre,'entrega',det));
      setMsg('ENTREGADA:'+link+':'+venta?.clienteNombre);
    }else{
      setMsg('Estado actualizado: '+estado);
      setTimeout(()=>setMsg(''),4000);
    }
  };

  const ventasFiltradas=ventas.filter(v=>{
    if(filtroEstado!=='todos'&&v.estado!==filtroEstado)return false;
    if(busqueda&&!v.clienteNombre?.toLowerCase().includes(busqueda.toLowerCase())&&!v.nroVenta?.toLowerCase().includes(busqueda.toLowerCase()))return false;
    return true;
  });

  const totalMes=ventas.filter(v=>{
    const d=new Date(v.creadoEn);
    const now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&v.estado!=='cancelada';
  }).reduce((a,v)=>a+Number(v.total||0),0);
  const inp={padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box',background:'#fff'};

  if(vista==='form')return(
    <section style={{padding:'28px 36px',maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>&#8592;</button>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:26,color:'#1a1a1a',margin:0}}>Nueva orden de venta</h2>
      </div>
      {msg&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 16px',marginBottom:16,color:'#dc2626',fontSize:13}}>{msg}</div>}

      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Cliente</label>
            {clientes.length>0?(
              <select value={form.clienteId} onChange={e=>{const cl=clientes.find(c=>String(c.id)===e.target.value);setForm(f=>({...f,clienteId:e.target.value,clienteNombre:cl?.nombre||''}));}} style={inp}>
                <option value=''>- Seleccionar cliente -</option>
                {clientes.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            ):(
              <input style={inp} value={form.clienteNombre} onChange={e=>setForm(f=>({...f,clienteNombre:e.target.value}))} placeholder="Nombre del cliente" />
            )}
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Fecha</label>
            <input type='date' style={inp} value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Descuento %</label>
            <input type='number' style={inp} value={form.descuento} onChange={e=>setForm(f=>({...f,descuento:e.target.value}))} min='0' max='100' />
          </div>
        </div>

        {/* Agregar producto */}
        <div style={{background:'#f9fafb',borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'#666',marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Agregar producto</div>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:3,minWidth:200}}>
              <select value={itemProd} onChange={e=>{
                setItemProd(e.target.value);
                const p=prods.find(x=>String(x.id)===e.target.value);
                if(p)setItemPrecio(p.precio||p.price||0);
              }} style={inp}>
                <option value=''>- Producto -</option>
                {prods.sort((a,b)=>(a.nombre||a.name||'').localeCompare(b.nombre||b.name||'')).map(p=><option key={p.id} value={p.id}>{p.nombre||p.name} (stock: {p.stock||0})</option>)}
              </select>
            </div>
            <div style={{width:90}}>
              <input type='number' placeholder='Cant.' value={itemCant} onChange={e=>setItemCant(e.target.value)} style={inp} min='1' />
            </div>
            <div style={{width:110}}>
              <input type='number' placeholder='Precio u.' value={itemPrecio} onChange={e=>setItemPrecio(e.target.value)} style={inp} min='0' />
            </div>
            <button onClick={agregarItem} style={{padding:'8px 18px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Agregar</button>
          </div>
        </div>

        {/* Items */}
        {form.items.length>0&&(
          <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {['Producto','Cant.','Precio u.','Subtotal',''].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {form.items.map((it,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6'}}>
                    <td style={{padding:'9px 12px',fontWeight:500}}>{it.nombre}</td>
                    <td style={{padding:'9px 12px'}}>{it.cantidad} {it.unidad}</td>
                    <td style={{padding:'9px 12px',color:'#6b7280'}}>${Number(it.precioUnit).toLocaleString('es-UY')}</td>
                    <td style={{padding:'9px 12px',fontWeight:700,color:G}}>${(it.cantidad*it.precioUnit).toLocaleString('es-UY')}</td>
                    <td style={{padding:'9px 8px'}}><button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626'}}>x</button></td>
                  </tr>
                ))}
                {Number(form.descuento)>0&&(
                  <tr style={{borderTop:'1px solid #e5e7eb',background:'#fffbeb'}}>
                    <td colSpan='3' style={{padding:'8px 12px',textAlign:'right',color:'#92400e',fontWeight:600}}>Descuento {form.descuento}%</td>
                    <td style={{padding:'8px 12px',color:'#92400e',fontWeight:700}}>-${(form.items.reduce((a,it)=>a+it.cantidad*it.precioUnit,0)*form.descuento/100).toLocaleString('es-UY')}</td>
                    <td></td>
                  </tr>
                )}
                <tr style={{borderTop:'2px solid #e5e7eb',background:'#f0fdf4'}}>
                  <td colSpan='3' style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#1a1a1a'}}>TOTAL</td>
                  <td style={{padding:'10px 12px',fontWeight:800,color:G,fontSize:16}}>${totalVenta(form.items,form.descuento).toLocaleString('es-UY')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div>
          <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4,marginTop:14}}>Notas</label>
          <textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} />
        </div>
      </div>

      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={()=>{setVista('lista');setForm(emptyForm);}} style={{padding:'10px 20px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
        <button onClick={guardarVenta} style={{padding:'10px 28px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>Crear orden de venta</button>
      </div>
    </section>
  );
  // DETALLE
  if(vista==='detalle'&&ventaSel){
    const v=ventas.find(x=>x.id===ventaSel.id)||ventaSel;
    return(
      <section style={{padding:'28px 36px',maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <button onClick={()=>setVista('lista')} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#666'}}>&#8592;</button>
          <div style={{flex:1}}>
            <h2 style={{fontFamily:'Playfair Display,serif',fontSize:24,color:'#1a1a1a',margin:0}}>{v.nroVenta} — {v.clienteNombre}</h2>
            <p style={{fontSize:12,color:'#888',margin:'2px 0 0'}}>{v.fecha}</p>
          </div>
          <span style={{background:ESTADOS[v.estado]||'#6b7280',color:'#fff',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,textTransform:'capitalize'}}>{v.estado}</span>
        </div>
        {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

        {/* Acciones de estado */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          {v.estado==='pendiente'&&<button onClick={()=>cambiarEstado(v.id,'confirmada')} style={{padding:'7px 16px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Confirmar</button>}
          {v.estado==='confirmada'&&<button onClick={()=>cambiarEstado(v.id,'preparada')} style={{padding:'7px 16px',background:'#8b5cf6',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Marcar preparada</button>}
          {(v.estado==='preparada'||v.estado==='confirmada')&&<button onClick={()=>cambiarEstado(v.id,'entregada')} style={{padding:'7px 16px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>Marcar entregada (descuenta stock)</button>}
          {v.estado!=='cancelada'&&v.estado!=='entregada'&&<button onClick={()=>cambiarEstado(v.id,'cancelada')} style={{padding:'7px 16px',border:'1px solid #fecaca',background:'#fff',color:'#dc2626',borderRadius:8,cursor:'pointer',fontSize:12}}>Cancelar</button>}
        </div>

        <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['Producto','Cant.','Precio u.','Subtotal'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {v.items?.map((it,i)=>(
                <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'10px 14px',fontWeight:500}}>{it.nombre}</td>
                  <td style={{padding:'10px 14px'}}>{it.cantidad} {it.unidad}</td>
                  <td style={{padding:'10px 14px',color:'#6b7280'}}>${Number(it.precioUnit).toLocaleString('es-UY')}</td>
                  <td style={{padding:'10px 14px',fontWeight:700,color:G}}>${(it.cantidad*it.precioUnit).toLocaleString('es-UY')}</td>
                </tr>
              ))}
              {Number(v.descuento)>0&&(
                <tr style={{background:'#fffbeb',borderTop:'1px solid #e5e7eb'}}>
                  <td colSpan='3' style={{padding:'8px 14px',textAlign:'right',color:'#92400e',fontWeight:600}}>Descuento {v.descuento}%</td>
                  <td style={{padding:'8px 14px',color:'#92400e',fontWeight:700}}>-${(v.items?.reduce((a,it)=>a+it.cantidad*it.precioUnit,0)*v.descuento/100).toLocaleString('es-UY')}</td>
                </tr>
              )}
              <tr style={{borderTop:'2px solid #e5e7eb',background:'#f0fdf4'}}>
                <td colSpan='3' style={{padding:'12px 14px',textAlign:'right',fontWeight:700}}>TOTAL</td>
                <td style={{padding:'12px 14px',fontWeight:800,color:G,fontSize:18}}>${Number(v.total).toLocaleString('es-UY')}</td>
              </tr>
            </tbody>
          </table>
          {v.notas&&<div style={{marginTop:14,padding:'10px 14px',background:'#fffbeb',borderRadius:8,fontSize:13,color:'#92400e'}}>Notas: {v.notas}</div>}
        </div>
      </section>
    );
  }

  // LISTA
  return(
    <section style={{padding:'28px 36px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Ordenes de Venta</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Gestion de ventas a clientes — remitos y estado de entrega</p>
        </div>
        <button onClick={()=>{setForm(emptyForm);setVista('form');}} style={{background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>+ Nueva venta</button>
      </div>
      {msg&&(msg.startsWith('ENTREGADA:')?
        (()=>{const[,link,nombre]=msg.split(':');return(
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
            <span style={{color:G,fontSize:13,fontWeight:600}}>Venta entregada. Notificar a {nombre||'cliente'}?</span>
            <a href={link} target='_blank' rel='noreferrer' style={{background:'#25d366',color:'#fff',padding:'8px 18px',borderRadius:8,fontWeight:700,fontSize:13,textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>
              &#128233; Enviar WhatsApp
            </a>
          </div>
        );})()
      :<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>)}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {l:'Total ventas',v:ventas.length,c:'#6b7280'},
          {l:'Pendientes',v:ventas.filter(v=>v.estado==='pendiente').length,c:'#f59e0b'},
          {l:'En preparacion',v:ventas.filter(v=>v.estado==='preparada'||v.estado==='confirmada').length,c:'#8b5cf6'},
          {l:'Facturado este mes',v:'$'+totalMes.toLocaleString('es-UY'),c:G},
        ].map(s=>(
          <div key={s.l} style={{background:'#fff',borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder='Buscar cliente o N° venta...' style={{padding:'7px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,fontFamily:'inherit',flex:1,minWidth:200}} />
        <div style={{display:'flex',gap:6}}>
          {['todos','pendiente','confirmada','preparada','entregada','cancelada'].map(est=>(
            <button key={est} onClick={()=>setFiltroEstado(est)} style={{padding:'6px 12px',borderRadius:20,border:'2px solid '+(filtroEstado===est?(ESTADOS[est]||G):'#e5e7eb'),background:filtroEstado===est?(ESTADOS[est]||G):'#fff',color:filtroEstado===est?'#fff':'#666',fontWeight:600,fontSize:11,cursor:'pointer',textTransform:'capitalize'}}>
              {est==='todos'?'Todos':est}
            </button>
          ))}
        </div>
      </div>

      {ventasFiltradas.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#888'}}>
          <div style={{fontSize:40,marginBottom:12}}>&#128203;</div>
          <p>{ventas.length===0?'No hay ordenes de venta aun':'No hay resultados para este filtro'}</p>
          <button onClick={()=>{setForm(emptyForm);setVista('form');}} style={{marginTop:12,background:G,color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>Crear primera venta</button>
        </div>
      ):(
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid #e5e7eb'}}>
                {['N° Orden','Cliente','Fecha','Productos','Total','Estado',''].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.map((v,i)=>(
                <tr key={v.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa',cursor:'pointer'}} onClick={()=>{setVentaSel(v);setVista('detalle');}}>
                  <td style={{padding:'11px 14px',fontFamily:'monospace',fontWeight:700,color:G,fontSize:12}}>{v.nroVenta}</td>
                  <td style={{padding:'11px 14px',fontWeight:600,color:'#1a1a1a'}}>{v.clienteNombre}</td>
                  <td style={{padding:'11px 14px',color:'#6b7280'}}>{v.fecha}</td>
                  <td style={{padding:'11px 14px',color:'#6b7280'}}>{v.items?.length||0} productos</td>
                  <td style={{padding:'11px 14px',fontWeight:700,color:G}}>${Number(v.total||0).toLocaleString('es-UY')}</td>
                  <td style={{padding:'11px 14px'}}>
                    <span style={{background:ESTADOS[v.estado]||'#6b7280',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,textTransform:'capitalize'}}>{v.estado}</span>
                  </td>
                  <td style={{padding:'11px 10px'}}>
                    <button onClick={e=>{e.stopPropagation();setVentaSel(v);setVista('detalle');}} style={{background:G,color:'#fff',border:'none',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ConfigTab(){
  const G="#3a7d1e";
  const [emailCfg,setEmailCfg]=useState(()=>LS.get('aryes9-emailcfg',{serviceId:'',templateId:'',publicKey:'',toEmail:''}));
  const [waTpl,setWaTpl]=useState(()=>localStorage.getItem('aryes-wa-template')||'Hola {cliente}! Les informamos que {detalle}. Gracias por elegirnos! - Aryes');
  const [stockMin,setStockMin]=useState(()=>localStorage.getItem('aryes-stock-min-default')||'5');
  const [empresa,setEmpresa]=useState(()=>localStorage.getItem('aryes-empresa')||'Aryes');
  const [msg,setMsg]=useState('');
  const inp={padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:13,fontFamily:'inherit',width:'100%',boxSizing:'border-box'};

  const save=()=>{
    LS.set('aryes9-emailcfg',emailCfg);
    localStorage.setItem('aryes-wa-template',waTpl);
    localStorage.setItem('aryes-stock-min-default',stockMin);
    localStorage.setItem('aryes-empresa',empresa);
    setMsg('Configuracion guardada');
    setTimeout(()=>setMsg(''),3000);
  };

  return(
    <section style={{padding:'28px 36px',maxWidth:800,margin:'0 auto'}}>
      <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:'0 0 4px'}}>Configuracion</h2>
      <p style={{fontSize:12,color:'#888',margin:'0 0 24px'}}>Ajustes generales del sistema</p>
      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {/* General */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 16px'}}>General</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Nombre de la empresa</label>
            <input style={inp} value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Aryes" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>Stock minimo por defecto</label>
            <input type="number" style={inp} value={stockMin} onChange={e=>setStockMin(e.target.value)} min="0" />
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 6px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:'#25d366'}}>&#128233;</span> Plantilla WhatsApp
        </h3>
        <p style={{fontSize:12,color:'#888',margin:'0 0 12px'}}>Variables: <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>{'{cliente}'}</code> nombre del cliente · <code style={{background:'#f3f4f6',padding:'1px 6px',borderRadius:4}}>{'{detalle}'}</code> detalle de la entrega</p>
        <textarea value={waTpl} onChange={e=>setWaTpl(e.target.value)} rows={3} style={{...inp,resize:'vertical'}} />
        <div style={{fontSize:11,color:'#888',marginTop:6}}>Vista previa: <em>{waTpl.replace('{cliente}','Panaderia Lopez').replace('{detalle}','su pedido V-0001 fue entregado hoy')}</em></div>
      </div>

      {/* Email */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 16px'}}>&#128231; Alertas por Email (EmailJS)</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {[
            {l:'Service ID',k:'serviceId',ph:'service_xxx'},
            {l:'Template ID',k:'templateId',ph:'template_xxx'},
            {l:'Public Key',k:'publicKey',ph:'AbCdEf...'},
            {l:'Email destino',k:'toEmail',ph:'admin@aryes.com.uy'},
          ].map(f=>(
            <div key={f.k}>
              <label style={{fontSize:11,fontWeight:600,color:'#666',textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>{f.l}</label>
              <input style={inp} value={emailCfg[f.k]||''} onChange={e=>setEmailCfg(c=>({...c,[f.k]:e.target.value}))} placeholder={f.ph} />
            </div>
          ))}
        </div>
      </div>

      {/* Accesos */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1a1a1a',margin:'0 0 12px'}}>&#128274; Usuarios del sistema</h3>
        <div style={{display:'grid',gap:8}}>
          {[
            {rol:'admin',user:'admin',pass:'aryes2024',color:'#3a7d1e'},
            {rol:'operador',user:'operador',pass:'stock123',color:'#3b82f6'},
            {rol:'vendedor',user:'vendedor',pass:'ventas123',color:'#8b5cf6'},
          ].map(u=>(
            <div key={u.rol} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#f9fafb',borderRadius:8}}>
              <span style={{background:u.color,color:'#fff',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20}}>{u.rol}</span>
              <span style={{fontSize:13,color:'#374151'}}>Usuario: <strong>{u.user}</strong></span>
              <span style={{fontSize:13,color:'#374151'}}>Contrasena: <strong>{u.pass}</strong></span>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:'#aaa',marginTop:8}}>Para cambiar credenciales editar el codigo fuente en AryesApp USERS array.</p>
      </div>

      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <button onClick={save} style={{padding:'10px 28px',background:G,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>Guardar configuracion</button>
      </div>
    </section>
  );
}

function ImportTab(){
  const G="#3a7d1e";
  const KPROD="aryes6-products";
  const [prods,setProds]=useState(()=>LS.get(KPROD,[]));
  const [preview,setPreview]=useState([]);
  const [msg,setMsg]=useState('');
  const [importing,setImporting]=useState(false);
  const [mode,setMode]=useState('csv');

  const parseCSV=(text)=>{
    const lines=text.split('\n').filter(l=>l.trim());
    if(lines.length<2)return[];
    const headers=lines[0].split(/[,;\t]/).map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
    return lines.slice(1).map((line,i)=>{
      const vals=line.split(/[,;\t]/);
      const obj={};
      headers.forEach((h,j)=>obj[h]=(vals[j]||'').trim().replace(/^"|"$/g,''));
      return{
        id:Date.now()+i,
        nombre:obj.nombre||obj.name||obj.producto||obj.descripcion||'Producto '+(i+1),
        stock:Number(obj.stock||obj.cantidad||obj.qty||0),
        unidad:obj.unidad||obj.unit||obj.um||'u',
        precio:Number(obj.precio||obj.price||obj.costo||0),
        rop:Number(obj.rop||obj.stockmin||obj.minimo||5),
        proveedor:obj.proveedor||obj.supplier||obj.marca||'',
      };
    }).filter(p=>p.nombre&&p.nombre!=='Producto 1'||p.stock>0);
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      const text=ev.target.result;
      const parsed=parseCSV(text);
      setPreview(parsed);
      setMsg(parsed.length+' productos detectados. Revisalos antes de importar.');
    };
    reader.readAsText(file,'UTF-8');
  };

  const confirmarImport=()=>{
    if(preview.length===0)return;
    setImporting(true);
    const existing=[...prods];
    let added=0,updated=0;
    preview.forEach(p=>{
      const idx=existing.findIndex(e=>e.nombre?.toLowerCase()===p.nombre?.toLowerCase());
      if(idx>-1){existing[idx]={...existing[idx],...p,id:existing[idx].id};updated++;}
      else{existing.push(p);added++;}
    });
    setProds(existing);
    LS.set(KPROD,existing);
    setPreview([]);
    setMsg(added+' productos agregados, '+updated+' actualizados.');
    setImporting(false);
  };

  const exportCSV=()=>{
    const headers='nombre,stock,unidad,precio,rop,proveedor';
    const rows=prods.map(p=>[p.nombre||p.name||'',p.stock||0,p.unidad||p.unit||'u',p.precio||p.price||0,p.rop||5,p.proveedor||''].join(',')).join('\n');
    const blob=new Blob([headers+'\n'+rows],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='aryes-productos.csv';a.click();
    URL.revokeObjectURL(url);
  };

  return(
    <section style={{padding:'28px 36px',maxWidth:900,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Importar / Exportar</h2>
          <p style={{fontSize:12,color:'#888',margin:'4px 0 0'}}>Importa productos desde CSV o Excel exportado como CSV</p>
        </div>
        <button onClick={exportCSV} style={{padding:'8px 18px',border:'2px solid '+G,background:'#fff',color:G,borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
          &#8659; Exportar productos CSV
        </button>
      </div>

      {msg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,color:G,fontSize:13}}>{msg}</div>}

      {/* Instrucciones */}
      <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:'#92400e',marginBottom:8}}>Como preparar el archivo CSV:</div>
        <div style={{fontSize:13,color:'#78350f',lineHeight:1.7}}>
          1. Abre Excel o Google Sheets<br/>
          2. La primera fila debe tener los encabezados:<br/>
          <code style={{background:'#fef3c7',padding:'2px 8px',borderRadius:4,fontFamily:'monospace',fontSize:12}}>nombre, stock, unidad, precio, rop, proveedor</code><br/>
          3. Guarda como CSV (separado por comas)<br/>
          4. Sube el archivo abajo
        </div>
        <div style={{marginTop:10,fontSize:12,color:'#92400e'}}>
          Columnas reconocidas: <strong>nombre/name/producto/descripcion, stock/cantidad/qty, unidad/unit/um, precio/price/costo, rop/stockmin/minimo, proveedor/supplier/marca</strong>
        </div>
      </div>

      {/* Upload */}
      <div style={{background:'#fff',borderRadius:12,padding:24,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:20,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:8}}>&#128196;</div>
        <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:16}}>Seleccionar archivo CSV</div>
        <input type="file" accept=".csv,.txt" onChange={handleFile}
          style={{display:'block',margin:'0 auto',padding:'10px',border:'2px dashed #e5e7eb',borderRadius:8,cursor:'pointer',width:'100%',maxWidth:400,fontSize:13}} />
        <div style={{fontSize:11,color:'#aaa',marginTop:8}}>Formatos: .csv · Separador: coma, punto y coma, o tab</div>
      </div>

      {/* Preview */}
      {preview.length>0&&(
        <div style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:16}}>
          <div style={{padding:'12px 16px',background:'#f9fafb',borderBottom:'2px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,color:'#374151'}}>Vista previa — {preview.length} productos</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setPreview([])} style={{padding:'6px 14px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={confirmarImport} disabled={importing} style={{padding:'6px 18px',background:G,color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:12}}>
                {importing?'Importando...':'Confirmar importacion'}
              </button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {['Nombre','Stock','Unidad','Precio','Stock min','Proveedor'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#6b7280',fontSize:11,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0,20).map((p,i)=>(
                  <tr key={i} style={{borderTop:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                    <td style={{padding:'7px 12px',fontWeight:500,color:'#1a1a1a'}}>{p.nombre}</td>
                    <td style={{padding:'7px 12px',fontWeight:700,color:G}}>{p.stock}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.unidad}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.precio>0?'$'+p.precio:'-'}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.rop}</td>
                    <td style={{padding:'7px 12px',color:'#6b7280'}}>{p.proveedor||'-'}</td>
                  </tr>
                ))}
                {preview.length>20&&<tr><td colSpan='6' style={{padding:'8px 12px',color:'#888',fontStyle:'italic',textAlign:'center'}}>...y {preview.length-20} mas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{background:'#fff',borderRadius:10,padding:'16px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.04)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,color:'#6b7280'}}>Productos actualmente en el sistema:</span>
        <span style={{fontSize:22,fontWeight:800,color:G}}>{prods.length}</span>
      </div>
    </section>
  );
}
function InformesTab(){
  const G="#3a7d1e";
  const [prods]=useState(()=>LS.get("aryes6-products",[]));
  const [movs]=useState(()=>LS.get("aryes-movements",[]));
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [rutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [lotes]=useState(()=>LS.get("aryes-lots",[]));
  const [clientes]=useState(()=>LS.get("aryes-clients",[]));
  const [recepciones]=useState(()=>LS.get("aryes-recepciones",[]));
  const [periodo,setPeriodo]=useState("mes");
  const [msg,setMsg]=useState("");
  const hoy=new Date();
  const diasAtras=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return d;};
  const periodoStart=periodo==="semana"?diasAtras(7):periodo==="mes"?diasAtras(30):diasAtras(90);
  const movsP=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=periodoStart);
  const ventasP=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=periodoStart);
  const diasVenc=(f)=>Math.ceil((new Date(f)-hoy)/(1000*60*60*24));
  const toCSV=(headers,rows)=>headers.join(",")+"\n"+rows.map(r=>r.map(c=>'"'+( c||"").toString().replace(/"/g,'""')+'"').join(",")).join("\n");
  const downloadCSV=(content,filename)=>{const blob=new Blob(["﻿"+content],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);setMsg("Descargando "+filename);setTimeout(()=>setMsg(""),3000);};
  const exportStock=()=>{const h=["Producto","Stock","Unidad","Precio","Stock Min","Proveedor","Estado"];const rows=prods.map(p=>[p.nombre||p.name||"",p.stock||0,p.unidad||p.unit||"u",p.precio||p.price||0,p.rop||5,p.proveedor||"",Number(p.stock||0)===0?"Sin stock":Number(p.stock||0)<=(p.rop||5)?"Critico":"OK"]);downloadCSV(toCSV(h,rows),"stock-"+hoy.toISOString().split("T")[0]+".csv");};
  const exportMovimientos=()=>{const h=["Fecha","Tipo","Producto","Cantidad","Notas"];const rows=movsP.map(m=>[m.timestamp?new Date(m.timestamp).toLocaleDateString("es-UY"):"",m.tipo||"",m.productoNombre||m.nombre||"",m.cantidad||0,m.notas||""]);downloadCSV(toCSV(h,rows),"movimientos-"+periodo+".csv");};
  const exportVentas=()=>{const h=["N Venta","Fecha","Cliente","Productos","Total","Estado"];const rows=ventasP.map(v=>[v.nroVenta||"",v.fecha||"",v.clienteNombre||"",v.items?.length||0,"$"+(v.total||0),v.estado||""]);downloadCSV(toCSV(h,rows),"ventas-"+periodo+".csv");};
  const exportLotes=()=>{const h=["Producto","Lote","Cantidad","Vencimiento","Dias","Estado"];const rows=lotes.map(l=>{const d=l.fechaVenc?diasVenc(l.fechaVenc):null;return[l.productoNombre||"",l.lote||"",l.cantidad||0,l.fechaVenc||"",d!==null?d:"",!l.fechaVenc?"Sin fecha":d<0?"VENCIDO":d<=7?"URGENTE":d<=30?"PROXIMO":"OK"];});downloadCSV(toCSV(h,rows),"lotes.csv");};
  const exportClientes=()=>{const h=["Nombre","Tipo","Ciudad","Telefono","Email"];const rows=clientes.map(c=>[c.nombre||"",c.tipo||"",c.ciudad||"",c.telefono||"",c.email||""]);downloadCSV(toCSV(h,rows),"clientes.csv");};
  const exportEntregas=()=>{const h=["Vehiculo","Zona","Dia","Cliente","Estado","Hora"];const rows=rutas.flatMap(r=>(r.entregas||[]).map(e=>[r.vehiculo||"",r.zona||"",r.dia||"",e.clienteNombre||"",e.estado||"",e.hora||""]));downloadCSV(toCSV(h,rows),"entregas.csv");};
  const imprimirRemito=(venta)=>{
    const emp=localStorage.getItem("aryes-empresa")||"Aryes";
    const its=venta.items||[];
    const rows=its.map(it=>"<tr><td>"+it.nombre+"</td><td>"+it.cantidad+" "+it.unidad+"</td><td>$"+Number(it.precioUnit).toLocaleString("es-UY")+"</td><td>$"+Number(it.cantidad*it.precioUnit).toLocaleString("es-UY")+"</td></tr>").join("");
    const desc=Number(venta.descuento)>0?"<p style=\"text-align:right;color:#92400e\">Descuento "+venta.descuento+"%</p>":"";
    const html="<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Remito "+venta.nroVenta+"</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #3a7d1e;padding-bottom:16px;margin-bottom:24px;}.emp{font-size:22px;font-weight:700;color:#3a7d1e;}table{width:100%;border-collapse:collapse;margin:16px 0;}th{background:#3a7d1e;color:#fff;padding:9px;text-align:left;font-size:13px;}td{padding:8px 9px;border-bottom:1px solid #eee;font-size:13px;}.tot{text-align:right;font-size:18px;font-weight:700;color:#3a7d1e;margin-top:8px;}.ftr{margin-top:40px;border-top:1px solid #eee;padding-top:12px;font-size:11px;color:#aaa;text-align:center;}</style></head><body><div class='hdr'><div><div class='emp'>"+emp+"</div></div><div style='text-align:right'><b>REMITO "+venta.nroVenta+"</b><br>"+venta.fecha+"<br><span style='font-size:11px;padding:2px 8px;background:#f0fdf4;border-radius:4px;color:#3a7d1e;font-weight:700'>"+(venta.estado||"").toUpperCase()+"</span></div></div><p><b>Cliente:</b> "+venta.clienteNombre+"</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>"+rows+"</tbody></table>"+desc+"<div class='tot'>TOTAL: $"+Number(venta.total||0).toLocaleString("es-UY")+"</div><div class='ftr'>"+emp+" · "+new Date().toLocaleDateString("es-UY")+"</div><script>window.onload=function(){window.print();}<" + "/script></body></html>";
    const w=window.open("","_blank","noopener,noreferrer");if(w){w.document.write(html);w.document.close();}
  };
  const stockCritico=prods.filter(p=>Number(p.stock||0)<=Number(p.rop||5)&&Number(p.stock||0)>0).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const vencidosCount=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)<0).length;
  const proxCount=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)>=0&&diasVenc(l.fechaVenc)<=30).length;
  const totalVentasMes=ventasP.filter(v=>v.estado!=="cancelada").reduce((a,v)=>a+Number(v.total||0),0);
  const entregasTotal=rutas.flatMap(r=>r.entregas||[]).length;
  const entregasOk=rutas.flatMap(r=>r.entregas||[]).filter(e=>e.estado==="entregado").length;
  const BTN=({label,icon,onClick})=>(
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#fff",border:"2px solid #3a7d1e",borderRadius:10,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left",marginBottom:8}}>
      <span style={{fontSize:20}}>{icon}</span>
      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>{label}</div><div style={{fontSize:11,color:"#888"}}>Exportar CSV</div></div>
      <span style={{fontSize:16,color:"#3a7d1e"}}>&#8659;</span>
    </button>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Informes</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Reportes y exportacion de datos</p></div>
        <div style={{display:"flex",gap:6}}>{["semana","mes","trimestre"].map(p=>(
          <button key={p} onClick={()=>setPeriodo(p)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===p?"#3a7d1e":"#e5e7eb"),background:periodo===p?"#3a7d1e":"#fff",color:periodo===p?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>
            {p==="semana"?"7 dias":p==="mes"?"30 dias":"90 dias"}</button>))}</div></div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#3a7d1e",fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28}}>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(stockCritico>0?"#ef4444":"transparent")}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Total productos</div>
          <div style={{fontSize:26,fontWeight:800,color:stockCritico>0?"#ef4444":"#3a7d1e"}}>{prods.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{stockCritico} criticos · {sinStock} sin stock</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Ventas periodo</div>
          <div style={{fontSize:26,fontWeight:800,color:"#3a7d1e"}}>{ventasP.length}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>${totalVentasMes.toLocaleString("es-UY")} facturado</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(vencidosCount>0?"#ef4444":"transparent")}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Lotes por vencer</div>
          <div style={{fontSize:26,fontWeight:800,color:vencidosCount>0?"#ef4444":"#f59e0b"}}>{proxCount}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{vencidosCount} ya vencidos</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Entregas</div>
          <div style={{fontSize:26,fontWeight:800,color:"#3a7d1e"}}>{entregasOk}/{entregasTotal}</div>
          <div style={{fontSize:11,color:"#888",marginTop:3}}>{entregasTotal>0?Math.round(entregasOk/entregasTotal*100):0}% efectividad</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Exportar datos</h3>
          <BTN label="Stock completo" icon="📦" onClick={exportStock} />
          <BTN label={"Movimientos ("+periodo+")"} icon="🔄" onClick={exportMovimientos} />
          <BTN label={"Ventas ("+periodo+")"} icon="🧾" onClick={exportVentas} />
          <BTN label="Lotes y vencimientos" icon="📅" onClick={exportLotes} />
          <BTN label="Clientes" icon="👥" onClick={exportClientes} />
          <BTN label="Historial de entregas" icon="🚛" onClick={exportEntregas} />
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Imprimir remitos</h3>
          {ventas.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>No hay ordenes de venta aun</div>):(
          <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {ventas.slice(0,12).map((v,i)=>(
              <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#3a7d1e"}}>{v.nroVenta}</div>
                  <div style={{fontSize:11,color:"#666"}}>{v.clienteNombre} · {v.fecha}</div>
                </div>
                <div style={{fontWeight:700,fontSize:13}}>${Number(v.total||0).toLocaleString("es-UY")}</div>
                <button onClick={()=>imprimirRemito(v)} style={{padding:"5px 12px",background:"#3a7d1e",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>
                  Imprimir</button>
              </div>))}
            {ventas.length>12&&<div style={{padding:"8px 14px",fontSize:12,color:"#888",textAlign:"center"}}>...y {ventas.length-12} mas</div>}
          </div>)}
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"20px 0 12px"}}>Stock critico</h3>
          {prods.filter(p=>Number(p.stock||0)<=(p.rop||5)).length===0?(
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:16,fontSize:13,color:"#3a7d1e",textAlign:"center"}}>Todo el stock esta OK ✓</div>
          ):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {prods.filter(p=>Number(p.stock||0)<=(p.rop||5)).slice(0,8).map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid #f3f4f6",background:Number(p.stock||0)===0?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>{p.nombre||p.name}</span>
                  <span style={{fontWeight:800,fontSize:14,color:Number(p.stock||0)===0?"#dc2626":"#f59e0b"}}>{p.stock||0}</span>
                  <span style={{fontSize:11,color:"#888",marginLeft:4}}>{p.unidad||p.unit||"u"}</span>
                </div>))}
            </div>)}
        </div>
      </div>
    </section>
  );
}
function ConteoTab(){
  const G="#3a7d1e";
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [conteos,setConteos]=useState(()=>LS.get("aryes-conteos",[]));
  const [conteoActivo,setConteoActivo]=useState(null);
  const [itemIdx,setItemIdx]=useState(0);
  const [cantFisica,setCantFisica]=useState("");
  const [msg,setMsg]=useState("");
  const [vista,setVista]=useState("inicio");

  const iniciarConteo=()=>{
    const items=prods.map(p=>({id:p.id,nombre:p.nombre||p.name||"",stockSistema:Number(p.stock||0),unidad:p.unidad||p.unit||"u",cantFisica:null,diferencia:null}));
    const c={id:Date.now(),fecha:new Date().toISOString().split("T")[0],items,completado:false,creadoEn:new Date().toISOString()};
    setConteoActivo(c);setItemIdx(0);setCantFisica("");setVista("conteo");
  };

  const registrarItem=()=>{
    if(cantFisica==="")return;
    const cant=Number(cantFisica);
    const upd={...conteoActivo};
    upd.items[itemIdx]={...upd.items[itemIdx],cantFisica:cant,diferencia:cant-upd.items[itemIdx].stockSistema};
    setConteoActivo(upd);
    if(itemIdx<upd.items.length-1){setItemIdx(itemIdx+1);setCantFisica("");}
    else{setVista("revision");}
  };

  const saltarItem=()=>{
    if(itemIdx<conteoActivo.items.length-1){setItemIdx(itemIdx+1);setCantFisica("");}
    else setVista("revision");
  };

  const confirmarConteo=()=>{
    // Update stock with physical count
    let updProds=[...prods];
    conteoActivo.items.filter(it=>it.cantFisica!==null).forEach(it=>{
      const idx=updProds.findIndex(p=>String(p.id)===String(it.id));
      if(idx>-1)updProds[idx]={...updProds[idx],stock:it.cantFisica};
    });
    setProds(updProds);LS.set("aryes6-products",updProds);
    const finalConteo={...conteoActivo,completado:true,finalizadoEn:new Date().toISOString()};
    const upd=[finalConteo,...conteos];
    setConteos(upd);LS.set("aryes-conteos",upd);
    setConteoActivo(null);setVista("inicio");
    setMsg("Conteo aplicado. Stock actualizado en "+conteoActivo.items.filter(it=>it.cantFisica!==null).length+" productos.");
    setTimeout(()=>setMsg(""),5000);
  };

  const pct=conteoActivo?Math.round(conteoActivo.items.filter(it=>it.cantFisica!==null).length/conteoActivo.items.length*100):0;

  if(vista==="conteo"&&conteoActivo){
    const item=conteoActivo.items[itemIdx];
    return(
      <section style={{padding:"28px 36px",maxWidth:600,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setVista("revision")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Conteo fisico</h2>
        </div>
        <div style={{background:"#e5e7eb",borderRadius:99,height:8,marginBottom:20,overflow:"hidden"}}>
          <div style={{width:pct+"%",background:G,height:"100%",borderRadius:99,transition:"width .3s"}} />
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:28,boxShadow:"0 2px 12px rgba(0,0,0,.08)",textAlign:"center"}}>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>{itemIdx+1} de {conteoActivo.items.length}</div>
          <div style={{fontSize:26,fontWeight:800,color:"#1a1a1a",marginBottom:4}}>{item.nombre}</div>
          <div style={{fontSize:14,color:"#888",marginBottom:24}}>Sistema dice: <strong style={{color:G}}>{item.stockSistema} {item.unidad}</strong></div>
          <div style={{fontSize:13,color:"#666",marginBottom:8}}>Cantidad fisica contada:</div>
          <input type="number" value={cantFisica} onChange={e=>setCantFisica(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&registrarItem()}
            autoFocus min="0" placeholder="0"
            style={{fontSize:36,fontWeight:700,textAlign:"center",width:160,padding:"10px",border:"2px solid #3a7d1e",borderRadius:10,outline:"none",fontFamily:"inherit"}} />
          <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:20}}>
            <button onClick={saltarItem} style={{padding:"10px 24px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Saltar</button>
            <button onClick={registrarItem} disabled={cantFisica===""} style={{padding:"10px 32px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:15}}>Confirmar &#10003;</button>
          </div>
        </div>
      </section>
    );
  }

  if(vista==="revision"&&conteoActivo){
    const difs=conteoActivo.items.filter(it=>it.cantFisica!==null&&it.diferencia!==0);
    const contados=conteoActivo.items.filter(it=>it.cantFisica!==null).length;
    return(
      <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setVista("conteo")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
          <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Revision del conteo</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Contados</div>
            <div style={{fontSize:28,fontWeight:800,color:G}}>{contados}</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Con diferencia</div>
            <div style={{fontSize:28,fontWeight:800,color:difs.length>0?"#ef4444":"#3a7d1e"}}>{difs.length}</div></div>
          <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5}}>Sin contar</div>
            <div style={{fontSize:28,fontWeight:800,color:"#6b7280"}}>{conteoActivo.items.length-contados}</div></div>
        </div>
        {difs.length>0&&(
          <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
            <div style={{padding:"10px 16px",background:"#fef2f2",borderBottom:"2px solid #fecaca",fontWeight:700,color:"#dc2626",fontSize:13}}>Diferencias encontradas</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:"#f9fafb"}}>{["Producto","Sistema","Fisico","Diferencia"].map(h=><th key={h} style={{padding:"8px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead>
              <tbody>{difs.map((it,i)=>(<tr key={it.id} style={{borderTop:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",fontWeight:500}}>{it.nombre}</td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>{it.stockSistema} {it.unidad}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:"#3a7d1e"}}>{it.cantFisica} {it.unidad}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:it.diferencia>0?"#059669":"#dc2626"}}>{it.diferencia>0?"+":""}{it.diferencia}</td>
              </tr>))}</tbody>
            </table>
          </div>
        )}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setVista("conteo")} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Seguir contando</button>
          <button onClick={confirmarConteo} style={{padding:"10px 28px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Aplicar conteo al stock</button>
        </div>
      </section>
    );
  }

  return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Conteo Ciclico</h2>
      <p style={{fontSize:12,color:"#888",margin:"0 0 24px"}}>Verificacion fisica del inventario vs sistema</p>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>&#128203;</div>
          <div style={{fontSize:16,fontWeight:700,color:"#1a1a1a",marginBottom:8}}>Nuevo conteo</div>
          <div style={{fontSize:13,color:"#888",marginBottom:16}}>Recorre producto por producto confirmando la cantidad fisica en el deposito</div>
          <button onClick={iniciarConteo} style={{padding:"10px 24px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Iniciar conteo ({prods.length} productos)</button>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial de conteos</div>
          {conteos.length===0?(<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin conteos previos</div>):(
            conteos.slice(0,5).map((c,i)=>{
              const difs=c.items?.filter(it=>it.cantFisica!==null&&it.diferencia!==0).length||0;
              return(<div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{c.fecha}</div><div style={{fontSize:11,color:"#888"}}>{c.items?.filter(it=>it.cantFisica!==null).length||0} contados</div></div>
                <span style={{background:difs>0?"#fef2f2":"#f0fdf4",color:difs>0?"#dc2626":G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{difs>0?difs+" difs":"OK"}</span>
              </div>);
            })
          )}
        </div>
      </div>
    </section>
  );
}
function PackingTab(){
  const G="#3a7d1e";
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [prods]=useState(()=>LS.get("aryes6-products",[]));
  const [packings,setPackings]=useState(()=>LS.get("aryes-packings",[]));
  const [sel,setSel]=useState(null);
  const [validados,setValidados]=useState({});
  const [bultos,setBultos]=useState(1);
  const [notas,setNotas]=useState("");
  const [msg,setMsg]=useState("");

  // Only ventas confirmadas/preparadas que no tienen packing aun
  const pendPacking=ventas.filter(v=>["confirmada","preparada"].includes(v.estado)&&!packings.find(p=>p.ventaId===v.id&&p.estado==="listo"));

  const iniciarPacking=(venta)=>{
    setSel(venta);
    const init={};
    (venta.items||[]).forEach(it=>init[it.productoId||it.nombre]={validado:false,cantReal:it.cantidad});
    setValidados(init);setBultos(1);setNotas("");
  };

  const toggleValidar=(key)=>setValidados(v=>({...v,[key]:{...v[key],validado:!v[key].validado}}));
  const todosValidados=sel&&Object.values(validados).every(v=>v.validado);

  const confirmarPacking=()=>{
    if(!todosValidados){setMsg("Debes validar todos los items antes de confirmar");return;}
    const pk={id:Date.now(),ventaId:sel.id,nroVenta:sel.nroVenta,clienteNombre:sel.clienteNombre,
      items:sel.items,bultos,notas,estado:"listo",fecha:new Date().toLocaleDateString("es-UY"),creadoEn:new Date().toISOString()};
    const upd=[pk,...packings];
    setPackings(upd);LS.set("aryes-packings",upd);
    setSel(null);
    setMsg("Packing "+sel.nroVenta+" confirmado. Listo para despacho.");
    setTimeout(()=>setMsg(""),4000);
  };

  if(sel)return(
    <section style={{padding:"28px 36px",maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Packing — {sel.nroVenta}</h2>
      </div>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{fontSize:13,color:"#888",marginBottom:12}}>Cliente: <strong style={{color:"#1a1a1a"}}>{sel.clienteNombre}</strong> · Fecha: {sel.fecha}</div>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>Validar items uno a uno:</div>
        {(sel.items||[]).map(it=>{
          const key=it.productoId||it.nombre;
          const v=validados[key];
          return(
            <div key={key} onClick={()=>toggleValidar(key)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:8,marginBottom:8,cursor:"pointer",background:v?.validado?"#f0fdf4":"#f9fafb",border:"2px solid "+(v?.validado?"#3a7d1e":"#e5e7eb"),transition:"all .15s"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:v?.validado?"#3a7d1e":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,flexShrink:0}}>{v?.validado?"✓":""}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>{it.nombre}</div>
                <div style={{fontSize:12,color:"#888"}}>{it.cantidad} {it.unidad}</div>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:v?.validado?"#3a7d1e":"#9ca3af"}}>{v?.validado?"VALIDADO":"Tocar para validar"}</span>
            </div>
          );
        })}
        <div style={{display:"flex",gap:12,marginTop:14,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Numero de bultos</label>
            <input type="number" value={bultos} onChange={e=>setBultos(e.target.value)} min="1" style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:14,fontFamily:"inherit",width:80}} />
          </div>
          <div style={{flex:3}}>
            <label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Notas del packing</label>
            <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: frágil, cadena de frío..." style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}} />
          </div>
        </div>
      </div>
      <div style={{background:todosValidados?"#f0fdf4":"#f9fafb",border:"2px solid "+(todosValidados?"#3a7d1e":"#e5e7eb"),borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:todosValidados?"#3a7d1e":"#9ca3af",fontWeight:600,textAlign:"center"}}>
        {todosValidados?"✓ Todos los items validados — listo para confirmar":"Validá todos los items para habilitar la confirmacion"}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setSel(null)} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarPacking} disabled={!todosValidados} style={{padding:"10px 28px",background:todosValidados?"#3a7d1e":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:todosValidados?"pointer":"not-allowed",fontWeight:700,fontSize:14}}>Confirmar packing</button>
      </div>
    </section>
  );

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Packing / Preparacion</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Validar items antes del despacho — evita errores de entrega</p>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Ordenes para preparar ({pendPacking.length})</h3>
      {pendPacking.length===0?(<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:20,fontSize:13,color:G,textAlign:"center"}}>No hay ordenes pendientes de packing</div>):(
        <div style={{display:"grid",gap:10}}>
          {pendPacking.map(v=>(
            <div key={v.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:14}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:G}}>{v.nroVenta}</div><div style={{fontSize:12,color:"#666"}}>{v.clienteNombre} · {v.items?.length||0} productos · ${Number(v.total||0).toLocaleString("es-UY")}</div></div>
              <span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,textTransform:"capitalize"}}>{v.estado}</span>
              <button onClick={()=>iniciarPacking(v)} style={{padding:"8px 18px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Preparar</button>
            </div>
          ))}
        </div>
      )}
      {packings.length>0&&(
        <div style={{marginTop:24}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial de packings</h3>
          <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
            {packings.slice(0,8).map((pk,i)=>(
              <div key={pk.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:G}}>{pk.nroVenta}</div><div style={{fontSize:11,color:"#666"}}>{pk.clienteNombre} · {pk.fecha}</div></div>
                <div style={{fontSize:12,color:"#888"}}>{pk.bultos} bulto{pk.bultos>1?"s":""}</div>
                <span style={{background:"#f0fdf4",color:G,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>Listo</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
function BatchPickingTab(){
  const G="#3a7d1e";
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [selIds,setSelIds]=useState([]);
  const [picking,setPicking]=useState(null);
  const [recolectados,setRecolectados]=useState({});
  const [msg,setMsg]=useState("");

  const pendientes=ventas.filter(v=>["confirmada","preparada"].includes(v.estado));

  const toggleSel=(id)=>setSelIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const generarBatch=()=>{
    if(selIds.length===0)return;
    const selVentas=ventas.filter(v=>selIds.includes(v.id));
    // Consolidar items: agrupar por producto sumando cantidades
    const mapa={};
    selVentas.forEach(v=>{
      (v.items||[]).forEach(it=>{
        const key=it.productoId||it.nombre;
        if(!mapa[key])mapa[key]={nombre:it.nombre,unidad:it.unidad,cantTotal:0,pedidos:[]};
        mapa[key].cantTotal+=Number(it.cantidad);
        mapa[key].pedidos.push({nroVenta:v.nroVenta,clienteNombre:v.clienteNombre,cantidad:it.cantidad});
      });
    });
    const items=Object.entries(mapa).map(([k,v])=>({key:k,...v}));
    const init={};items.forEach(it=>init[it.key]=false);
    setPicking({id:Date.now(),ventas:selVentas,items,creadoEn:new Date().toISOString()});
    setRecolectados(init);
  };

  const toggleRecolectado=(key)=>setRecolectados(r=>({...r,[key]:!r[key]}));
  const todoRecolectado=picking&&Object.values(recolectados).every(Boolean);
  const pct=picking?Math.round(Object.values(recolectados).filter(Boolean).length/picking.items.length*100):0;

  const confirmarBatch=()=>{
    // Descontar stock
    let updProds=[...prods];
    picking.items.forEach(it=>{
      const idx=updProds.findIndex(p=>(p.nombre||p.name)===it.nombre);
      if(idx>-1){
        const nuevo=Math.max(0,Number(updProds[idx].stock||0)-it.cantTotal);
        updProds[idx]={...updProds[idx],stock:nuevo};
      }
    });
    setProds(updProds);LS.set("aryes6-products",updProds);
    const n=picking.ventas.length;
    setPicking(null);setSelIds([]);
    setMsg("Batch completado. Stock descontado para "+n+" ordenes.");
    setTimeout(()=>setMsg(""),4000);
  };

  if(picking)return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>setPicking(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Batch Picking — {picking.ventas.length} ordenes</h2>
      </div>
      <div style={{background:"#e5e7eb",borderRadius:99,height:8,marginBottom:20,overflow:"hidden"}}>
        <div style={{width:pct+"%",background:G,height:"100%",borderRadius:99,transition:"width .3s"}} />
      </div>
      <div style={{fontSize:12,color:"#888",marginBottom:16}}>
        Ordenes: {picking.ventas.map(v=><span key={v.id} style={{background:"#f0fdf4",color:G,padding:"1px 8px",borderRadius:20,marginRight:4,fontSize:11,fontWeight:700}}>{v.nroVenta}</span>)}
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{padding:"10px 16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",fontSize:12,color:"#888",fontWeight:600,display:"grid",gridTemplateColumns:"1fr auto auto",gap:10}}>
          <span>PRODUCTO</span><span>TOTAL</span><span>ESTADO</span>
        </div>
        {picking.items.map(it=>(
          <div key={it.key} onClick={()=>toggleRecolectado(it.key)} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:10,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #f3f4f6",cursor:"pointer",background:recolectados[it.key]?"#f0fdf4":"#fff",transition:"background .15s"}}>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:"#1a1a1a"}}>{it.nombre}</div>
              <div style={{fontSize:11,color:"#888"}}>{it.pedidos.map(p=>p.nroVenta+": "+p.cantidad).join(" · ")}</div>
            </div>
            <div style={{fontWeight:800,fontSize:16,color:G}}>{it.cantTotal} {it.unidad}</div>
            <div style={{width:28,height:28,borderRadius:"50%",background:recolectados[it.key]?"#3a7d1e":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,flexShrink:0}}>{recolectados[it.key]?"✓":""}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setPicking(null)} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarBatch} disabled={!todoRecolectado} style={{padding:"10px 28px",background:todoRecolectado?"#3a7d1e":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:todoRecolectado?"pointer":"not-allowed",fontWeight:700,fontSize:14}}>Confirmar y descontar stock</button>
      </div>
    </section>
  );

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Batch Picking</h2>
      <p style={{fontSize:12,color:"#888",margin:"0 0 20px"}}>Recolectar multiples ordenes en un solo recorrido del deposito</p>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700,color:"#374151"}}>{selIds.length>0?selIds.length+" ordenes seleccionadas":"Selecciona ordenes para hacer batch"}</div>
        <button onClick={generarBatch} disabled={selIds.length===0} style={{padding:"8px 20px",background:selIds.length>0?"#3a7d1e":"#d1d5db",color:"#fff",border:"none",borderRadius:8,cursor:selIds.length>0?"pointer":"not-allowed",fontWeight:700,fontSize:13}}>Generar batch &#8594;</button>
      </div>
      {pendientes.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>No hay ordenes pendientes</div>):(
        <div style={{display:"grid",gap:8}}>
          {pendientes.map(v=>(
            <div key={v.id} onClick={()=>toggleSel(v.id)} style={{background:selIds.includes(v.id)?"#f0fdf4":"#fff",border:"2px solid "+(selIds.includes(v.id)?"#3a7d1e":"#e5e7eb"),borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
              <div style={{width:22,height:22,borderRadius:4,background:selIds.includes(v.id)?"#3a7d1e":"#e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,flexShrink:0}}>{selIds.includes(v.id)?"✓":""}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:"#3a7d1e"}}>{v.nroVenta}</div><div style={{fontSize:12,color:"#666"}}>{v.clienteNombre} · {v.items?.length||0} productos</div></div>
              <div style={{fontWeight:700,fontSize:14}}>${Number(v.total||0).toLocaleString("es-UY")}</div>
              <span style={{background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,textTransform:"capitalize"}}>{v.estado}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function TransferenciasTab(){
  const G="#3a7d1e";
  const [prods]=useState(()=>LS.get("aryes6-products",[]));
  const [ubicaciones]=useState(()=>LS.get("aryes-ubicaciones",[]));
  const [deposito]=useState(()=>LS.get("aryes-deposito",{}));
  const [transfers,setTransfers]=useState(()=>LS.get("aryes-transfers",[]));
  const [form,setForm]=useState({productoId:"",cantidad:"",origen:"",destino:"",notas:""});
  const [msg,setMsg]=useState("");
  const [showForm,setShowForm]=useState(false);

  // Build list of locations from deposito
  const locs=Object.values(deposito||{}).filter(l=>l&&l.codigo);

  const selProd=prods.find(p=>String(p.id)===String(form.productoId));

  const guardarTransfer=()=>{
    if(!form.productoId||!form.cantidad||!form.origen||!form.destino){
      setMsg("Completa todos los campos requeridos");return;
    }
    if(form.origen===form.destino){setMsg("Origen y destino no pueden ser iguales");return;}
    if(Number(form.cantidad)<=0){setMsg("La cantidad debe ser mayor a 0");return;}
    const t={id:Date.now(),
      productoId:form.productoId,
      productoNombre:selProd?selProd.nombre||selProd.name:"",
      cantidad:Number(form.cantidad),
      origen:form.origen,
      destino:form.destino,
      notas:form.notas,
      fecha:new Date().toLocaleDateString("es-UY"),
      creadoEn:new Date().toISOString()};
    const upd=[t,...transfers];
    setTransfers(upd);LS.set("aryes-transfers",upd);
    setForm({productoId:"",cantidad:"",origen:"",destino:"",notas:""});
    setShowForm(false);
    setMsg("Transferencia registrada: "+t.productoNombre+" de "+t.origen+" a "+t.destino);
    setTimeout(()=>setMsg(""),4000);
  };

  const F=({label,children,req})=>(
    <div style={{marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:5}}>{label}{req&&<span style={{color:"#ef4444",marginLeft:2}}>*</span>}</label>
      {children}
    </div>
  );
  const inp={padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:7,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};

  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Transferencias Internas</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Mover productos entre ubicaciones del deposito</p></div>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:"10px 20px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>
          {showForm?"Cancelar":"+ Nueva transferencia"}</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}

      {showForm&&(
        <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,.08)",marginBottom:24}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#1a1a1a",marginTop:0,marginBottom:16}}>Nueva transferencia</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={{gridColumn:"1 / -1"}}>
              <F label="Producto" req>
                <select value={form.productoId} onChange={e=>setForm(f=>({...f,productoId:e.target.value}))} style={{...inp}}>
                  <option value="">Seleccionar producto...</option>
                  {prods.map(p=><option key={p.id} value={p.id}>{p.nombre||p.name} ({p.stock||0} {p.unidad||p.unit||"u"} disponibles)</option>)}
                </select>
              </F>
            </div>
            <F label="Cantidad" req>
              <input type="number" value={form.cantidad} onChange={e=>setForm(f=>({...f,cantidad:e.target.value}))} placeholder="0" min="1" style={{...inp}} />
            </F>
            <div/>
            <F label="Ubicacion origen" req>
              <select value={form.origen} onChange={e=>setForm(f=>({...f,origen:e.target.value}))} style={{...inp}}>
                <option value="">Seleccionar origen...</option>
                {locs.length>0?locs.map(l=><option key={l.codigo} value={l.codigo}>{l.codigo}</option>):
                  ["A-1-1","A-1-2","A-2-1","B-1-1","B-1-2","C-1-1"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <F label="Ubicacion destino" req>
              <select value={form.destino} onChange={e=>setForm(f=>({...f,destino:e.target.value}))} style={{...inp}}>
                <option value="">Seleccionar destino...</option>
                {locs.length>0?locs.map(l=><option key={l.codigo} value={l.codigo}>{l.codigo}</option>):
                  ["A-1-1","A-1-2","A-2-1","B-1-1","B-1-2","C-1-1"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </F>
            <div style={{gridColumn:"1 / -1"}}>
              <F label="Notas">
                <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Motivo del movimiento..." style={{...inp}} />
              </F>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}>
            <button onClick={()=>{setShowForm(false);setForm({productoId:"",cantidad:"",origen:"",destino:"",notas:""}); }} style={{padding:"9px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={guardarTransfer} style={{padding:"9px 24px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Registrar transferencia</button>
          </div>
        </div>
      )}

      <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",marginBottom:12}}>Historial</h3>
      {transfers.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:24,textAlign:"center",color:"#888",fontSize:13}}>No hay transferencias registradas</div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb"}}>{["Fecha","Producto","Cantidad","Origen","Destino","Notas"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead>
            <tbody>{transfers.slice(0,20).map((t,i)=>(
              <tr key={t.id} style={{borderTop:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",color:"#888"}}>{t.fecha}</td>
                <td style={{padding:"9px 14px",fontWeight:600}}>{t.productoNombre}</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:G}}>{t.cantidad}</td>
                <td style={{padding:"9px 14px"}}><span style={{background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{t.origen}</span></td>
                <td style={{padding:"9px 14px"}}><span style={{background:"#f0fdf4",color:G,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{t.destino}</span></td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>{t.notas||"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function InventarioTab(){
  const G="#3a7d1e";
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [busq,setBusq]=useState("");
  const [marca,setMarca]=useState("todas");
  const [soloStock,setSoloStock]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({});
  const [msg,setMsg]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const marcas=["todas",...new Set(prods.map(p=>p.marca||p.brand||"Sin marca").filter(Boolean))].slice(0,20);
  const filtered=prods.filter(p=>{
    const n=(p.nombre||p.name||"").toLowerCase();
    if(busq&&!n.includes(busq.toLowerCase()))return false;
    if(marca!=="todas"&&(p.marca||p.brand||"Sin marca")!==marca)return false;
    if(soloStock&&Number(p.stock||0)<=0)return false;
    return true;
  });
  const stockCrit=prods.filter(p=>Number(p.stock||0)>0&&Number(p.stock||0)<=(p.rop||5)).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const totalValor=prods.reduce((a,p)=>a+Number(p.stock||0)*Number(p.precio||p.price||0),0);
  const startEdit=(p)=>{setEditId(p.id);setForm({nombre:p.nombre||p.name||"",stock:p.stock||0,precio:p.precio||p.price||0,unidad:p.unidad||p.unit||"u",rop:p.rop||5,proveedor:p.proveedor||""});};
  const saveEdit=(id)=>{
    const upd=prods.map(p=>p.id===id?{...p,...form,nombre:form.nombre,name:form.nombre,precio:Number(form.precio),price:Number(form.precio),stock:Number(form.stock),rop:Number(form.rop)}:p);
    setProds(upd);LS.set("aryes6-products",upd);setEditId(null);setMsg("Guardado");setTimeout(()=>setMsg(""),2000);
  };
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Inventario</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>{prods.length} productos · {filtered.length} visibles</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {stockCrit>0&&<span style={{background:"#fffbeb",color:"#92400e",fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:20}}>{stockCrit} criticos</span>}
          {sinStock>0&&<span style={{background:"#fef2f2",color:"#dc2626",fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:20}}>{sinStock} sin stock</span>}
        </div>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Total productos</div><div style={{fontSize:28,fontWeight:800,color:G}}>{prods.length}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Valor en stock</div><div style={{fontSize:22,fontWeight:800,color:"#1a1a1a"}}>${totalValor.toLocaleString("es-UY")}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Sin stock / Critico</div><div style={{fontSize:28,fontWeight:800,color:sinStock>0?"#dc2626":stockCrit>0?"#f59e0b":G}}>{sinStock+stockCrit}</div></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto..." style={{...inp,flex:1,minWidth:200}} />
        <select value={marca} onChange={e=>setMarca(e.target.value)} style={{...inp,width:180}}>{marcas.map(m=><option key={m} value={m}>{m}</option>)}</select>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"#374151",cursor:"pointer",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={soloStock} onChange={e=>setSoloStock(e.target.checked)} />Con stock
        </label>
      </div>
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
            {["Producto","Marca","Stock","Precio","Pto.Reorden","Proveedor","Estado",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((p,i)=>{
              const st=Number(p.stock||0);
              const rop=Number(p.rop||5);
              const status=st===0?"sin-stock":st<=rop?"critico":"ok";
              const statusColors={ok:{bg:"#f0fdf4",color:G,label:"OK"},"sin-stock":{bg:"#fef2f2",color:"#dc2626",label:"Sin stock"},"critico":{bg:"#fffbeb",color:"#92400e",label:"Critico"}};
              const sc=statusColors[status];
              const isEdit=editId===p.id;
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:st===0?"#fef2f2":i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{isEdit?<input style={{...inp,width:160}} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} />:(p.nombre||p.name)}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.marca||p.brand||"-"}</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:sc.color}}>{isEdit?<input type="number" style={{...inp,width:70}} value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} />:st}</td>
                  <td style={{padding:"10px 14px"}}>{isEdit?<input type="number" style={{...inp,width:90}} value={form.precio} onChange={e=>setForm(f=>({...f,precio:e.target.value}))} />:"$"+(p.precio||p.price||0)}</td>
                  <td style={{padding:"10px 14px"}}>{isEdit?<input type="number" style={{...inp,width:60}} value={form.rop} onChange={e=>setForm(f=>({...f,rop:e.target.value}))} />:rop}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{isEdit?<input style={{...inp,width:120}} value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} />:(p.proveedor||"-")}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:sc.bg,color:sc.color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{sc.label}</span></td>
                  <td style={{padding:"10px 14px"}}>{isEdit?(<div style={{display:"flex",gap:4}}><button onClick={()=>saveEdit(p.id)} style={{padding:"4px 10px",background:G,color:"#fff",border:"none",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:700}}>Guardar</button><button onClick={()=>setEditId(null)} style={{padding:"4px 8px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,cursor:"pointer",fontSize:11}}>Cancelar</button></div>):(<button onClick={()=>startEdit(p)} style={{padding:"4px 10px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,cursor:"pointer",fontSize:11}}>Editar</button>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin resultados para esta busqueda</div>}
      </div>
    </section>
  );
}
function KPIsTab(){
  const G="#3a7d1e";
  const [prods]=useState(()=>LS.get("aryes6-products",[]));
  const [movs]=useState(()=>LS.get("aryes-movements",[]));
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [rutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [lotes]=useState(()=>LS.get("aryes-lots",[]));
  const [periodo,setPeriodo]=useState("mes");
  const hoy=new Date();
  const diasAtras=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return d;};
  const pStart=periodo==="semana"?diasAtras(7):periodo==="mes"?diasAtras(30):diasAtras(90);
  const movsP=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=pStart);
  const ventasP=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=pStart&&v.estado!=="cancelada");
  const entradas=movsP.filter(m=>m.tipo==="entrada").reduce((a,m)=>a+Number(m.cantidad||0),0);
  const salidas=movsP.filter(m=>m.tipo==="salida"||m.tipo==="ajuste").reduce((a,m)=>a+Number(m.cantidad||0),0);
  const totalVentas=ventasP.reduce((a,v)=>a+Number(v.total||0),0);
  const stockCrit=prods.filter(p=>Number(p.stock||0)>0&&Number(p.stock||0)<=(p.rop||5)).length;
  const sinStock=prods.filter(p=>Number(p.stock||0)===0).length;
  const diasVenc=(f)=>Math.ceil((new Date(f)-hoy)/(1000*60*60*24));
  const vencProx=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)>=0&&diasVenc(l.fechaVenc)<=30).length;
  const vencidos=lotes.filter(l=>l.fechaVenc&&diasVenc(l.fechaVenc)<0).length;
  const entregasAll=rutas.flatMap(r=>r.entregas||[]);
  const entregasOk=entregasAll.filter(e=>e.estado==="entregado").length;
  const efectividad=entregasAll.length>0?Math.round(entregasOk/entregasAll.length*100):0;
  // Top productos por movimientos
  const prodMov={};
  movsP.forEach(m=>{const k=m.productoNombre||m.nombre||"?";prodMov[k]=(prodMov[k]||0)+Number(m.cantidad||0);});
  const topProds=Object.entries(prodMov).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // Ventas por estado
  const ventasEst={};
  ventas.forEach(v=>{ventasEst[v.estado||"?"]=(ventasEst[v.estado||"?"]||0)+1;});
  const CARD=({icon,label,value,sub,alert,color})=>(
    <div style={{background:"#fff",borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"2px solid "+(alert?"#ef4444":"transparent")}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:28,fontWeight:800,color:color||"#1a1a1a"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{sub}</div>}
    </div>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>KPIs</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Indicadores clave del negocio</p></div>
        <div style={{display:"flex",gap:6}}>{["semana","mes","trimestre"].map(p=>(
          <button key={p} onClick={()=>setPeriodo(p)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===p?G:"#e5e7eb"),background:periodo===p?G:"#fff",color:periodo===p?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>
            {p==="semana"?"7 dias":p==="mes"?"30 dias":"90 dias"}</button>))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <CARD icon="💰" label={"Ventas ("+periodo+")"} value={ventasP.length} sub={"$"+totalVentas.toLocaleString("es-UY")} color={G} />
        <CARD icon="📦" label="Stock critico" value={stockCrit+sinStock} sub={stockCrit+" criticos · "+sinStock+" sin stock"} alert={sinStock>0||stockCrit>5} color={sinStock>0?"#dc2626":stockCrit>0?"#f59e0b":G} />
        <CARD icon="📅" label="Venc. proximos" value={vencProx} sub={vencidos+" ya vencidos"} alert={vencidos>0} color={vencidos>0?"#dc2626":"#f59e0b"} />
        <CARD icon="🚛" label="Efectividad entregas" value={efectividad+"%"} sub={entregasOk+"/"+entregasAll.length+" entregas"} color={efectividad>=90?G:efectividad>=70?"#f59e0b":"#dc2626"} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <CARD icon="📥" label="Entradas stock" value={entradas} sub={"en los ultimos "+periodo} color={G} />
        <CARD icon="📤" label="Salidas stock" value={salidas} sub={"en los ultimos "+periodo} color="#6b7280" />
        <CARD icon="🔄" label="Movimientos" value={movsP.length} sub={"total periodo"} color="#3b82f6" />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#1a1a1a",margin:"0 0 14px"}}>Top productos por movimiento</h3>
          {topProds.length===0?<div style={{color:"#888",fontSize:13}}>Sin movimientos en el periodo</div>:(
            topProds.map(([nombre,cant],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
                <span style={{width:22,height:22,borderRadius:"50%",background:G,color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                <span style={{flex:1,fontSize:13,fontWeight:500}}>{nombre}</span>
                <span style={{fontSize:13,fontWeight:700,color:G}}>{cant}</span>
              </div>
            ))
          )}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#1a1a1a",margin:"0 0 14px"}}>Ventas por estado</h3>
          {Object.entries(ventasEst).length===0?<div style={{color:"#888",fontSize:13}}>Sin ventas registradas</div>:(
            Object.entries(ventasEst).map(([est,cnt])=>{
              const colors={pendiente:"#f59e0b",confirmada:"#3b82f6",preparada:"#8b5cf6",entregada:G,cancelada:"#6b7280"};
              return(
                <div key={est} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:colors[est]||"#888",flexShrink:0}} />
                  <span style={{flex:1,fontSize:13,textTransform:"capitalize"}}>{est}</span>
                  <span style={{fontSize:13,fontWeight:700}}>{cnt}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
function TrackingTab(){
  const G="#3a7d1e";
  const {user}=useContext(AppCtx);
  const [rutas]=useState(()=>LS.get("aryes-rutas",[]));
  const [ubicaciones,setUbicaciones]=useState({});
  const [tracking,setTracking]=useState(false);
  const [watchId,setWatchId]=useState(null);
  const [miPosicion,setMiPosicion]=useState(null);
  const [msg,setMsg]=useState("");
  const esRepartidor=user&&user.role==="operador";
  const activarTracking=()=>{
    if(!navigator.geolocation){setMsg("GPS no disponible en este dispositivo");return;}
    const id=navigator.geolocation.watchPosition(
      pos=>{
        const loc={lat:pos.coords.latitude,lng:pos.coords.longitude,ts:new Date().toISOString(),usuario:user?.username||"?"};
        setMiPosicion(loc);
        // Sync to Supabase
        const SURL="https://mrotnqybqvmvlexncvno.supabase.co";
        const SKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI";
        fetch(SURL+"/rest/v1/aryes_tracking",{method:"POST",headers:{"apikey":SKEY,"Authorization":"Bearer "+SKEY,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates"},body:JSON.stringify({id:user?.username||"repartidor",...loc})}).catch(()=>{});
      },
      ()=>setMsg("Error obteniendo GPS"),
      {enableHighAccuracy:true,maximumAge:10000,timeout:15000}
    );
    setWatchId(id);setTracking(true);
  };
  const detenerTracking=()=>{
    if(watchId!==null)navigator.geolocation.clearWatch(watchId);
    setWatchId(null);setTracking(false);setMiPosicion(null);
  };
  // Admin view: show all repartidores from Supabase
  const [posiciones,setPosiciones]=useState([]);
  useEffect(()=>{
    if(esRepartidor)return;
    const SURL="https://mrotnqybqvmvlexncvno.supabase.co";
    const SKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI";
    const fetchPos=()=>fetch(SURL+"/rest/v1/aryes_tracking?select=*",{headers:{"apikey":SKEY,"Authorization":"Bearer "+SKEY}}).then(r=>r.json()).then(d=>setPosiciones(Array.isArray(d)?d:[])).catch(()=>{});
    fetchPos();
    const iv=setInterval(fetchPos,15000);
    return()=>clearInterval(iv);
  },[esRepartidor]);
  if(esRepartidor)return(
    <section style={{padding:"28px 36px",maxWidth:600,margin:"0 auto",textAlign:"center"}}>
      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 8px"}}>Mi ubicacion</h2>
      <p style={{fontSize:13,color:"#888",marginBottom:24}}>Activa el tracking para que admin pueda ver tu posicion en tiempo real</p>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      {miPosicion&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"14px 18px",marginBottom:16,fontSize:13,color:G}}>
        <div style={{fontWeight:700,marginBottom:4}}>Posicion actual</div>
        <div>Lat: {miPosicion.lat.toFixed(5)} · Lng: {miPosicion.lng.toFixed(5)}</div>
        <div style={{fontSize:11,color:"#888",marginTop:4}}>{new Date(miPosicion.ts).toLocaleTimeString("es-UY")}</div>
      </div>}
      <button onClick={tracking?detenerTracking:activarTracking} style={{padding:"14px 32px",background:tracking?"#dc2626":G,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:16}}>
        {tracking?"Detener tracking":"Activar tracking GPS"}
      </button>
    </section>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:900,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Tracking GPS</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Posicion en tiempo real de los repartidores</p>
      </div>
      {posiciones.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}>
        <div style={{fontSize:40,marginBottom:12}}>📍</div>
        <div>Ningun repartidor activo ahora</div>
        <div style={{fontSize:11,marginTop:6}}>Cuando un operador active el tracking, aparecera aqui. Se actualiza cada 15 seg.</div>
      </div>):(
        <div style={{display:"grid",gap:10}}>
          {posiciones.map(p=>(
            <div key={p.id} style={{background:"#fff",borderRadius:10,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:28}}>📍</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{p.usuario||p.id}</div>
                <div style={{fontSize:12,color:"#888"}}>Lat {Number(p.lat).toFixed(4)} · Lng {Number(p.lng).toFixed(4)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#888"}}>{p.ts?new Date(p.ts).toLocaleTimeString("es-UY"):"-"}</div>
                <button onClick={()=>window.open("https://maps.google.com/?q="+p.lat+","+p.lng,"_blank","noopener,noreferrer")} style={{marginTop:4,padding:"4px 10px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:11}}>Ver en Maps</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


// Audit log helper - call from any component
function auditLog(tipo, descripcion, detalle, usuario) {
  try {
    const logs = LS.get('aryes-audit-log', []);
    const entry = {
      id: Date.now(),
      tipo,
      descripcion,
      detalle: typeof detalle === 'object' ? JSON.stringify(detalle) : (detalle || ''),
      usuario: usuario || (JSON.parse(localStorage.getItem('aryes-session') || '{}').username || 'sistema'),
      fecha: new Date().toLocaleString('es-UY')
    };
    LS.set('aryes-audit-log', [entry, ...logs].slice(0, 2000));
  } catch(e) {}
}

function DevolucionesTab(){
  const G="#3a7d1e";
  const [devoluciones,setDevoluciones]=useState(()=>LS.get("aryes-devoluciones",[]));
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [vista,setVista]=useState("lista");
  const [form,setForm]=useState({ventaId:"",clienteNombre:"",motivo:"",items:[],notas:""});
  const [msg,setMsg]=useState("");
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const ventaSeleccionada=ventas.find(v=>v.id===form.ventaId)||null;
  const iniciarDevolucion=(venta)=>{
    setForm({ventaId:venta.id,clienteNombre:venta.clienteNombre,motivo:"",notas:"",
      items:(venta.items||[]).map(it=>({...it,cantDevolver:0,estado:"pendiente",inspeccion:""}))});
    setVista("nueva");
  };
  const confirmarDevolucion=()=>{
    const itemsDevueltos=form.items.filter(it=>Number(it.cantDevolver)>0);
    if(itemsDevueltos.length===0){setMsg("Ingresa al menos un item a devolver");return;}
    if(!form.motivo){setMsg("Ingresa el motivo de la devolucion");return;}
    // Reingresar stock de items aprobados
    let updProds=[...prods];
    itemsDevueltos.forEach(it=>{
      if(it.inspeccion==="aprobado"){
        const idx=updProds.findIndex(p=>String(p.id)===String(it.productoId));
        if(idx>-1)updProds[idx]={...updProds[idx],stock:Number(updProds[idx].stock||0)+Number(it.cantDevolver)};
      }
    });
    setProds(updProds);LS.set("aryes6-products",updProds);
    const dev={id:Date.now(),nroDevolucion:"DEV-"+String(devoluciones.length+1).padStart(4,"0"),
      ventaId:form.ventaId,clienteNombre:form.clienteNombre,motivo:form.motivo,notas:form.notas,
      items:itemsDevueltos,estado:"procesada",fecha:new Date().toLocaleDateString("es-UY"),creadoEn:new Date().toISOString()};
    const upd=[dev,...devoluciones];
    setDevoluciones(upd);LS.set("aryes-devoluciones",upd);
    setVista("lista");
    setMsg("Devolucion "+dev.nroDevolucion+" procesada. Stock actualizado para items aprobados.");
    setTimeout(()=>setMsg(""),5000);
  };
  const MOTIVOS=["Producto danado","Error en pedido","Producto vencido","Exceso de stock","Otro"];
  if(vista==="nueva")return(
    <section style={{padding:"28px 36px",maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setVista("lista")} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#666"}}>&#8592;</button>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:24,color:"#1a1a1a",margin:0}}>Nueva devolucion — {form.clienteNombre}</h2>
      </div>
      {msg&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px",marginBottom:16,color:"#dc2626",fontSize:13}}>{msg}</div>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Motivo</label>
          <select value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} style={inp}>
            <option value="">- Seleccionar motivo -</option>
            {MOTIVOS.map(m=><option key={m} value={m}>{m}</option>)}
          </select></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#666",textTransform:"uppercase",letterSpacing:.5,display:"block",marginBottom:4}}>Notas adicionales</label>
          <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Descripcion del estado..." style={inp} /></div>
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>Items a devolver:</div>
        {form.items.map((it,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:8,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{it.nombre}</div><div style={{fontSize:11,color:"#888"}}>Pedido: {it.cantidad} {it.unidad}</div></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Cant. a devolver</label>
            <input type="number" min="0" max={it.cantidad} value={it.cantDevolver} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],cantDevolver:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,width:70}} /></div>
            <div><label style={{fontSize:10,color:"#888",display:"block",marginBottom:2}}>Inspeccion</label>
            <select value={it.inspeccion} onChange={e=>{const upd=[...form.items];upd[i]={...upd[i],inspeccion:e.target.value};setForm(f=>({...f,items:upd}));}} style={{...inp,fontSize:12,color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#374151"}}>
              <option value="">- Estado -</option>
              <option value="aprobado">Aprobado (vuelve al stock)</option>
              <option value="rechazado">Rechazado (baja por calidad)</option>
              <option value="pendiente">Pendiente revision</option>
            </select></div>
            <div style={{fontSize:11,padding:"4px 8px",borderRadius:6,background:it.inspeccion==="aprobado"?"#f0fdf4":it.inspeccion==="rechazado"?"#fef2f2":"#f9fafb",color:it.inspeccion==="aprobado"?G:it.inspeccion==="rechazado"?"#dc2626":"#888",textAlign:"center",marginTop:16}}>
              {it.inspeccion==="aprobado"?"Reingresa stock":it.inspeccion==="rechazado"?"Se da de baja":"Sin accion"}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setVista("lista")} style={{padding:"10px 20px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
        <button onClick={confirmarDevolucion} style={{padding:"10px 28px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:14}}>Procesar devolucion</button>
      </div>
    </section>
  );
  return(
    <section style={{padding:"28px 36px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:"0 0 4px"}}>Devoluciones</h2>
        <p style={{fontSize:12,color:"#888",margin:0}}>Gestiona devoluciones de clientes con inspeccion y reingreso al stock</p>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px",marginBottom:16,color:G,fontSize:13,fontWeight:600}}>{msg}</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Iniciar devolucion desde venta</h3>
          {ventas.filter(v=>v.estado==="entregada").length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>No hay ventas entregadas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {ventas.filter(v=>v.estado==="entregada").slice(0,8).map((v,i)=>(
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:G}}>{v.nroVenta}</div>
                    <div style={{fontSize:11,color:"#666"}}>{v.clienteNombre} · {v.fecha}</div>
                  </div>
                  <button onClick={()=>iniciarDevolucion(v)} style={{padding:"5px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:12,color:"#374151"}}>Devolver</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#1a1a1a",margin:"0 0 12px"}}>Historial ({devoluciones.length})</h3>
          {devoluciones.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>Sin devoluciones registradas</div>):(
            <div style={{background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
              {devoluciones.slice(0,8).map((d,i)=>(
                <div key={d.id} style={{padding:"10px 14px",borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#dc2626"}}>{d.nroDevolucion}</div>
                      <div style={{fontSize:11,color:"#666"}}>{d.clienteNombre} · {d.fecha}</div>
                    </div>
                    <span style={{background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{d.motivo}</span>
                  </div>
                  <div style={{fontSize:11,color:"#888",marginTop:4}}>{d.items.length} item(s) · {d.items.filter(it=>it.inspeccion==="aprobado").length} aprobados / {d.items.filter(it=>it.inspeccion==="rechazado").length} rechazados</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function PreciosTab(){
  const G="#3a7d1e";
  const [prods,setProds]=useState(()=>LS.get("aryes6-products",[]));
  const [listas,setListas]=useState(()=>LS.get("aryes-listas-precio",{
    A:{nombre:"Lista A - Mayorista",descuento:20,color:"#3b82f6"},
    B:{nombre:"Lista B - HORECA",descuento:10,color:"#8b5cf6"},
    C:{nombre:"Lista C - Minorista",descuento:0,color:"#f59e0b"}
  }));
  const [listaActiva,setListaActiva]=useState("A");
  const [busq,setBusq]=useState("");
  const [msg,setMsg]=useState("");
  const [editDesc,setEditDesc]=useState(false);
  const inp={padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const lista=listas[listaActiva];
  const calcPrecio=(precioBase,desc)=>Math.round(Number(precioBase||0)*(1-(Number(desc||0)/100)));
  const filtered=prods.filter(p=>{
    const n=(p.nombre||p.name||"").toLowerCase();
    return !busq||n.includes(busq.toLowerCase());
  });
  const guardarDescuento=(listaId,nuevo)=>{
    const upd={...listas,[listaId]:{...listas[listaId],descuento:Number(nuevo)}};
    setListas(upd);LS.set("aryes-listas-precio",upd);
    setEditDesc(false);setMsg("Lista actualizada");setTimeout(()=>setMsg(""),2000);
  };
  const setPrecioCustom=(prodId,listaId,precio)=>{
    const upd=prods.map(p=>{
      if(p.id!==prodId)return p;
      const precios={...(p.precios||{}),[listaId]:Number(precio)};
      return{...p,precios};
    });
    setProds(upd);LS.set("aryes6-products",upd);
  };
  const exportarLista=()=>{
    const rows=[["Producto","Precio Base","Descuento "+lista.descuento+"%","Precio Final"],...filtered.map(p=>{
      const base=p.precio||p.price||0;
      const custom=p.precios&&p.precios[listaActiva];
      const final=custom||calcPrecio(base,lista.descuento);
      return[p.nombre||p.name||"","$"+base,lista.descuento+"%","$"+final];
    })];
    const csv=rows.map(r=>r.map(c=>"\""+c+"\"").join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="lista-"+listaActiva+".csv";a.click();
    URL.revokeObjectURL(url);
  };
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Listas de Precios</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Precios diferenciados por tipo de cliente</p></div>
        <button onClick={exportarLista} style={{padding:"8px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Exportar lista CSV</button>
      </div>
      {msg&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 14px",marginBottom:12,color:G,fontSize:12,fontWeight:600}}>{msg}</div>}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {Object.entries(listas).map(([id,l])=>(
          <button key={id} onClick={()=>{setListaActiva(id);setEditDesc(false);}} style={{padding:"10px 20px",borderRadius:10,border:"2px solid "+(listaActiva===id?l.color:"#e5e7eb"),background:listaActiva===id?l.color+"18":"#fff",color:listaActiva===id?l.color:"#666",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            {l.nombre}<span style={{marginLeft:8,fontSize:11,opacity:.8}}>-{l.descuento}%</span>
          </button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a1a"}}>{lista.nombre}</div>
          <div style={{fontSize:12,color:"#888",marginTop:2}}>Descuento base sobre precio lista: <strong>{lista.descuento}%</strong></div>
        </div>
        {editDesc?(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input type="number" id="newDisc" defaultValue={lista.descuento} min="0" max="100" style={{...inp,width:70}} />
            <button onClick={()=>guardarDescuento(listaActiva,document.getElementById("newDisc").value)} style={{padding:"7px 14px",background:G,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:700}}>Guardar</button>
            <button onClick={()=>setEditDesc(false)} style={{padding:"7px 12px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:6,cursor:"pointer",fontSize:13}}>Cancelar</button>
          </div>
        ):(
          <button onClick={()=>setEditDesc(true)} style={{padding:"7px 14px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,cursor:"pointer",fontSize:13}}>Editar descuento</button>
        )}
      </div>
      <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar producto..." style={{...inp,marginBottom:12}} />
      <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
            {["Producto","Precio base","Desc. lista","Precio final","Precio custom",""].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
          </tr></thead>
          <tbody>{filtered.slice(0,50).map((p,i)=>{
            const base=Number(p.precio||p.price||0);
            const custom=p.precios&&p.precios[listaActiva]?Number(p.precios[listaActiva]):null;
            const final=custom||calcPrecio(base,lista.descuento);
            return(
              <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                <td style={{padding:"9px 14px",fontWeight:500}}>{p.nombre||p.name}</td>
                <td style={{padding:"9px 14px",color:"#6b7280"}}>${base.toLocaleString("es-UY")}</td>
                <td style={{padding:"9px 14px",color:lista.color,fontWeight:600}}>-{lista.descuento}%</td>
                <td style={{padding:"9px 14px",fontWeight:700,color:custom?lista.color:G}}>${final.toLocaleString("es-UY")}{custom&&<span style={{fontSize:10,color:lista.color,marginLeft:4}}>custom</span>}</td>
                <td style={{padding:"9px 14px"}}>
                  <input type="number" placeholder={"Auto: $"+calcPrecio(base,lista.descuento)} value={custom||""} onChange={e=>setPrecioCustom(p.id,listaActiva,e.target.value||0)} style={{...inp,width:100,fontSize:12}} />
                </td>
                <td style={{padding:"9px 14px"}}>
                  {custom&&<button onClick={()=>setPrecioCustom(p.id,listaActiva,0)} style={{padding:"3px 8px",background:"#fff",border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",fontSize:10,color:"#dc2626"}}>Reset</button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
        {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"#888",fontSize:13}}>Sin productos para mostrar</div>}
      </div>
    </section>
  );
}
function DemandaTab(){
  const G="#3a7d1e";
  const [prods]=useState(()=>LS.get("aryes6-products",[]));
  const [movs]=useState(()=>LS.get("aryes-movements",[]));
  const [ventas]=useState(()=>LS.get("aryes-ventas",[]));
  const [periodo,setPeriodo]=useState(30);
  const hoy=new Date();
  const pStart=new Date();pStart.setDate(pStart.getDate()-periodo);
  // Calcular rotacion y proyeccion por producto
  const analisis=prods.map(p=>{
    // Salidas del periodo (ventas + movimientos de salida)
    const salidaMovs=movs.filter(m=>m.timestamp&&new Date(m.timestamp)>=pStart&&(m.tipo==="salida"||m.tipo==="venta")&&(String(m.productoId)===String(p.id)||m.productoNombre===(p.nombre||p.name)));
    const salidaVentas=ventas.filter(v=>v.creadoEn&&new Date(v.creadoEn)>=pStart&&v.estado!=="cancelada").flatMap(v=>v.items||[]).filter(it=>String(it.productoId)===String(p.id)||(it.nombre===(p.nombre||p.name)));
    const totalSalidas=salidaMovs.reduce((a,m)=>a+Number(m.cantidad||0),0)+salidaVentas.reduce((a,it)=>a+Number(it.cantidad||0),0);
    const salidaDiaria=totalSalidas/periodo;
    const stock=Number(p.stock||0);
    const diasStock=salidaDiaria>0?Math.floor(stock/salidaDiaria):null;
    const proyeccion30=Math.round(salidaDiaria*30);
    const rop=Number(p.rop||5);
    const alerta=diasStock!==null&&diasStock<=7?"urgente":diasStock!==null&&diasStock<=14?"proximo":stock<=rop?"critico":"ok";
    return{...p,totalSalidas,salidaDiaria,diasStock,proyeccion30,alerta};
  }).filter(p=>p.totalSalidas>0||Number(p.stock||0)<=Number(p.rop||5)).sort((a,b)=>{
    const ord={urgente:0,proximo:1,critico:2,ok:3};
    return(ord[a.alerta]||3)-(ord[b.alerta]||3);
  });
  const urgentes=analisis.filter(p=>p.alerta==="urgente").length;
  const proximos=analisis.filter(p=>p.alerta==="proximo").length;
  const ALERTA_STYLE={urgente:{bg:"#fef2f2",color:"#dc2626",label:"URGENTE"},proximo:{bg:"#fffbeb",color:"#92400e",label:"PROXIMO"},critico:{bg:"#fff7ed",color:"#c2410c",label:"CRITICO"},ok:{bg:"#f0fdf4",color:G,label:"OK"}};
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Demanda Predictiva</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>Rotacion historica y proyeccion de reposicion</p></div>
        <div style={{display:"flex",gap:6}}>{[7,30,90].map(d=>(
          <button key={d} onClick={()=>setPeriodo(d)} style={{padding:"6px 14px",borderRadius:20,border:"2px solid "+(periodo===d?G:"#e5e7eb"),background:periodo===d?G:"#fff",color:periodo===d?"#fff":"#666",fontWeight:600,fontSize:12,cursor:"pointer"}}>{d} dias</button>
        ))}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        <div style={{background:urgentes>0?"#fef2f2":"#fff",border:"2px solid "+(urgentes>0?"#fecaca":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Agotan en 7 dias</div><div style={{fontSize:28,fontWeight:800,color:urgentes>0?"#dc2626":G}}>{urgentes}</div></div>
        <div style={{background:proximos>0?"#fffbeb":"#fff",border:"2px solid "+(proximos>0?"#fde68a":"transparent"),borderRadius:10,padding:"14px 18px",textAlign:"center"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Agotan en 14 dias</div><div style={{fontSize:28,fontWeight:800,color:proximos>0?"#92400e":"#6b7280"}}>{proximos}</div></div>
        <div style={{background:"#fff",borderRadius:10,padding:"14px 18px",textAlign:"center",border:"2px solid transparent"}}><div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Productos analizados</div><div style={{fontSize:28,fontWeight:800,color:G}}>{analisis.length}</div></div>
      </div>
      {analisis.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>No hay suficientes movimientos para calcular prediccion.</div><div style={{fontSize:11,marginTop:6}}>Registra salidas de stock o ventas para ver el analisis.</div></div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
              {["Producto","Stock actual","Salidas/dia","Dias de stock","Proyeccion 30d","Alerta"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
            </tr></thead>
            <tbody>{analisis.slice(0,30).map((p,i)=>{
              const as=ALERTA_STYLE[p.alerta]||ALERTA_STYLE.ok;
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f3f4f6",background:p.alerta==="urgente"?"#fff8f8":i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"10px 14px",fontWeight:600}}>{p.nombre||p.name}</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:Number(p.stock||0)===0?"#dc2626":"#1a1a1a"}}>{p.stock||0} {p.unidad||p.unit||"u"}</td>
                  <td style={{padding:"10px 14px",color:"#6b7280"}}>{p.salidaDiaria.toFixed(1)}/dia</td>
                  <td style={{padding:"10px 14px",fontWeight:700,color:p.diasStock!==null&&p.diasStock<=7?"#dc2626":p.diasStock!==null&&p.diasStock<=14?"#f59e0b":G}}>{p.diasStock!==null?p.diasStock+" dias":"Sin datos"}</td>
                  <td style={{padding:"10px 14px",color:"#374151"}}>{p.proyeccion30} {p.unidad||p.unit||"u"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{background:as.bg,color:as.color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20}}>{as.label}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function AuditTab(){
  const G="#3a7d1e";
  const [logs]=useState(()=>LS.get("aryes-audit-log",[]));
  const [filtroUser,setFiltroUser]=useState("todos");
  const [filtroTipo,setFiltroTipo]=useState("todos");
  const [busq,setBusq]=useState("");
  const usuarios=["todos",...new Set(logs.map(l=>l.usuario||"sistema").filter(Boolean))];
  const tipos=["todos",...new Set(logs.map(l=>l.tipo||"?").filter(Boolean))];
  const filtered=logs.filter(l=>{
    if(filtroUser!=="todos"&&(l.usuario||"sistema")!==filtroUser)return false;
    if(filtroTipo!=="todos"&&(l.tipo||"?")!==filtroTipo)return false;
    if(busq&&!JSON.stringify(l).toLowerCase().includes(busq.toLowerCase()))return false;
    return true;
  });
  const TIPO_STYLE={venta:{color:"#3b82f6",bg:"#eff6ff"},recepcion:{color:G,bg:"#f0fdf4"},movimiento:{color:"#8b5cf6",bg:"#f5f3ff"},devolucion:{color:"#dc2626",bg:"#fef2f2"},conteo:{color:"#f59e0b",bg:"#fffbeb"},login:{color:"#6b7280",bg:"#f9fafb"},config:{color:"#92400e",bg:"#fffbeb"}};
  const exportar=()=>{
    const rows=[["Fecha","Usuario","Tipo","Descripcion","Detalle"],...filtered.map(l=>[l.fecha||"",l.usuario||"sistema",l.tipo||"",l.descripcion||"",l.detalle||""])];
    const csv=rows.map(r=>r.map(c=>"\""+String(c||"").replace(/"/g,"\"\"")+"\"").join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="audit-log.csv";a.click();
    URL.revokeObjectURL(url);
  };
  return(
    <section style={{padding:"28px 36px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h2 style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"#1a1a1a",margin:0}}>Audit Trail</h2>
        <p style={{fontSize:12,color:"#888",margin:"4px 0 0"}}>{logs.length} eventos registrados</p></div>
        <button onClick={exportar} style={{padding:"8px 16px",background:G,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>Exportar CSV</button>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar en logs..." style={{padding:"7px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit",flex:1,minWidth:180}} />
        <select value={filtroUser} onChange={e=>setFiltroUser(e.target.value)} style={{padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit"}}>
          {usuarios.map(u=><option key={u} value={u}>{u==="todos"?"Todos los usuarios":u}</option>)}
        </select>
        <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={{padding:"7px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit"}}>
          {tipos.map(t=><option key={t} value={t}>{t==="todos"?"Todos los tipos":t}</option>)}
        </select>
      </div>
      {logs.length===0?(<div style={{background:"#f9fafb",borderRadius:12,padding:32,textAlign:"center",color:"#888",fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📋</div><div style={{fontWeight:600,marginBottom:6}}>Sin eventos registrados aun</div><div style={{fontSize:11}}>Los eventos se registraran automaticamente a medida que se usen los modulos.</div></div>):(
        filtered.length===0?(<div style={{background:"#f9fafb",borderRadius:10,padding:20,textAlign:"center",color:"#888",fontSize:13}}>Sin resultados para este filtro</div>):(
        <div style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",borderBottom:"2px solid #e5e7eb"}}>
              {["Fecha/Hora","Usuario","Tipo","Descripcion","Detalle"].map(h=><th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:600,color:"#6b7280",fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.slice(0,100).map((l,i)=>{
              const ts=TIPO_STYLE[l.tipo]||{color:"#6b7280",bg:"#f9fafb"};
              return(
                <tr key={l.id||i} style={{borderBottom:"1px solid #f3f4f6",background:i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"8px 14px",color:"#6b7280",whiteSpace:"nowrap",fontSize:12}}>{l.fecha||"-"}</td>
                  <td style={{padding:"8px 14px",fontWeight:600}}>{l.usuario||"sistema"}</td>
                  <td style={{padding:"8px 14px"}}><span style={{background:ts.bg,color:ts.color,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,textTransform:"capitalize"}}>{l.tipo||"?"}</span></td>
                  <td style={{padding:"8px 14px",fontWeight:500}}>{l.descripcion||"-"}</td>
                  <td style={{padding:"8px 14px",color:"#888",fontSize:11,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.detalle||""}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {filtered.length>100&&<div style={{padding:"10px 14px",fontSize:12,color:"#888",textAlign:"center"}}>Mostrando 100 de {filtered.length} eventos</div>}
        </div>
      ))}
    </section>
  );
}

function AryesApp(){
  const [session,setSession]=useState(()=>LS.get('aryes-session',null));
  // Sync from Supabase on mount
  useEffect(()=>{
    const keys=['aryes6-products','aryes-users','aryes-lots','aryes-price-history','aryes-clients','aryes-movements','aryes6-suppliers','aryes6-orders','aryes7-plans'];
    keys.forEach(k=>LS.load(k,[]).then(()=>{}));
  },[]);
  const handleLogin=(u)=>{LS.set('aryes-session',u);setSession(u);setTimeout(()=>window.location.reload(),50);};
  const handleLogout=()=>{LS.set('aryes-session',null);setSession(null);};
  if(!session) return <LoginScreen onLogin={handleLogin}/>;
  const canEdit=session.role==='admin'||session.role==='operador';

  const [dbReady,setDbReady]=useState(false);
  const [syncStatus,setSyncStatus]=useState('');
  useEffect(()=>{
    if(!session) return;
    setSyncStatus('sync');
    (async()=>{
      try{
        const prods=await db.get('products','order=id.asc&limit=1000');
        if(prods?.length>0){
          const mapped=prods.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplierId:p.supplier_id||'arg',unit:p.unit||'kg',stock:Number(p.stock)||0,unitCost:Number(p.unit_cost)||0,minStock:Number(p.min_stock)||5,dailyUsage:Number(p.daily_usage)||0.5,category:p.category||'',brand:p.brand||'',history:p.history||[]}));
          LS.set('aryes6-products',mapped);
        }
        const sups=await db.get('suppliers','order=name.asc');
        if(sups?.length>0){const mapped=sups.map(s=>({id:s.id,name:s.name,flag:s.flag||'',color:s.color||'#3a7d1e',times:s.times||{preparation:2,customs:1,freight:4,warehouse:1},company:s.company||'',contact:s.contact||'',email:s.email||'',phone:s.phone||'',country:s.country||'',city:s.city||'',currency:s.currency||'USD',paymentTerms:s.payment_terms||'30',paymentMethod:s.payment_method||'',minOrder:s.min_order||'',discount:s.discount||'0',rating:s.rating||3,active:s.active!==false,notes:s.notes||''}));LS.set('aryes6-suppliers',mapped);}
        const usrs=await db.get('users','order=id.asc');
        if(usrs?.length>0) LS.set('aryes-users',usrs.map(u=>({username:u.username,password:u.password,name:u.name,role:u.role,active:u.active})));
        setDbReady(true);setSyncStatus('ok');setTimeout(()=>setSyncStatus(''),3000);
      }catch(e){console.warn('Supabase offline, using local:',e);setDbReady(true);setSyncStatus('error');setTimeout(()=>setSyncStatus(''),4000);}
    })();
  },[session]);

  const [tab,setTab]=useState("dashboard");
  const [products,setProducts]=useState(()=>LS.get("aryes6-products",DEFAULT_PRODUCTS));
  const [suppliers,setSuppliers]=useState(()=>LS.get("aryes6-suppliers",DEFAULT_SUPPLIERS));
  const [orders,setOrders]=useState(()=>LS.get("aryes6-orders",[]));
  const [modal,setModal]=useState(null);
  const [editProd,setEditProd]=useState(null);
  const [editSup,setEditSup]=useState(null);
  const [viewSup,setViewSup]=useState(null);
  const [plans,setPlans]=useState(()=>LS.get("aryes7-plans",{}));
  const [movements,setMovements]=useState(()=>LS.get("aryes8-movements",[]));
  const [emailCfg,setEmailCfg]=useState(()=>LS.get("aryes9-emailcfg",{serviceId:"",templateId:"",publicKey:"",toEmail:"",enabled:false}));
  const [notified,setNotified]=useState(()=>LS.get("aryes9-notified",{}));

  useEffect(()=>LS.set("aryes6-products",products),[products]);
  useEffect(()=>LS.set("aryes6-suppliers",suppliers),[suppliers]);
  useEffect(()=>LS.set("aryes6-orders",orders),[orders]);
  useEffect(()=>LS.set("aryes7-plans",plans),[plans]);
  useEffect(()=>LS.set("aryes8-movements",movements),[movements]);
  useEffect(()=>LS.set("aryes9-emailcfg",emailCfg),[emailCfg]);
  useEffect(()=>LS.set("aryes9-notified",notified),[notified]);

  const getSup=id=>suppliers.find(s=>s.id===id);

  const enriched=useMemo(()=>products.map(p=>{const sup=getSup(p.supplierId);return{...p,sup,alert:alertLevel(p,sup)};}), [products,suppliers]);
  const alerts=enriched.filter(p=>p.alert.level!=="ok").sort((a,b)=>ALERT_CFG[b.alert.level].pri-ALERT_CFG[a.alert.level].pri);
  const critN=alerts.filter(p=>p.alert.level==="order_now").length;

  const saveProduct=f=>{
    if(editProd)setProducts(ps=>ps.map(p=>p.id===editProd.id?{...p,...f}:p));
    else setProducts(ps=>[...ps,{...f,id:Date.now()}]);
    setModal(null);setEditProd(null);
  };
  const confirmOrder=(product,qty)=>{
    const sup=getSup(product.supplierId);const lead=totalLead(sup);
    const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
    const o={id:Date.now(),productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,orderedAt:new Date().toISOString(),expectedArrival:arrival.toISOString(),status:"pending",totalCost:(qty*product.unitCost).toFixed(2),leadBreakdown:{...sup.times}};
    setOrders(os=>[o,...os]);
    addMov({type:"order_placed",productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,note:`Pedido generado — llegada est. ${arrival.toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"})}`});
    setModal({type:"orderDone",order:o});
  };
  const markDelivered=id=>{
    const o=orders.find(x=>x.id===id);if(!o)return;
    setOrders(os=>os.map(x=>x.id===id?{...x,status:"delivered"}:x));
    const updatedProds = products.map(p=>p.id===o.productId?{...p,stock:p.stock+o.qty}:p);
    setProducts(()=>updatedProds);
    setTimeout(()=>checkAndNotify(updatedProds,suppliers,emailCfg,notified),500);
    addMov({type:"delivery",productId:o.productId,productName:o.productName,supplierId:o.supplierId,supplierName:o.supplierName,qty:o.qty,unit:o.unit,note:`Mercadería recibida — pedido del ${new Date(o.orderedAt).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}`});
  };
  const applyExcel=matches=>{
    const excelProds = products.map(p=>{const m=matches.find(x=>x.product.id===p.id);return m?{...p,stock:m.newStock}:p;});
    setProducts(()=>excelProds);
    setTimeout(()=>checkAndNotify(excelProds,suppliers,emailCfg,notified),500);
    matches.forEach(m=>{
      const diff=m.newStock-m.product.stock;
      addMov({type:diff>=0?"excel_in":"excel_out",productId:m.product.id,productName:m.product.name,supplierId:m.product.supplierId,supplierName:"",qty:Math.abs(diff),unit:m.product.unit,stockAfter:m.newStock,note:`Stock actualizado desde Excel (${diff>=0?"+":""}${diff})`});
    });
    setModal(null);
  };
  const saveSupplier=f=>{
    if(editSup)setSuppliers(ss=>ss.map(s=>s.id===editSup.id?{...s,...f}:s));
    else setSuppliers(ss=>[...ss,{...f,id:Date.now().toString()}]);
    setModal(null);setEditSup(null);
  };
  const deleteSupplier=id=>{
    if(products.some(p=>p.supplierId===id)){alert("No se puede eliminar: hay productos asociados a este proveedor.");return;}
    setSuppliers(ss=>ss.filter(s=>s.id!==id));
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
          <h1 style="color:#fff;font-size:22px;margin:0;">Aryes — Alerta de Stock</h1>
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
          <p style="font-size:12px;color:#7a7368;margin:0;">Este email fue enviado automáticamente por el sistema de gestión de stock de Aryes.</p>
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
            subject: `Aryes Stock — ${alertProducts.length} producto${alertProducts.length>1?"s":""}  ${alertProducts.some(p=>p.alert.level==="order_now")?"requieren pedido URGENTE":"requieren atención"}`,
            html_content: html,
            alert_count: alertProducts.length,
          }
        })
      });
    } catch(e){ console.warn("Email error:", e); }
  };

  const addMov=(m)=>setMovements(ms=>[{...m,id:Date.now(),ts:new Date().toISOString()},...ms].slice(0,2000));

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
    {id:"movimientos",label:"Movimientos",icon:"🔄"},
    {id:"lotes",label:"Lotes/Venc.",icon:"📅"},{id:"conteo",label:"Conteo",icon:"🔢"},{id:"transferencias",label:"Transferencias",icon:"↕"},
    {id:"deposito",label:"Deposito",icon:"🗂"},
    {id:"rutas",label:"Rutas",icon:"🚛"},
    {id:"tracking",label:"Tracking",icon:"📍"},
    {id:"kpis",label:"KPIs",icon:"📈"},
    {id:"recepcion",label:"Recepcion",icon:"📥"},{id:"packing",label:"Packing",icon:"📦"},{id:"batch-picking",label:"Batch Pick",icon:"📋"},
    {id:"informes",label:"Informes",icon:"📋"},{id:"devoluciones",label:"Devoluciones",icon:"↩"},{id:"precios",label:"Precios",icon:"💲"},{id:"demanda",label:"Demanda",icon:"📈"},{id:"audit",label:"Audit",icon:"📋"},
    {id:"importar",label:"Importar",icon:"📂"},
    {id:"scanner",label:"Scanner",icon:"📷"},
    {id:"config",label:"Config",icon:"⚙"},
  ];
  const NAV_ROLES={
    admin:["dashboard","inventory","orders","suppliers","clientes","ventas","movimientos","lotes","deposito","rutas","tracking","kpis","recepcion","informes","importar","scanner","config"],
    operador:["dashboard","inventory","movimientos","lotes","deposito","rutas","tracking","recepcion","scanner"],
    vendedor:["dashboard","clientes","ventas","kpis","informes"]
  };
  const NAV=NAV_ALL.filter(n=>(NAV_ROLES[user?.role||"admin"]||NAV_ROLES.admin).includes(n.id));
  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];

  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg}}>
      <style>{CSS}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{overflowY:"auto",width:220,background:T.card,borderRight:`1px solid ${T.border}`,position:"fixed",top:0,left:0,bottom:0,display:"flex",flexDirection:"column"}}>
        {/* Logo */}
        <div style={{padding:"22px 22px 18px",borderBottom:`1px solid ${T.border}`}}>
          <AryesLogo height={34}/>
          {syncStatus==='sync'&&<div style={{fontSize:10,color:'#9a9a98',marginTop:3}}>↻ Sincronizando...</div>}
          {syncStatus==='ok'&&<div style={{fontSize:10,color:'#3a7d1e',marginTop:3}}>✓ Sincronizado</div>}
          {syncStatus==='error'&&<div style={{fontSize:10,color:'#d97706',marginTop:3}}>⚠ Modo local</div>}
          <div style={{marginTop:6}}><Cap style={{color:T.green}}>Gestión de stock · UY</Cap></div>
        </div>

        {/* Nav */}
        <nav style={{padding:"14px 0",flex:1}}>
          {NAV.filter(n=>n.id!=="usuarios"||session.role==="admin").map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{width:"100%",textAlign:"left",padding:"10px 22px",background:"none",border:"none",borderLeft:tab===n.id?`3px solid ${T.green}`:"3px solid transparent",fontFamily:T.sans,fontSize:13,fontWeight:tab===n.id?600:400,color:tab===n.id?T.green:T.textSm,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {n.label}
              {n.id==="dashboard"&&critN>0&&<span style={{background:T.danger,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{critN}</span>}
            </button>
          ))}
        </nav>

        {/* Excel button */}
        <div style={{padding:"14px 16px",borderTop:`1px solid ${T.border}`}}>
          {canEdit&&(<button onClick={()=>setModal({type:"excel"})}
            style={{width:"100%",background:T.greenBg,border:`1px solid ${T.greenBd}`,borderRadius:4,padding:"9px 14px",fontFamily:T.sans,fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.green,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
            ↑ Actualizar stock
            <span style={{fontSize:10,color:T.greenLt,fontWeight:400}}>Excel</span>
          </button>)}
        </div>
      
        <div style={{marginTop:'auto',borderTop:'1px solid #e2e2de',padding:'12px 16px 8px'}}>
          <div style={{fontSize:12,color:'#3a3a38',fontWeight:600,marginBottom:2}}>{session.name}</div>
          <div style={{fontSize:11,color:'#9a9a98',marginBottom:8,textTransform:'capitalize'}}>{session.role==='admin'?'Administrador':session.role==='operador'?'Operador':'Vendedor'}</div>
          <button onClick={handleLogout} style={{background:'#fef2f2',border:'1px solid #fecaca',padding:'6px 12px',fontSize:12,color:'#dc2626',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,borderRadius:6,fontWeight:600,marginTop:4}}>
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{marginLeft:220,flex:1,padding:"36px 44px",minHeight:"100vh"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&(
          <div className="au" style={{display:"grid",gap:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <Cap style={{color:T.green}}>Panel general</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:42,fontWeight:500,color:T.text,marginTop:5,letterSpacing:"-.02em",lineHeight:1}}>
                  {new Date().toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long"})}
                </h1>
              </div>
              {critN>0&&(
                <div style={{background:T.dangerBg,border:`1px solid ${T.dangerBd}`,borderRadius:4,padding:"10px 16px",display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:T.danger,flexShrink:0,animation:"pulseDot 1.8s ease infinite"}}/>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.danger,fontWeight:700}}>{critN} PRODUCTO{critN>1?"S":""} REQUIERE{critN>1?"N":""} PEDIDO INMEDIATO</span>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
              {[{l:"Total productos",v:products.length},{l:"Pedir ya",v:alerts.filter(p=>p.alert.level==="order_now").length,c:T.danger},{l:"Pedir pronto",v:alerts.filter(p=>p.alert.level==="order_soon").length,c:T.warning},{l:"En tránsito",v:orders.filter(o=>o.status==="pending").length,c:T.green}].map((s,i)=>(
                <div key={i} style={{background:T.card,padding:"20px 24px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:48,fontWeight:400,color:s.c||T.text,lineHeight:1,marginTop:8}}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.length>0?(
              <div>
                <div style={{marginBottom:12}}><Cap>Acciones requeridas</Cap></div>
                <div style={{display:"grid",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                  {alerts.map(({id,name,stock,unit,sup,alert})=>{
                    const ropDate=new Date();ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                    return(
                      <div key={id} style={{background:T.card,padding:"15px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:180}}>
                          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>{name}</div>
                          <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>[{sup?.flag}] {sup?.name} · Lead: {totalLead(sup)}d · ROP: {alert.rop} {unit} · {alert.daily.toFixed(1)}/día</div>
                          <div style={{marginTop:8,width:160}}><StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/></div>
                        </div>
                        <AlertPill level={alert.level}/>
                        <div style={{textAlign:"right",minWidth:120}}>
                          <Cap>{alert.level==="order_now"?"Pedir":"Pedir antes del"}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:ALERT_CFG[alert.level].txt,marginTop:3}}>
                            {alert.level==="order_now"?"HOY":fmtDate(ropDate)}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:80}}>
                          <Cap>EOQ sugerido</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:3}}>{alert.eoq||"—"} {unit}</div>
                        </div>
                        <Btn small onClick={()=>setModal({type:"order",product:products.find(p=>p.id===id)})}>Generar pedido</Btn>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <div style={{background:T.okBg,border:`1px solid ${T.okBd}`,borderRadius:6,padding:"16px 20px"}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:500}}>✓ Todo el inventario está dentro de parámetros. No hay acciones requeridas.</p>
              </div>
            )}

            {/* Supplier overview */}
            <div>
              <div style={{marginBottom:12}}><Cap>Estado por proveedor</Cap></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                {suppliers.map(sup=>{
                  const prods=enriched.filter(p=>p.supplierId===sup.id);
                  const now=prods.filter(p=>p.alert.level==="order_now").length;
                  const soon=prods.filter(p=>p.alert.level==="order_soon").length;
                  const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending").length;
                  return(
                    <div key={sup.id} style={{background:T.card,padding:"18px 22px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <div><Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap><div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:T.text,marginTop:3}}>{prods.length} producto{prods.length!==1?"s":""}</div></div>
                        <div style={{textAlign:"right"}}><Cap>Lead total</Cap><div style={{fontFamily:T.serif,fontSize:22,color:T.text,marginTop:3}}>{totalLead(sup)}d</div></div>
                      </div>
                      <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginBottom:8}}>
                        {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {now>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>● {now} pedir ya</span>}
                        {soon>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.warning,fontWeight:600}}>● {soon} pedir pronto</span>}
                        {pend>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.watch,fontWeight:600}}>● {pend} en tránsito</span>}
                        {!now&&!soon&&!pend&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ Normal</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ INVENTORY ══ */}
          <div className="au" style={{display:"grid",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div><Cap style={{color:T.green}}>Stock</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Inventario</h1></div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={()=>setModal({type:"excel"})} variant="ghost">↑ Importar Excel</Btn>
                <Btn onClick={()=>{setEditProd(null);setModal({type:"product"});}}>+ Nuevo producto</Btn>
              </div>
            </div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                  {["Producto","Proveedor","Stock","ROP","Safety","EOQ","/día","Tendencia","Lead","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {enriched.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                      <td style={{padding:"11px 13px"}}><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontFamily:"monospace",fontSize:10,color:T.textXs}}>{p.barcode||"—"}</div></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{p.sup?.flag}] {p.sup?.name}</td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:p.stock<=(p.alert.rop||0)?T.danger:T.text}}>{p.stock} <span style={{fontWeight:400,color:T.textXs,fontSize:11}}>{p.unit}</span></div>
                        <div style={{marginTop:5,width:72}}><StockBar stock={p.stock} r={p.alert.rop} ss={p.alert.ss} max={Math.max(p.stock*1.6,p.alert.rop*2.5)}/></div>
                      </td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.textMd}}>{p.alert.rop>0?`${p.alert.rop} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.ss>0?`${p.alert.ss} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.eoq>0?`${p.alert.eoq} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.daily>0?`${p.alert.daily.toFixed(1)}`:"—"}</td>
                      <td style={{padding:"11px 13px"}}><Spark history={p.history} color={p.sup?.color||T.textXs}/></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{totalLead(p.sup)}d</td>
                      <td style={{padding:"11px 13px"}}><AlertPill level={p.alert.level}/></td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{display:"flex",gap:6}}>
                          <Btn small variant="ghost" onClick={()=>{setEditProd(products.find(x=>x.id===p.id));setModal({type:"product"});}}>Editar</Btn>
                          <Btn small onClick={()=>setModal({type:"order",product:products.find(x=>x.id===p.id)})}>Pedir</Btn>
                          <Btn small variant="danger" onClick={()=>setProducts(ps=>ps.filter(x=>x.id!==p.id))}>×</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ORDERS ══ */}
        {tab==="orders"&&(
          <div className="au" style={{display:"grid",gap:22}}>
            <div><Cap style={{color:T.green}}>Historial</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Pedidos</h1></div>
            {!orders.length?(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"48px 32px",textAlign:"center",background:T.card}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm}}>Sin pedidos aún. Generá uno desde el panel o el inventario.</p>
              </div>
            ):(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Producto","Proveedor","Cantidad","Pedido","Llegada est.","Flete","Costo","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {orders.map(o=>{
                      const sup=getSup(o.supplierId);const pending=o.status==="pending";const bd=o.leadBreakdown;
                      return(
                        <tr key={o.id} style={{borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                          onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{o.productName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{sup?.flag}] {o.supplierName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>{o.qty} {o.unit}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{fmtShort(o.orderedAt)}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600,color:pending?T.watch:T.ok}}>{fmtDate(o.expectedArrival)}</td>
                          <td style={{padding:"11px 13px"}}>{bd&&<div style={{display:"flex",gap:1,height:6,width:72,borderRadius:2,overflow:"hidden"}}>{Object.values(bd).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.7}}/>)}</div>}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>USD {o.totalCost}</td>
                          <td style={{padding:"11px 13px"}}><AlertPill level={pending?"watch":"ok"}/></td>
                          <td style={{padding:"11px 13px"}}>{pending&&<Btn small variant="success" onClick={()=>markDelivered(o.id)}>✓ Recibido</Btn>}</td>
                        <td style={{padding:"8px 13px"}}><button onClick={(e)=>{e.stopPropagation();LS.set('aryes-picking-pendiente',[{productoNombre:o.productName,cantidad:o.qty,productoId:o.productId||''}]);setTab('deposito');}} style={{background:"#3a7d1e",color:"#fff",border:"none",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>Picking</button></td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ SUPPLIERS ══ */}
        {tab==="suppliers"&&(
          <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div>
                <Cap style={{color:T.green}}>Gestión</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Proveedores</h1>
              </div>
              <Btn onClick={()=>{setEditSup(null);setModal({type:"supplierForm"});}}>+ Nuevo proveedor</Btn>
            </div>

            {/* Supplier cards grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
              {suppliers.map(sup=>{
                const supProds=enriched.filter(p=>p.supplierId===sup.id);
                const alerts=supProds.filter(p=>p.alert.level!=="ok");
                const criticals=supProds.filter(p=>p.alert.level==="order_now");
                const pending=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending");
                const totalSpent=orders.filter(o=>o.supplierId===sup.id&&o.status==="delivered").reduce((s,o)=>s+(+o.totalCost||0),0);
                const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
                const tfs=["preparation","customs","freight","warehouse"];
                return(
                  <div key={sup.id} style={{background:T.card,border:`1px solid ${criticals.length>0?T.dangerBd:T.border}`,borderRadius:8,overflow:"hidden",transition:"box-shadow .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.07)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

                    {/* Card header */}
                    <div style={{padding:"16px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{background:sup.color+"22",color:sup.color,fontFamily:T.sans,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3}}>{sup.flag}</span>
                          <span style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text}}>{sup.name}</span>
                        </div>
                        {sup.company&&<p style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.company}</p>}
                        {sup.contact&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:1}}>👤 {sup.contact}</p>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <Stars value={sup.rating||3}/>
                        <div style={{fontFamily:T.sans,fontSize:10,color:sup.active?T.ok:T.textXs,fontWeight:600,marginTop:4}}>{sup.active?"● Activo":"○ Inactivo"}</div>
                      </div>
                    </div>

                    {/* Lead time bar */}
                    <div style={{padding:"10px 18px",background:T.cardWarm,borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <Cap>Lead time</Cap>
                        <Cap style={{color:sup.color}}>{totalLead(sup)} días totales</Cap>
                      </div>
                      <div style={{display:"flex",gap:2,height:6,borderRadius:3,overflow:"hidden"}}>
                        {tfs.map((k,i)=><div key={k} style={{flex:sup.times[k]||0.1,background:tfCols[i],opacity:.75}}/>)}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border}}>
                      {[
                        {l:"Productos",v:supProds.length},
                        {l:"En tránsito",v:pending.length,c:pending.length>0?T.watch:T.textSm},
                        {l:"Comprado",v:`${sup.currency||"USD"} ${totalSpent.toFixed(0)}`},
                      ].map((s,i)=>(
                        <div key={i} style={{background:T.card,padding:"10px 12px",textAlign:"center"}}>
                          <Cap>{s.l}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:s.c||T.text,marginTop:3}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Alert strip */}
                    {criticals.length>0&&(
                      <div style={{padding:"8px 18px",background:T.dangerBg,borderTop:`1px solid ${T.dangerBd}`}}>
                        <p style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>
                          ● {criticals.length} producto{criticals.length>1?"s requieren":"requiere"} pedido inmediato: {criticals.map(p=>p.name).join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Commercial conditions summary */}
                    <div style={{padding:"10px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {sup.paymentTerms&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>💳 {sup.paymentTerms}d pago</span>}
                      {sup.minOrder>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>📦 Min. {sup.currency||"USD"} {sup.minOrder}</span>}
                      {sup.discount>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>🏷 {sup.discount}% dto.</span>}
                      {sup.email&&<a href={"mailto:"+sup.email} style={{fontFamily:T.sans,fontSize:11,color:T.green,textDecoration:"none"}}>✉ Email</a>}
                      {sup.whatsapp&&<a href={"https://wa.me/"+sup.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontFamily:T.sans,fontSize:11,color:"#16a34a",textDecoration:"none"}}>💬 WhatsApp</a>}
                    </div>

                    {/* Actions */}
                    <div style={{padding:"12px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                      <Btn small full onClick={()=>setViewSup(sup)}>Ver detalle</Btn>
                      <Btn small variant="ghost" onClick={()=>{setEditSup(sup);setModal({type:"supplierForm"});}}>Editar</Btn>
                      <Btn small variant="danger" onClick={()=>deleteSupplier(sup.id)}>×</Btn>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global lead time comparison table */}
            <div>
              <div style={{marginBottom:10}}><Cap>Comparativa de tiempos y condiciones</Cap></div>
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Proveedor","Prep.","Aduana","Flete","Depósito","Total","Moneda","Pago","Mín.","Dto.","Calif."].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {suppliers.map(sup=>(
                      <tr key={sup.id} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                        onMouseLeave={e=>e.currentTarget.style.background=T.card}
                        onClick={()=>setViewSup(sup)}>
                        <td style={{padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{background:sup.color+"22",color:sup.color,fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:2}}>{sup.flag}</span>
                            <span style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{sup.name}</span>
                          </div>
                        </td>
                        {["preparation","customs","freight","warehouse"].map(k=>(
                          <td key={k} style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,color:T.textMd,textAlign:"center"}}>{sup.times[k]}d</td>
                        ))}
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,fontWeight:700,color:sup.color,textAlign:"center"}}>{totalLead(sup)}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.currency||"USD"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.paymentTerms||"—"}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.minOrder>0?`${sup.minOrder}`:"—"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:sup.discount>0?T.ok:T.textSm,fontWeight:sup.discount>0?600:400}}>{sup.discount>0?`${sup.discount}%`:"—"}</td>
                        <td style={{padding:"10px 12px"}}><Stars value={sup.rating||3}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ PLANNING ══ */}
          <div className="au">
            <PlanningView products={products} suppliers={suppliers} orders={orders} plans={plans} setPlans={setPlans}/>
          </div>
        )}

        {/* ══ MOVEMENTS ══ */}
          <div className="au">
            <MovementsView
              movements={movements}
              products={products}
              suppliers={suppliers}
              onAddManual={m=>{
                addMov(m);
                if(m.type==="manual_in") setProducts(ps=>ps.map(p=>p.id===m.productId?{...p,stock:p.stock+m.qty}:p));
                else if(m.type==="manual_out") setProducts(ps=>ps.map(p=>p.id===m.productId?{...p,stock:Math.max(0,p.stock-m.qty)}:p));
              }}
            />
          </div>
        )}

        {/* ══ SCANNER ══ */}
        {tab==="scanner"&&<div className="au"><Scanner products={products} suppliers={suppliers} onUpdate={(id,qty,name,unit)=>{const p2=products.find(p=>p.id===id);const sup2=p2?suppliers.find(s=>s.id===p2.supplierId):null;setProducts(ps=>ps.map(p=>p.id===id?{...p,stock:p.stock+qty}:p));addMov({type:"scanner_in",productId:id,productName:name||p2?.name||id,supplierId:p2?.supplierId||"",supplierName:sup2?.name||"",qty,unit:unit||p2?.unit||"",note:"Ingreso por scanner"});}}/></div>}

        {/* ══ SETTINGS ══ */}
          <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Configuración</h1></div>
            </div>
            {/* Settings sub-tabs */}
            {(()=>{
              const [settingsTab,setSettingsTab]=useState("freight");
              return(
                <div>
                  <div style={{display:"flex",gap:1,background:T.border,borderRadius:6,overflow:"hidden",maxWidth:400,marginBottom:24}}>
                    {[{id:"freight",l:"Tiempos de flete"},{id:"email",l:"Notificaciones email"}].map(st=>(
                      <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                        style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontFamily:T.sans,fontSize:12,fontWeight:600,
                          background:settingsTab===st.id?T.green:T.card,color:settingsTab===st.id?"#fff":T.textSm}}>
                        {st.l}
                      </button>
                    ))}
                  </div>
                  {settingsTab==="freight"&&(
                    <div style={{maxWidth:680}}>
                      <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginBottom:16,lineHeight:1.6}}>Estos valores determinan el ROP (punto de pedido). Actualizalos cuando cambien las condiciones logísticas.</p>
                      {suppliers.map(sup=>(
                        <div key={sup.id} style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                          <div style={{padding:"12px 18px",background:T.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap>
                            <Cap>Total: {totalLead(sup)} días</Cap>
                          </div>
                          <div style={{padding:"14px 18px",background:T.card}}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                              {[["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]].map(([k,l])=>(
                                <Field key={k} label={l}>
                                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                                    <Inp type="number" min="0" value={sup.times[k]} onChange={e=>setSuppliers(ss=>ss.map(s=>s.id===sup.id?{...s,times:{...s.times,[k]:Math.max(0,+e.target.value)}}:s))} style={{textAlign:"center"}}/>
                                    <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
                                  </div>
                                </Field>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginTop:12}}>
                              {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {settingsTab==="email"&&(
                    <EmailSettings
                      cfg={emailCfg}
                      setCfg={setEmailCfg}
                      enriched={enriched}
                      onTestSend={()=>{}}
                      onManualSend={(prods)=>sendAlertEmail(prods,emailCfg)}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ IMPORTER ══ */}
      
      {tab==="lotes"&&<LotesTab />}
      {tab==="clientes"&&<ClientesTab />}
      {tab==="movimientos"&&<MovimientosTab />}
      
      {tab==="deposito"&&<DepositoTab />}
      
      {tab==="rutas"&&<RutasTab />}
      
        {tab==="recepcion"&&<RecepcionTab />}
        
        {tab==="ventas"&&<VentasTab />}
        
        {tab==="config"&&<ConfigTab />}
        {tab==="importar"&&<ImportTab />}
        
        {tab==="informes"&&<InformesTab />}
        
        {tab==="conteo"&&<ConteoTab />}
        {tab==="packing"&&<PackingTab />}
        {tab==="batch-picking"&&<BatchPickingTab />}
        {tab==="transferencias"&&<TransferenciasTab />}
        
        {tab==="inventory"&&<InventarioTab />}
        {tab==="kpis"&&<KPIsTab />}
        {tab==="tracking"&&<TrackingTab />}
        
        {tab==="devoluciones"&&<DevolucionesTab />}
        {tab==="precios"&&<PreciosTab />}
        {tab==="demanda"&&<DemandaTab />}
        {tab==="audit"&&<AuditTab />}
        </main>

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
    </div>
  );
}

export default AryesApp;
