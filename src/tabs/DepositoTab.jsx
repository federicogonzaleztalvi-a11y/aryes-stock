import { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { LS } from '../lib/constants.js';

function DepositoTab(){
  const { products: prods } = useApp();
  const G="#3a7d1e";
  const KDEP="aryes-deposito";
  const ZONAS=[{id:'A',label:'Zona A - Ambiente',color:'#3b82f6'},{id:'F',label:'Zona F - Frio/Freezer',color:'#06b6d4'}];
  const [config,setConfig]=useState(()=>LS.get(KDEP,{pasillos:8,estantes:4,niveles:3,posiciones:6,zonas:['A','F']}));
  const [ubicaciones,setUbicaciones]=useState(()=>LS.get('aryes-ubicaciones',[]));
  const [lotes]=useState(()=>LS.get('aryes-lots',[]));
  const [_vista,_setVista]=useState('mapa');
  const [zonaActiva,setZonaActiva]=useState('A');
  const [prodSelec,setProdSelec]=useState('');
  const [ubSelec,setUbSelec]=useState(null);
  const [msg,setMsg]=useState('');
  const [showConfig,setShowConfig]=useState(false);

  const genId=(zona,pasillo,estante,nivel,pos)=>
    zona+'-'+String(pasillo).padStart(2,'0')+'-'+estante+'-'+nivel+'-'+String(pos).padStart(2,'0');

  const getUbicacion=(id)=>ubicaciones.find(u=>u.id===id);
  const getProducto=(id)=>prods.find(p=>p.id===id);

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
      const ub=ubicaciones.find(u=>u.productoId===item.productoId);
      const prod=getProducto(item.productoId);
      const lotesItem=lotes.filter(l=>l.productoId===item.productoId)
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
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:28,color:'#1a1a1a',margin:0}}>Depósito</h2>
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
            <span>■ <span style={{color:G}}>Ocupada</span></span>
            <span>■ <span style={{color:'#e5e7eb'}}>Libre</span></span>
            <span>■ <span style={{color:'#f59e0b'}}>Seleccionada</span></span>
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

export default DepositoTab;
