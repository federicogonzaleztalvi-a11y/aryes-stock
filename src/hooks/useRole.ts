/**
 * useRole — reads permissions from the user session.
 * Supports both legacy hardcoded roles and dynamic roles with JSONB permissions.
 * Permission levels: none | view | edit | full
 */
import { useApp } from '../context/AppContext.tsx';

export type PermLevel = 'none' | 'view' | 'edit' | 'full';

export interface RoleFlags {
  role:        string;
  isAdmin:     boolean;
  isOperador:  boolean;
  isVendedor:  boolean;
  canWrite:    boolean;
  canDelete:   boolean;
  canSell:     boolean;
  perm:        (modulo: string) => PermLevel;
  canView:     (modulo: string) => boolean;
  canEdit:     (modulo: string) => boolean;
  canFull:     (modulo: string) => boolean;
}

// Default permissions for legacy hardcoded roles
const LEGACY_PERMS: Record<string, Record<string, PermLevel>> = {
  admin: {
    inventario: 'full', ventas: 'full', rutas: 'full', compras: 'full',
    clientes: 'full', facturacion: 'full', precios: 'full', deposito: 'full',
    resultados: 'full', config: 'full',
  },
  operador: {
    inventario: 'edit', ventas: 'edit', rutas: 'edit', compras: 'edit',
    clientes: 'edit', facturacion: 'view', precios: 'view', deposito: 'edit',
    resultados: 'view', config: 'none',
  },
  vendedor: {
    inventario: 'view', ventas: 'edit', rutas: 'none', compras: 'none',
    clientes: 'edit', facturacion: 'none', precios: 'view', deposito: 'none',
    resultados: 'view', config: 'none',
  },
};

const LEVEL_RANK: Record<PermLevel, number> = { none: 0, view: 1, edit: 2, full: 3 };

export function useRole(): RoleFlags {
  const { session } = useApp();
  const role = session?.role ?? 'admin';

  // Use dynamic permissions from session if available, fallback to legacy
  const permissions: Record<string, PermLevel> =
    (session as any)?.permissions || LEGACY_PERMS[role] || LEGACY_PERMS.admin;

  const perm = (modulo: string): PermLevel =>
    (permissions[modulo] as PermLevel) ?? 'none';

  const hasLevel = (modulo: string, min: PermLevel) =>
    LEVEL_RANK[perm(modulo)] >= LEVEL_RANK[min];

  return {
    role,
    isAdmin:    role === 'admin',
    isOperador: role === 'operador',
    isVendedor: role === 'vendedor',
    canWrite:   role === 'admin' || role === 'operador',
    canDelete:  role === 'admin',
    canSell:    role === 'admin' || role === 'vendedor',
    perm,
    canView:    (m) => hasLevel(m, 'view'),
    canEdit:    (m) => hasLevel(m, 'edit'),
    canFull:    (m) => hasLevel(m, 'full'),
  };
}
