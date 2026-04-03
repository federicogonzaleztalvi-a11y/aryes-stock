/**
 * Tests for role-based access control.
 * 
 * The useRole hook determines what each user can see and do.
 * A bug here means: vendedor sees admin config, or operador
 * deletes products they shouldn't be able to.
 */
import { describe, it, expect } from 'vitest';

// ── Extracted logic from useRole.ts ──────────────────────────
const LEGACY_PERMS = {
  admin: { inventario: 'full', ventas: 'full', rutas: 'full', config: 'full', facturacion: 'full' },
  operador: { inventario: 'edit', ventas: 'edit', rutas: 'edit', config: 'none', facturacion: 'view' },
  vendedor: { inventario: 'view', ventas: 'edit', rutas: 'none', config: 'none', facturacion: 'none' },
  contador: { inventario: 'none', ventas: 'none', rutas: 'none', config: 'none', facturacion: 'view' },
};

const LEVEL_RANK = { none: 0, view: 1, edit: 2, full: 3 };

function getPerms(role) {
  const permissions = LEGACY_PERMS[role] || LEGACY_PERMS.admin;
  const perm = (modulo) => permissions[modulo] || 'none';
  const hasLevel = (modulo, min) => LEVEL_RANK[perm(modulo)] >= LEVEL_RANK[min];
  return {
    role,
    isAdmin: role === 'admin',
    canWrite: role === 'admin' || role === 'operador',
    canDelete: role === 'admin',
    canSell: role === 'admin' || role === 'vendedor',
    perm,
    canView: (m) => hasLevel(m, 'view'),
    canEdit: (m) => hasLevel(m, 'edit'),
    canFull: (m) => hasLevel(m, 'full'),
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('Role permissions — admin', () => {
  const admin = getPerms('admin');
  it('has full access to everything', () => {
    expect(admin.canFull('inventario')).toBe(true);
    expect(admin.canFull('ventas')).toBe(true);
    expect(admin.canFull('config')).toBe(true);
    expect(admin.canDelete).toBe(true);
  });
});

describe('Role permissions — operador', () => {
  const op = getPerms('operador');
  it('can edit inventory and ventas', () => {
    expect(op.canEdit('inventario')).toBe(true);
    expect(op.canEdit('ventas')).toBe(true);
  });
  it('cannot access config', () => {
    expect(op.canView('config')).toBe(false);
  });
  it('cannot delete', () => {
    expect(op.canDelete).toBe(false);
  });
});

describe('Role permissions — vendedor', () => {
  const vend = getPerms('vendedor');
  it('can only view inventory', () => {
    expect(vend.canView('inventario')).toBe(true);
    expect(vend.canEdit('inventario')).toBe(false);
  });
  it('can edit ventas', () => {
    expect(vend.canEdit('ventas')).toBe(true);
  });
  it('cannot see rutas or config', () => {
    expect(vend.canView('rutas')).toBe(false);
    expect(vend.canView('config')).toBe(false);
  });
  it('can sell', () => {
    expect(vend.canSell).toBe(true);
  });
});

describe('Role permissions — contador', () => {
  const cont = getPerms('contador');
  it('can only view facturacion', () => {
    expect(cont.canView('facturacion')).toBe(true);
    expect(cont.canEdit('facturacion')).toBe(false);
  });
  it('cannot access anything else', () => {
    expect(cont.canView('inventario')).toBe(false);
    expect(cont.canView('ventas')).toBe(false);
    expect(cont.canView('rutas')).toBe(false);
  });
});

describe('Role permissions — unknown role', () => {
  it('falls back to admin permissions', () => {
    const unknown = getPerms('randomrole');
    expect(unknown.canFull('inventario')).toBe(true);
  });
});
