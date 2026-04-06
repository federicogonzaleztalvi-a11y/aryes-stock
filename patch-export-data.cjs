#!/usr/bin/env node
// patch-export-data.cjs — Add "Datos" settings tab with export button to ConfigInline

const fs = require('fs');
const path = require('path');

const cfgPath = path.join(process.cwd(), 'src/tabs/ConfigInline.jsx');
let cfg = fs.readFileSync(cfgPath, 'utf8');

if (cfg.includes('exportar-datos') || cfg.includes('Exportar datos')) {
  console.log('⏭  ConfigInline.jsx: export already exists');
  process.exit(0);
}

// 1. Add "Datos" to the settings tabs list
cfg = cfg.replace(
  '{id:"portal",l:"Portal B2B"}',
  '{id:"portal",l:"Portal B2B"},{id:"datos",l:"Datos"}'
);
console.log('✅ Added "Datos" tab to settings tabs');

// 2. Find the last settingsTab section and add the datos section after it
// We'll add after the integraciones section closing
const exportSection = `

          {settingsTab==="datos" && (
            <div>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Exportar datos</h3>
              <p style={{fontSize:13,color:'#6a6a68',marginBottom:16}}>Descargá todos los datos de tu organización en formato CSV. Incluye productos, clientes, ventas, facturas, cobros, rutas y más.</p>
              <button
                id="exportar-datos"
                onClick={async()=>{
                  const btn=document.getElementById('exportar-datos');
                  btn.textContent='Exportando...';btn.disabled=true;
                  try{
                    const SB=import.meta.env.VITE_SUPABASE_URL;
                    const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
                    const token=JSON.parse(localStorage.getItem('sb-mrotnqybqvmvlexncvno-auth-token')||'{}')?.access_token;
                    const h={apikey:KEY,Authorization:'Bearer '+(token||KEY),Accept:'application/json'};
                    const tables=['products','clients','suppliers','ventas','invoices','collections','orders','rutas','stock_movements','recepciones','devoluciones','lotes','price_lists','price_list_items','conteos'];
                    const results={};
                    for(const t of tables){
                      const r=await fetch(SB+'/rest/v1/'+t+'?limit=10000',{headers:h});
                      if(r.ok){const d=await r.json();results[t]=d;}
                    }
                    const toCsv=(arr)=>{
                      if(!arr||!arr.length)return'';
                      const cols=Object.keys(arr[0]);
                      const header=cols.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',');
                      const rows=arr.map(row=>cols.map(c=>{const v=row[c];return'"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(','));
                      return header+'\\n'+rows.join('\\n');
                    };
                    let allContent='';
                    for(const[name,data]of Object.entries(results)){
                      if(data&&data.length){
                        const csv=toCsv(data);
                        allContent+='\\n\\n===== '+name.toUpperCase()+' ('+data.length+' registros) =====\\n'+csv;
                      }
                    }
                    if(!allContent){btn.textContent='Sin datos para exportar';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},2000);return;}
                    const blob=new Blob([allContent],{type:'text/csv;charset=utf-8;'});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement('a');
                    a.href=url;a.download='aryes-export-'+new Date().toISOString().slice(0,10)+'.csv';
                    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                    btn.textContent='Descarga lista ✓';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},3000);
                  }catch(e){
                    console.error('Export error:',e);
                    btn.textContent='Error al exportar';setTimeout(()=>{btn.textContent='Exportar todos mis datos';btn.disabled=false;},3000);
                  }
                }}
                style={{padding:'10px 24px',background:'#1a8a3c',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer'}}
              >Exportar todos mis datos</button>
              <p style={{fontSize:11,color:'#9a9a98',marginTop:12}}>El archivo incluye todos tus datos en formato CSV. Podés abrirlo en Excel, Google Sheets o cualquier herramienta de análisis.</p>

              <div style={{marginTop:32,paddingTop:20,borderTop:'1px solid #e2e2de'}}>
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:4,color:'#dc2626'}}>Eliminar cuenta</h3>
                <p style={{fontSize:13,color:'#6a6a68',marginBottom:12}}>Si querés eliminar tu cuenta y todos tus datos, escribinos a contacto@aryes.com. Tus datos se eliminan de forma permanente en un plazo de 30 días.</p>
              </div>
            </div>
          )}`;

// Insert after the last settingsTab section
const insertAnchor = '{settingsTab==="integraciones" && (';
const integIdx = cfg.lastIndexOf(insertAnchor);
if (integIdx === -1) {
  console.log('⚠️  Could not find integraciones section');
  process.exit(1);
}

// Find the matching closing for integraciones section
// We need to find the closing )} for this section
let depth = 0;
let searchStart = integIdx;
let insertPos = -1;
for (let i = searchStart; i < cfg.length; i++) {
  if (cfg[i] === '{') depth++;
  if (cfg[i] === '}') {
    depth--;
    if (depth === 0) {
      // Found the closing of the settingsTab==="integraciones" block
      // But we need to go past the closing )}
      insertPos = i + 1;
      break;
    }
  }
}

if (insertPos === -1) {
  // Fallback: insert before the last </div> of the component
  console.log('⚠️  Using fallback insertion');
  const lastSettingsTab = cfg.lastIndexOf('{settingsTab===');
  // Find next })} after it
  insertPos = cfg.indexOf(')}', cfg.indexOf(')}', lastSettingsTab) + 2) + 2;
}

// Actually let's use a simpler approach - find the portal section and add after it
const portalAnchor = '{settingsTab==="portal" && (';
const portalIdx = cfg.lastIndexOf(portalAnchor);
if (portalIdx !== -1) {
  // Find the end of the portal section by counting braces
  let d = 0;
  let pos = -1;
  for (let i = portalIdx; i < cfg.length; i++) {
    if (cfg[i] === '{') d++;
    if (cfg[i] === '}') {
      d--;
      if (d === 0) { pos = i + 1; break; }
    }
  }
  if (pos !== -1) {
    cfg = cfg.slice(0, pos) + exportSection + cfg.slice(pos);
    console.log('✅ Added export section after Portal B2B');
  }
} else {
  console.log('⚠️  Could not find portal section');
}

fs.writeFileSync(cfgPath, cfg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Data export patched!
  - New "Datos" tab in Config
  - "Exportar todos mis datos" button
  - Downloads CSV with all tables
  - "Eliminar cuenta" section with instructions
══════════════════════════════════════════════`);
