import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../components/ConfirmDialog.jsx';

const G = '#059669';
const ROLES = ['admin', 'operador', 'vendedor'];
const ROLE_COLORS = { admin: '#7c3aed', operador: '#2563eb', vendedor: '#059669' };
const ROLE_LABELS = { admin: 'Administrador', operador: 'Operador', vendedor: 'Vendedor' };

const inp = {
  padding: '8px 12px', border: '1px solid #e2e2de', borderRadius: 6,
  fontSize: 13, fontFamily: 'Inter,sans-serif', width: '100%', boxSizing: 'border-box',
};

function getToken() {
  try { return JSON.parse(localStorage.getItem('aryes-session') || 'null')?.access_token || ''; }
  catch { /* non-blocking */ }
}

async function apiCall(action, method, body) {
  const res = await fetch(`/api/admin-users?action=${action}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error desconocido');
  return data;
}

export default function UsersTab({ session }) {
  const { confirm } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: 'ok' });
  const [view, setView] = useState('list'); // list | create | edit | reset
  const [selected, setSelected] = useState(null);

  // Create form
  const emptyForm = { email: '', password: '', name: '', role: 'operador' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Reset password
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const showMsg = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('list', 'GET');
      setUsers(Array.isArray(data) ? data : []);
    } catch { /* non-blocking */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (saving) return;
    if (!form.email || !form.password || !form.name) {
      showMsg('Todos los campos son requeridos', 'err'); return;
    }
    if (form.password.length < 6) {
      showMsg('La contraseña debe tener al menos 6 caracteres', 'err'); return;
    }
    setSaving(true);
    try {
      await apiCall('create', 'POST', form);
      showMsg('✓ Usuario creado correctamente');
      setForm(emptyForm);
      setView('list');
      await loadUsers();
    } catch { /* non-blocking */ } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (email, role) => {
    try {
      await apiCall('update', 'PATCH', { email, role });
      setUsers(us => us.map(u => u.email === email ? { ...u, role } : u));
      showMsg('✓ Rol actualizado');
    } catch { /* non-blocking */ }
  };

  const handleToggleActive = async (user) => {
    const newActive = !user.active;
    if (!newActive && user.email === session?.email) {
      showMsg('No podés desactivarte a vos mismo', 'err'); return;
    }
    try {
      await apiCall('update', 'PATCH', { email: user.email, active: newActive });
      setUsers(us => us.map(u => u.email === user.email ? { ...u, active: newActive } : u));
      showMsg(`✓ Usuario ${newActive ? 'activado' : 'desactivado'}`);
    } catch { /* non-blocking */ }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMsg('La contraseña debe tener al menos 6 caracteres', 'err'); return;
    }
    setSaving(true);
    try {
      await apiCall('reset-password', 'PATCH', { email: selected.email, newPassword });
      showMsg('✓ Contraseña actualizada correctamente');
      setNewPassword('');
      setView('list');
      setSelected(null);
    } catch { /* non-blocking */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (user.email === session?.email) {
      showMsg('No podés eliminarte a vos mismo', 'err'); return;
    }
    const ok = await confirm({ title:`¿Eliminar a ${user.name}?`, description:`${user.email} — Esta acción no se puede deshacer.`, variant:'danger' });
    if (!ok) return;
    try {
      await apiCall('delete', 'DELETE', { email: user.email });
      setUsers(us => us.filter(u => u.email !== user.email));
      showMsg('✓ Usuario eliminado');
    } catch { /* non-blocking */ }
  };

  const MsgBanner = () => {
    if (!msg.text) return null;
    const isErr = msg.type === 'err';
    return (
      <div style={{
        background: isErr ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
        borderRadius: 8, padding: '10px 16px', marginBottom: 16,
        color: isErr ? '#dc2626' : G, fontSize: 13,
      }}>{msg.text}</div>
    );
  };

  // ── CREATE VIEW ─────────────────────────────────────────────────────────
  if (view === 'create') return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button onClick={() => { setView('list'); setForm(emptyForm); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' }}>←</button>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 24, margin: 0 }}>Nuevo usuario</h2>
      </div>
      <MsgBanner />
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'grid', gap: 14 }}>
        {[
          { label: 'Nombre completo', key: 'name', type: 'text', placeholder: 'Juan García' },
          { label: 'Email', key: 'email', type: 'email', placeholder: 'juan@empresa.com' },
          { label: 'Contraseña inicial', key: 'password', type: 'password', placeholder: 'Mínimo 6 caracteres' },
        ].map(f => (
          <div key={f.key}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>{f.label}</label>
            <input type={f.type} value={form[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder} style={inp} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Rol</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROLES.map(r => (
              <button key={r} onClick={() => setForm(v => ({ ...v, role: r }))}
                style={{ flex: 1, padding: '8px 0', border: `2px solid ${form.role === r ? ROLE_COLORS[r] : '#e2e2de'}`, borderRadius: 8, background: form.role === r ? ROLE_COLORS[r] : '#fff', color: form.role === r ? '#fff' : '#444', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #f0f0ee' }}>
          <button onClick={() => { setView('list'); setForm(emptyForm); }}
            style={{ padding: '9px 20px', border: '1px solid #e2e2de', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: '9px 24px', background: saving ? '#9ca3af' : G, color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── RESET PASSWORD VIEW ─────────────────────────────────────────────────
  if (view === 'reset' && selected) return (
    <div style={{ maxWidth: 440 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button onClick={() => { setView('list'); setSelected(null); setNewPassword(''); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666' }}>←</button>
        <h2 style={{ fontFamily: 'Playfair Display,serif', fontSize: 24, margin: 0 }}>Resetear contraseña</h2>
      </div>
      <MsgBanner />
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'grid', gap: 16 }}>
        <div style={{ padding: '12px 16px', background: '#f9f9f7', borderRadius: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{selected.name}</span>
          <span style={{ color: '#6a6a68', marginLeft: 8 }}>{selected.email}</span>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Nueva contraseña</label>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder='Mínimo 6 caracteres'
              style={{ ...inp, paddingRight: 44 }} />
            <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a98', fontSize: 14 }}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #f0f0ee' }}>
          <button onClick={() => { setView('list'); setSelected(null); setNewPassword(''); }}
            style={{ padding: '9px 20px', border: '1px solid #e2e2de', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleResetPassword} disabled={saving}
            style={{ padding: '9px 24px', background: saving ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13 }}>
            {saving ? 'Actualizando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── LIST VIEW ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 12, color: '#6a6a68', margin: '4px 0 0', lineHeight: 1.5 }}>
            Gestioná los usuarios del sistema. Solo los admins pueden crear, editar o eliminar usuarios.
          </p>
        </div>
        <button onClick={() => { setForm(emptyForm); setView('create'); }}
          style={{ background: G, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          + Nuevo usuario
        </button>
      </div>
      <MsgBanner />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9a9a98', fontSize: 13 }}>Cargando usuarios…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
          <p style={{ color: '#6a6a68', fontSize: 14 }}>No hay usuarios cargados aún</p><p style={{ color: '#9a9a98', fontSize: 13 }}>Agregá operadores y vendedores desde el botón de arriba</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9f9f7', borderBottom: '2px solid #e2e2de' }}>
                {['Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6a6a68', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isSelf = u.email === session?.email;
                return (
                  <tr key={u.email || i} style={{ borderBottom: '1px solid #f0f0ee', background: u.active === false ? '#fafafa' : '#fff', opacity: u.active === false ? 0.7 : 1 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: u.active === false ? '#9a9a98' : '#1a1a18' }}>
                      {u.name || u.username || '—'}
                      {isSelf && <span style={{ marginLeft: 6, fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>Vos</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6a6a68' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select value={u.role || 'operador'}
                        onChange={e => handleUpdateRole(u.email, e.target.value)}
                        disabled={isSelf}
                        style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${ROLE_COLORS[u.role] || '#e2e2de'}`, background: '#fff', fontSize: 12, fontWeight: 600, color: ROLE_COLORS[u.role] || '#444', cursor: isSelf ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => handleToggleActive(u)} disabled={isSelf}
                        style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 700, cursor: isSelf ? 'not-allowed' : 'pointer', background: u.active !== false ? '#dcfce7' : '#fee2e2', color: u.active !== false ? '#16a34a' : '#dc2626' }}>
                        {u.active !== false ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setSelected(u); setView('reset'); }}
                          style={{ padding: '5px 10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          🔑 Contraseña
                        </button>
                        {!isSelf && (
                          <button onClick={() => handleDelete(u)}
                            style={{ padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
