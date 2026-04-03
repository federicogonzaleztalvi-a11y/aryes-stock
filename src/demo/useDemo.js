// src/demo/useDemo.js
// Hook que maneja el estado del demo mode
// Cuando está activo, inyecta datos del dataset elegido en lugar de leer Supabase

import { useState, useCallback, useMemo } from 'react';
import { demoHoreca } from './demo-horeca.js';
import { demoBebidas } from './demo-bebidas.js';
import { demoLimpieza } from './demo-limpieza.js';
import { demoConstruccion } from './demo-construccion.js';

const DATASETS = {
  horeca: demoHoreca,
  bebidas: demoBebidas,
  limpieza: demoLimpieza,
  construccion: demoConstruccion,
};

// Convierte las fechas relativas (date: -1 = ayer) a fechas reales
function materializeDates(ventas) {
  const now = new Date();
  return ventas.map(v => {
    const d = new Date(now);
    d.setDate(d.getDate() + v.date);
    const total = v.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    return {
      ...v,
      created_at: d.toISOString(),
      fecha: d.toISOString().split('T')[0],
      total,
    };
  });
}

export function useDemo() {
  const [demoMode, setDemoMode] = useState(false);
  const [demoIndustry, setDemoIndustry] = useState(null);
  const [demoData, setDemoData] = useState(null);

  const activateDemo = useCallback((industryId) => {
    const dataset = DATASETS[industryId];
    if (!dataset) {
      console.error('[demo] Dataset no encontrado:', industryId);
      return;
    }

    // Materializar fechas en ventas
    const ventas = materializeDates(dataset.ventas);

    setDemoData({
      ...dataset,
      ventas,
    });
    setDemoIndustry(industryId);
    setDemoMode(true);

    // Clear real session so db.get() won't use it in demo mode
    try { localStorage.removeItem('aryes-session'); } catch(e) {}
    console.debug('[demo] Activado:', industryId, dataset.org.name);
  }, []);

  const exitDemo = useCallback(() => {
    setDemoMode(false);
    setDemoIndustry(null);
    setDemoData(null);
    console.debug('[demo] Desactivado');
  }, []);

  // Helper: muestra toast cuando el usuario intenta una acción bloqueada
  const demoGuard = useCallback((action) => {
    if (!demoMode) return false; // no en demo, dejar pasar
    // En demo mode, bloquear la acción y mostrar feedback
    if (typeof window !== 'undefined') {
      // Dispatch custom event que el toast system puede capturar
      window.dispatchEvent(new CustomEvent('demo-blocked', {
        detail: { action },
      }));
    }
    return true; // bloqueado
  }, [demoMode]);

  // Datos que el AppContext puede usar directamente
  const demoState = useMemo(() => {
    if (!demoMode || !demoData) return null;
    return {
      org: demoData.org,
      products: demoData.products,
      clients: demoData.clients,
      suppliers: demoData.suppliers,
      ventas: demoData.ventas,
      rutas: demoData.rutas,
      deposit_zones: demoData.deposit_zones,
      industry: demoIndustry,
    };
  }, [demoMode, demoData, demoIndustry]);

  return {
    demoMode,
    demoIndustry,
    demoState,
    activateDemo,
    exitDemo,
    demoGuard,
  };
}