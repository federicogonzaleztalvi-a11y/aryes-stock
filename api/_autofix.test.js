/**
 * Tests de la Torre de Control · peldaño 2 (auto-fix).
 *
 * Cubren el filtro que evita que una ALERTA DE PRUEBA del canal (api/alert-test.js)
 * termine abriendo un Issue + PR de auto-fix. Ese ping dispara log.error a
 * propósito para verificar que email/WhatsApp salen; es correcto que alerte, pero
 * NO hay nada que arreglar en el código, así que no debe generar un ticket.
 * (Regresión: el Issue #12 fue exactamente eso — la prueba creó un auto-fix.)
 */
import { describe, it, expect } from 'vitest';
import { esAlertaDePrueba } from './_autofix.js';

describe('esAlertaDePrueba', () => {
  it('reconoce la alerta de prueba de la Torre de Control (alert-test)', () => {
    expect(esAlertaDePrueba({ service: 'alert-test', msg: 'Alerta de prueba' })).toBe(true);
  });

  it('un error real de cualquier otro módulo NO es alerta de prueba', () => {
    expect(esAlertaDePrueba({ service: 'pedido', msg: 'DB error' })).toBe(false);
    expect(esAlertaDePrueba({ service: 'historial', msg: 'timeout' })).toBe(false);
  });

  it('entrada sin service / vacía no rompe y no cuenta como prueba', () => {
    expect(esAlertaDePrueba({})).toBe(false);
    expect(esAlertaDePrueba(undefined)).toBe(false);
    expect(esAlertaDePrueba(null)).toBe(false);
  });
});
