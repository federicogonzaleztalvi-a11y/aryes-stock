import { useState } from 'react';
import { LS } from '../lib/constants.js';

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

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return {err:e};}
  componentDidCatch(e,i){console.error("[Aryes]",e,i);}
  render(){
    if(this.state.err) return(<div style={{padding:40,textAlign:"center",fontFamily:"sans-serif"}}><h3 style={{color:"#c00"}}>Error en esta sección</h3><p style={{color:"#666",fontSize:13}}>{this.state.err?.message}</p><button onClick={()=>this.setState({err:null})} style={{marginTop:12,padding:"8px 20px",cursor:"pointer",borderRadius:6,border:"1px solid #ddd"}}>Reintentar</button></div>);
    return this.props.children;
  }
}

export default AuditTab;
