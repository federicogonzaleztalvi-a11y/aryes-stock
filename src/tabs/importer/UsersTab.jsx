import { useState } from 'react';
import { LS } from '../../lib/constants.js';
import { USERS } from './catalog-data.js';

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

  const del=async(username)=>{
    if(username===session.username){setMsg('No podés eliminarte a vos mismo');return;}
    const ok = await confirm({ title:`¿Eliminar usuario "${username}"?`, description:'Esta acción no se puede deshacer.', variant:'danger' });
    if(!ok) return;
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



export { UsersTab };
