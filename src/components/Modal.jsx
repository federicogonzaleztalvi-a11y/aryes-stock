import React from 'react';
import { T, Cap } from '../lib/ui.jsx';

const Modal=({title,sub,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(245,240,232,.9)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:20}}>
    <div className="au" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:"100%",maxWidth:wide?840:540,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 16px 60px rgba(0,0,0,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 28px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          {sub&&<Cap style={{color:T.green}}>{sub}</Cap>}
          <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginTop:sub?4:0,letterSpacing:"-.01em"}}>{title}</h2>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textXs,fontSize:22,lineHeight:1,padding:4,marginTop:2}}>✕</button>
      </div>
      <div style={{padding:"22px 28px 28px"}}>{children}</div>
    </div>
  </div>
);

export default Modal;
