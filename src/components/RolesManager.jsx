import React, { useState } from 'react';

const G = '#1a8a3c';
const F = { sans: "'Inter',system-ui,sans-serif" };

// All available tabs with labels grouped
const ALL_TABS = [
  { group: 'Principal', tabs: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inventory', label: 'Inventario' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'suppliers', label: 'Proveedores' },
  ]},
  { group: 'Comercial', tabs: [
    { id: 'clientes', label: 'Clientes' },
    { id: 'ventas', label: 'Ventas' },
    { id: 'portal', label: 'Portal B2B' },
    { id: 'facturacion', label: 'Facturacion' },
    { id: 'precios', label: 'Precios' },
  ]},
  { group: 'Operaciones', tabs: [
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'lotes', label: 'Lotes/Venc.' },
    { id: 'conteo', label: 'Conteo' },
    { id: 'transferencias', label: 'Transferencias' },
    { id: 'deposito', label: 'Deposito' },
    { id: 'rutas', label: 'Rutas' },
    { id: 'tracking', label: 'Tracking' },
    { id: 'recepcion', label: 'Recepcion' },
    { id: 'compras', label: 'Compras' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'packing', label: 'Packing' },
    { id: 'batch-picking', label: 'Batch Picking' },
    { id: 'devoluciones', label: 'Devoluciones' },
  ]},
  { group: 'Analisis', tabs: [
    { id: 'kpis', label: 'KPIs' },
    { id: 'resultados', label: 'Resultados' },
    { id: 'informes', label: 'Informes' },
    { id: 'demanda', label: 'Demanda' },
    { id: 'audit', label: 'Auditoria' },
  ]},
  { group: 'Sistema', tabs: [
    { id: 'importar', label: 'Importar datos' },
    { id: 'config', label: 'Configuracion' },
  ]},
];

var ALL_TAB_IDS = [];
ALL_TABS.forEach(function(g) { g.tabs.forEach(function(t) { ALL_TAB_IDS.push(t.id); }); });

// Default roles as examples
var DEFAULT_ROLES = {
  admin: { label: 'Administrador', desc: 'Acceso completo a todas las funciones', tabs: ALL_TAB_IDS.slice(), editable: false },
  operador: { label: 'Operador', desc: 'Gestion de deposito, rutas y logistica', tabs: ['dashboard','inventory','movimientos','lotes','deposito','transferencias','rutas','tracking','recepcion','scanner','conteo','packing','batch-picking','devoluciones'] },
  vendedor: { label: 'Vendedor', desc: 'Ventas, clientes y facturacion', tabs: ['dashboard','clientes','ventas','facturacion','kpis','resultados','informes','precios'] },
  contador: { label: 'Contador', desc: 'Facturacion, informes y movimientos', tabs: ['dashboard','facturacion','movimientos','resultados','informes','clientes','compras'] },
};

