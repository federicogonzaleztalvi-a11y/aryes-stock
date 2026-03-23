import React, { useState } from 'react';
import { T, Modal, Inp, Sel, Field, Btn } from '../lib/ui.jsx';

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

export default ManualMovModal;
