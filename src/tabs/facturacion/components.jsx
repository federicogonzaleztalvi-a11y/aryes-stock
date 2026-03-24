// ─── Facturación — shared React micro-components ────────────────────────────
import React from 'react';
import { CFE_STATUS, F, G } from './constants.js';

// ─── Micro-components ─────────────────────────────────────────────────────
export const Pill = ({ status }) => {
  const s = CFE_STATUS[status] || CFE_STATUS.borrador;
  return (
    <span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,
      background:s.bg,color:s.color,fontFamily:F.sans,letterSpacing:'.02em'}}>
      {s.label}
    </span>
  );
};

export const TabBtn = ({ active, onClick, children }) =>
  <button onClick={onClick} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',
    fontFamily:F.sans,fontSize:12,fontWeight:600,
    background:active?G:'transparent',color:active?'#fff':'#6a6a68',
    transition:'all .15s'}}>
    {children}
  </button>;

export const Lbl = ({ children }) =>
  <label style={{fontFamily:F.sans,fontSize:11,fontWeight:600,color:'#6a6a68',letterSpacing:'.06em',
    textTransform:'uppercase',display:'block',marginBottom:4}}>
    {children}
  </label>;

export const Inp = ({ style={}, ...p }) =>
  <input {...p} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e2de',borderRadius:6,
    fontFamily:F.sans,fontSize:13,outline:'none',background:'#fff',boxSizing:'border-box',...style}} />;

export const Sel = ({ children, style={}, ...p }) =>
  <select {...p} style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e2de',borderRadius:6,
    fontFamily:F.sans,fontSize:13,outline:'none',background:'#fff',boxSizing:'border-box',...style}}>
    {children}
  </select>;

export const KpiCard = ({ label, value, sub, accent='#e2e2de', danger=false, onClick }) =>
  <div onClick={onClick} style={{background:'#fff',border:`1px solid ${accent}`,borderRadius:10,
    padding:'14px 18px',cursor:onClick?'pointer':'default',
    borderLeft:`4px solid ${danger?'#dc2626':accent}`}}>
    <div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',fontWeight:600,letterSpacing:'.06em',
      textTransform:'uppercase',marginBottom:6}}>{label}</div>
    <div style={{fontFamily:F.serif,fontSize:24,fontWeight:500,color:danger?'#dc2626':'#1a1a1a',
      lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontFamily:F.sans,fontSize:11,color:'#9a9a98',marginTop:4}}>{sub}</div>}
  </div>;
