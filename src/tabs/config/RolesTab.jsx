import { useState, useEffect } from 'react';
import { db, getOrgId } from '../../lib/constants.js';

const G = '#1a8a3c';
const F = { sans: "'Inter',system-ui,sans-serif" };

const MODULOS = [
  { id: 'inventario',   label: 'Inventario',    icon: '📦' },
  { id: 'ventas',       label: 'Ventas',         icon: '🛒' },
  { id: 'rutas',        label: 'Rutas',          icon: '🗺️' },
  { id: 'compras',      label: 'Compras',        icon: '🚚' },
  { id: 'clientes',     label: 'Clientes',       icon: '👥' },
  { id: 'facturacion',  label: 'Facturación',    icon: '🧾' },
  { id: 'precios',      label: 'Precios',        icon: '💲' },
  { id: 'deposito',     label: 'Depósito',       icon: '🏭' },
  { id: 'resultados',   label: 'Resultados',     icon: '📊' },
  { id: 'config',       label: 'Configuración',  icon: '⚙️' },
];

const NIVELES = [
  { id: 'none', label: 'Sin acceso',    color: '#dc2626', bg: '#fef2f2' },
  { id: 'view', label: 'Solo ver',      color: '#d97706', bg: '#fffbeb' },
  { id: 'edit', label: 'Ver y editar',  color: '#2563eb', bg: '#eff6ff' },
  { id: 'full', label: 'Control total', color: '#16a34a', bg: '#f0fdf4' },
];

const DEFAULT_PERMS = Object.fromEntries(MODULOS.map(m => [m.id, 'edit']));
const PREDEFINED_IDS = ['aryes-admin', 'aryes-operador', 'aryes-vendedor'];

const inp = { width: '100%', boxSizing: 'border-box', fontFamily: F.sans, fontSize: 14, color: '#1a1a18', background: '#fff', border: '1px solid #e2e2de', padding: '9px 12px', borderRadius: 6, outline: 'none' };
const btn = (color, bg) => ({ fontFamily: F.sans, fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', color, background: bg });

export default function RolesTab({ session }) {
  const [roles, setRoles]     = useState([]);
  const [vista, setVista]     = useState('lista');
  const [editId, setEditId]   = useState(null);
  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState({ nombre: '', descripcion: '', permissions: { ...DEFAULT_PERMS } });
  const orgId = getOrgId();

  useEffect(() => { loadRoles(); }, []);

  const loadRoles = async () => {
    const rows = await db.get('roles', `org_id=eq.${orgId}&order=nombre.asc`);
    if (rows) setRoles(rows);
  };

  const setNivel = (modulo, nivel) =>
    setForm(f => ({ ...f, permissions: { ...f.permissions, [modulo]: nivel } }));

  const openNew = () => {
    setForm({ nombre: '', descripcion: '', permissions: { ...DEFAULT_PERMS } });
    setEditId(null); setVista('form');
  };

  const openEdit = (r) => {
    setForm({ nombre: r.nombre, descripcion: r.descripcion || '', permissions: { ...DEFAULT_PERMS, ...(r.permissions || {}) } });
    setEditId(r.id); setVista('form');
  };

  const save = async () => {
    if (!form.nombre.trim()) { setMsg('El nombre es obligatorio'); return; }
    setLoading(true);
    try {
      if (editId) {
        await db.patch('roles', { nombre: form.nombre, descripcion: form.descripcion, permissions: form.permissions, updated_at: new Date().toISOString() }, { id: editId });
      } else {
        await db.insert('roles', { nombre: form.nombre, descripcion: form.descripcion, permissions: form.permissions, org_id: orgId });
      }
      setMsg(editId ? '✅ Rol actualizado' : '✅ Rol creado');
      await loadRoles();
      setVista('lista');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Error al guardar'); }
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar este rol?')) return;
    await db.del('roles', { id });
    await loadRoles();
    setMsg('Rol eliminado'); setTimeout(() => setMsg(''), 3000);
  };

  // ── Lista ──────────────────────────────────────────────────────────────────
  if (vista === 'lista') return (
    <div style={{ fontFamily: F.sans }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a18' }}>Roles y permisos</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6a6a68' }}>Definí qué puede ver y hacer cada rol</p>
        </div>
        <button onClick={openNew} style={{ ...btn('#fff', G) }}>+ Nuevo rol</button>
      </div>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16a34a' }}>{msg}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {roles.map(r => {
          const isPredefined = PREDEFINED_IDS.some(pid => r.id === pid);
          const perms = r.permissions || {};
          return (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e2de', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a18' }}>{r.nombre}</span>
                  {isPredefined && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: '#6a6a68', background: '#f4f3f0', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>predefinido</span>}
                  {r.descripcion && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6a6a68' }}>{r.descripcion}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(r)} style={{ ...btn('#1a1a18', '#f4f3f0'), fontSize: 12 }}>Editar</button>
                  {!isPredefined && <button onClick={() => del(r.id)} style={{ ...btn('#dc2626', '#fef2f2'), fontSize: 12 }}>Eliminar</button>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {MODULOS.map(m => {
                  const nivel = NIVELES.find(n => n.id === (perms[m.id] || 'none'));
                  if (!nivel || nivel.id === 'none') return null;
                  return (
                    <span key={m.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: nivel.bg, color: nivel.color, fontWeight: 600 }}>
                      {m.icon} {m.label}: {nivel.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Formulario ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: F.sans, maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setVista('lista')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888' }}>←</button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? 'Editar rol' : 'Nuevo rol'}</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Nombre del rol *</label>
          <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Facturación, Logística, Repartidor..." />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Descripción</label>
          <input style={inp} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Acceso a facturación y cobros únicamente" />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Permisos por módulo</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {MODULOS.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', padding: '8px 12px', borderRadius: 6, background: '#faf9f6' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{m.icon} {m.label}</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {NIVELES.map(n => (
                  <button key={n.id} onClick={() => setNivel(m.id, n.id)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, border: `1.5px solid ${form.permissions[m.id] === n.id ? n.color : '#e2e2de'}`, cursor: 'pointer', background: form.permissions[m.id] === n.id ? n.bg : '#fff', color: form.permissions[m.id] === n.id ? n.color : '#9a9a98', transition: 'all .15s' }}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={loading} style={{ ...btn('#fff', G), opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear rol'}
        </button>
        <button onClick={() => setVista('lista')} style={btn('#6a6a68', '#f4f3f0')}>Cancelar</button>
      </div>
    </div>
  );
}