export default function RolesManager({ brandCfg, setBrandCfg }) {
  var savedRoles = brandCfg && brandCfg.custom_roles ? brandCfg.custom_roles : null;
  var roles = savedRoles || DEFAULT_ROLES;

  var [editingRole, setEditingRole] = useState(null);
  var [editTabs, setEditTabs] = useState([]);
  var [editLabel, setEditLabel] = useState('');
  var [editDesc, setEditDesc] = useState('');
  var [newRoleId, setNewRoleId] = useState('');
  var [showNewForm, setShowNewForm] = useState(false);

  function saveRoles(updated) {
    setBrandCfg(function(prev) { return Object.assign({}, prev, { custom_roles: updated }); });
  }

  function startEdit(roleId) {
    var role = roles[roleId];
    setEditingRole(roleId);
    setEditLabel(role.label || roleId);
    setEditDesc(role.desc || '');
    setEditTabs(role.tabs ? role.tabs.slice() : []);
  }

  function saveEdit() {
    if (!editingRole) return;
    var updated = Object.assign({}, roles);
    updated[editingRole] = { label: editLabel, desc: editDesc, tabs: editTabs };
    if (editingRole === 'admin') updated[editingRole].editable = false;
    saveRoles(updated);
    setEditingRole(null);
  }

  function deleteRole(roleId) {
    if (roleId === 'admin') return;
    var updated = Object.assign({}, roles);
    delete updated[roleId];
    saveRoles(updated);
    if (editingRole === roleId) setEditingRole(null);
  }

  function createRole() {
    var id = newRoleId.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!id || roles[id]) return;
    var updated = Object.assign({}, roles);
    updated[id] = { label: newRoleId, desc: '', tabs: ['dashboard'] };
    saveRoles(updated);
    setNewRoleId('');
    setShowNewForm(false);
    startEdit(id);
  }

  function toggleTab(tabId) {
    if (tabId === 'dashboard') return; // dashboard always on
    setEditTabs(function(prev) {
      return prev.includes(tabId) ? prev.filter(function(t) { return t !== tabId; }) : prev.concat([tabId]);
    });
  }

  function selectAllGroup(groupTabs) {
    setEditTabs(function(prev) {
      var ids = groupTabs.map(function(t) { return t.id; });
      var allIn = ids.every(function(id) { return prev.includes(id); });
      if (allIn) {
        return prev.filter(function(t) { return !ids.includes(t) || t === 'dashboard'; });
      } else {
        var merged = prev.slice();
        ids.forEach(function(id) { if (!merged.includes(id)) merged.push(id); });
        return merged;
      }
    });
  }

  var roleEntries = Object.entries(roles);
  var bs = { border: '1px solid #e2e2de', borderRadius: 8, fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: F.sans, fontWeight: 600 };

  return React.createElement('div', { style: { fontFamily: F.sans } },
    // Header
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 15, fontWeight: 700, color: '#1a1a18' } }, 'Roles y permisos'),
        React.createElement('div', { style: { fontSize: 12, color: '#8a8a88', marginTop: 2 } }, 'Configura que ve cada rol. Los cambios aplican al proximo login.')
      ),
      React.createElement('button', {
        onClick: function() { setShowNewForm(true); },
        style: Object.assign({}, bs, { background: G, color: '#fff', border: 'none' })
      }, '+ Nuevo rol')
    ),

    // New role form
    showNewForm && React.createElement('div', {
      style: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }
    },
      React.createElement('input', {
        value: newRoleId, onChange: function(e) { setNewRoleId(e.target.value); },
        placeholder: 'Nombre del rol (ej: supervisor)',
        style: { flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e2de', fontSize: 12, fontFamily: F.sans }
      }),
      React.createElement('button', { onClick: createRole, style: Object.assign({}, bs, { background: G, color: '#fff', border: 'none' }) }, 'Crear'),
      React.createElement('button', { onClick: function() { setShowNewForm(false); setNewRoleId(''); }, style: Object.assign({}, bs, { background: '#fff', color: '#888' }) }, 'Cancelar')
    ),

    // Role cards
    React.createElement('div', { style: { display: 'grid', gap: 10 } },
      roleEntries.map(function(entry) {
        var roleId = entry[0];
        var role = entry[1];
        var isEditing = editingRole === roleId;
        var tabCount = (role.tabs || []).length;
        var isAdmin = roleId === 'admin';

        return React.createElement('div', {
          key: roleId,
          style: { background: '#fff', border: isEditing ? '2px solid ' + G : '1px solid #e2e2de', borderRadius: 10, padding: isEditing ? 16 : 14 }
        },
          // Role header
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement('div', {
                style: { width: 32, height: 32, borderRadius: 8, background: isAdmin ? '#f0fdf4' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }
              }, isAdmin ? '\u{1F451}' : roleId === 'operador' ? '\u{1F4E6}' : roleId === 'vendedor' ? '\u{1F4B0}' : roleId === 'contador' ? '\u{1F4CA}' : '\u{1F464}'),
              React.createElement('div', null,
                isEditing
                  ? React.createElement('input', { value: editLabel, onChange: function(e) { setEditLabel(e.target.value); }, style: { fontSize: 14, fontWeight: 700, border: '1px solid #e2e2de', borderRadius: 6, padding: '2px 8px', fontFamily: F.sans } })
                  : React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: '#1a1a18' } }, role.label || roleId),
                isEditing
                  ? React.createElement('input', { value: editDesc, onChange: function(e) { setEditDesc(e.target.value); }, placeholder: 'Descripcion del rol', style: { fontSize: 11, color: '#888', border: '1px solid #e2e2de', borderRadius: 6, padding: '2px 8px', marginTop: 2, width: 250, fontFamily: F.sans } })
                  : React.createElement('div', { style: { fontSize: 11, color: '#8a8a88', marginTop: 1 } }, role.desc || tabCount + ' tabs habilitadas')
              )
            ),
            React.createElement('div', { style: { display: 'flex', gap: 6 } },
              !isEditing && React.createElement('button', { onClick: function() { startEdit(roleId); }, style: Object.assign({}, bs, { background: '#f9f9f7', color: '#4a4a48' }) }, 'Editar'),
              !isEditing && !isAdmin && React.createElement('button', { onClick: function() { if (confirm('Eliminar el rol "' + (role.label || roleId) + '"?')) deleteRole(roleId); }, style: Object.assign({}, bs, { background: '#fff', color: '#dc2626', borderColor: '#fecaca' }) }, 'Eliminar'),
              isEditing && React.createElement('button', { onClick: saveEdit, style: Object.assign({}, bs, { background: G, color: '#fff', border: 'none' }) }, 'Guardar'),
              isEditing && React.createElement('button', { onClick: function() { setEditingRole(null); }, style: Object.assign({}, bs, { background: '#fff', color: '#888' }) }, 'Cancelar')
            )
          ),

          // Tab checkboxes (only when editing)
          isEditing && React.createElement('div', { style: { marginTop: 14, borderTop: '1px solid #f0ede8', paddingTop: 12 } },
            ALL_TABS.map(function(group) {
              var allIn = group.tabs.every(function(t) { return editTabs.includes(t.id); });
              return React.createElement('div', { key: group.group, style: { marginBottom: 10 } },
                React.createElement('div', {
                  style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' },
                  onClick: function() { selectAllGroup(group.tabs); }
                },
                  React.createElement('input', { type: 'checkbox', checked: allIn, readOnly: true, style: { accentColor: G } }),
                  React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: '#6a6a68', textTransform: 'uppercase', letterSpacing: '0.08em' } }, group.group)
                ),
                React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 20 } },
                  group.tabs.map(function(t) {
                    var checked = editTabs.includes(t.id);
                    var isDash = t.id === 'dashboard';
                    return React.createElement('label', {
                      key: t.id,
                      style: {
                        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                        background: checked ? '#f0fdf4' : '#f9f9f7', border: '1px solid ' + (checked ? '#bbf7d0' : '#e2e2de'),
                        borderRadius: 6, fontSize: 11, color: checked ? '#166534' : '#6a6a68', cursor: isDash ? 'not-allowed' : 'pointer',
                        opacity: isDash ? 0.6 : 1
                      }
                    },
                      React.createElement('input', {
                        type: 'checkbox', checked: checked, disabled: isDash,
                        onChange: function() { toggleTab(t.id); },
                        style: { accentColor: G, width: 12, height: 12 }
                      }),
                      t.label
                    );
                  })
                )
              );
            })
          ),

          // Tab summary (when not editing)
          !isEditing && React.createElement('div', { style: { marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 3 } },
            (role.tabs || []).slice(0, 12).map(function(tabId) {
              return React.createElement('span', {
                key: tabId,
                style: { fontSize: 10, color: '#6a6a68', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }
              }, tabId);
            }),
            (role.tabs || []).length > 12 && React.createElement('span', {
              style: { fontSize: 10, color: '#9a9a98' }
            }, '+' + ((role.tabs || []).length - 12) + ' mas')
          )
        );
      })
    )
  );
}
