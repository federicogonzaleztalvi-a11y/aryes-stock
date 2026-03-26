/**
 * useRole — thin wrapper over session from AppContext.
 * Gives every tab a clean, declarative API for role-based UI guards
 * without prop drilling session through the component tree.
 */
import { useApp } from '../context/AppContext.tsx';

export interface RoleFlags {
  role:        string;
  isAdmin:     boolean;
  isOperador:  boolean;
  isVendedor:  boolean;
  canWrite:    boolean;  // admin + operador
  canDelete:   boolean;  // admin only
  canSell:     boolean;  // admin + vendedor
}

export function useRole(): RoleFlags {
  const { session } = useApp();
  const role = session?.role ?? 'admin';
  return {
    role,
    isAdmin:    role === 'admin',
    isOperador: role === 'operador',
    isVendedor: role === 'vendedor',
    canWrite:   role === 'admin' || role === 'operador',
    canDelete:  role === 'admin',
    canSell:    role === 'admin' || role === 'vendedor',
  };
}
