// Tests del motor PURO de fecha de entrega. Blindan las 3 reglas de negocio:
// modo (off/zona/cliente), match de zona tolerante a texto libre, y hora de corte.
import { describe, it, expect } from 'vitest';
import { calcularEntrega, normZona, formatFechaLarga, formatFechaLargaCap,
  formatFechaCorta, minutosHastaCorte, formatCuentaRegresiva } from './delivery.js';

// Fechas fijas para tests deterministas. En JS los meses son 0-based.
// 2026-08-17 es LUNES. Lo usamos de ancla.
const LUN = new Date(2026, 7, 17, 9, 0);   // lunes 09:00
const LUN_TARDE = new Date(2026, 7, 17, 18, 0); // lunes 18:00 (pasó un corte 14:00)

describe('normZona', () => {
  it('normaliza mayúsculas, espacios y acentos', () => {
    expect(normZona('  Centro ')).toBe('centro');
    expect(normZona('ZÓNA Está')).toBe('zona esta');
    expect(normZona(null)).toBe('');
  });
});

describe('formatFechaLarga', () => {
  it('formatea en español sin año', () => {
    expect(formatFechaLarga(new Date(2026, 7, 20))).toBe('jueves 20 de agosto');
  });
  it('tolera valores inválidos', () => {
    expect(formatFechaLarga(null)).toBe('');
  });
  it('Cap sólo capitaliza la primera letra (no "De"/"Agosto")', () => {
    expect(formatFechaLargaCap(new Date(2026, 7, 20))).toBe('Jueves 20 de agosto');
    expect(formatFechaLargaCap(null)).toBe('');
  });
});

describe('modo off', () => {
  it('no devuelve fecha (comportamiento actual)', () => {
    const r = calcularEntrega({ modo: 'off' }, 'Centro', LUN);
    expect(r.fecha).toBeNull();
    expect(r.label).toBe('');
  });
  it('sin config también es off', () => {
    expect(calcularEntrega(undefined, '', LUN).modo).toBe('off');
  });
});

describe('modo zona', () => {
  const reparto = {
    modo: 'zona',
    zonas: { Centro: ['lun', 'mie', 'vie'], Este: ['mar', 'jue'] },
    diasDefault: ['lun', 'mar', 'mie', 'jue', 'vie'],
  };

  it('un lunes, zona Centro (reparte lun) → entrega HOY lunes', () => {
    const r = calcularEntrega(reparto, 'Centro', LUN);
    expect(r.fecha.getDay()).toBe(1); // lunes
    expect(r.label).toBe('Lunes 17 de agosto');
    expect(r.sub).toContain('Centro');
  });

  it('un lunes, zona Este (reparte mar/jue) → próximo martes', () => {
    const r = calcularEntrega(reparto, 'Este', LUN);
    expect(r.fecha.getDay()).toBe(2); // martes
    expect(r.label).toBe('Martes 18 de agosto');
  });

  it('matchea zona por texto libre con acentos/mayúsculas', () => {
    const r = calcularEntrega(reparto, '  este ', LUN);
    expect(r.fecha.getDay()).toBe(2);
  });

  it('zona desconocida cae al default (lun-vie) → hoy lunes', () => {
    const r = calcularEntrega(reparto, 'Inexistente', LUN);
    expect(r.fecha.getDay()).toBe(1);
    expect(r.sub).toContain('Inexistente');
  });
});

describe('hora de corte', () => {
  const reparto = {
    modo: 'zona',
    corte: '14:00',
    zonas: { Centro: ['lun', 'mie', 'vie'] },
  };

  it('antes del corte → entrega hoy (lunes 09:00)', () => {
    const r = calcularEntrega(reparto, 'Centro', LUN);
    expect(r.label).toBe('Lunes 17 de agosto');
  });

  it('pasado el corte → salta al siguiente día de reparto (miércoles)', () => {
    const r = calcularEntrega(reparto, 'Centro', LUN_TARDE);
    expect(r.fecha.getDay()).toBe(3); // miércoles
    expect(r.label).toBe('Miércoles 19 de agosto');
  });
});

describe('modo cliente', () => {
  const reparto = {
    modo: 'cliente',
    diasDefault: ['lun', 'mar', 'mie', 'jue', 'vie'],
    anticipacionDias: 1,
  };

  it('ofrece opciones a partir de mañana (anticipación 1)', () => {
    const r = calcularEntrega(reparto, '', LUN);
    expect(r.opciones.length).toBeGreaterThan(0);
    // Primera opción NO es hoy lunes; con anticipación 1 arranca martes.
    expect(r.opciones[0].getDay()).toBe(2);
    expect(r.fecha).toBe(r.opciones[0]);
  });

  it('todas las opciones son días hábiles (no fin de semana)', () => {
    const r = calcularEntrega(reparto, '', LUN);
    r.opciones.forEach(d => {
      expect([1, 2, 3, 4, 5]).toContain(d.getDay());
    });
  });

  it('anticipación 0 permite hoy si es hábil', () => {
    const r = calcularEntrega({ ...reparto, anticipacionDias: 0 }, '', LUN);
    expect(r.opciones[0].getDay()).toBe(1); // hoy lunes
  });
});

describe('formatFechaCorta', () => {
  const JUE = new Date(2026, 7, 20, 10, 0); // jueves 20 de agosto
  it('formatea compacto "jue 20"', () => {
    expect(formatFechaCorta(JUE)).toBe('jue 20');
  });
  it('con now resuelve relativo hoy/mañana', () => {
    expect(formatFechaCorta(LUN, LUN)).toBe('hoy');
    const MAR = new Date(2026, 7, 18, 9, 0);
    expect(formatFechaCorta(MAR, LUN)).toBe('mañana');
  });
  it('con now pero fecha lejana usa el formato corto', () => {
    expect(formatFechaCorta(JUE, LUN)).toBe('jue 20');
  });
  it('fecha inválida → cadena vacía', () => {
    expect(formatFechaCorta(null)).toBe('');
    expect(formatFechaCorta(new Date('nope'))).toBe('');
  });
});

describe('minutosHastaCorte', () => {
  it('devuelve los minutos que faltan (corte 14:00, ahora 09:00 → 300)', () => {
    expect(minutosHastaCorte('14:00', LUN)).toBe(300);
  });
  it('negativo cuando el corte ya venció (18:00 vs corte 14:00)', () => {
    expect(minutosHastaCorte('14:00', LUN_TARDE)).toBe(-240);
  });
  it('null si no hay corte o el formato es inválido', () => {
    expect(minutosHastaCorte('', LUN)).toBe(null);
    expect(minutosHastaCorte('tarde', LUN)).toBe(null);
    expect(minutosHastaCorte(null, LUN)).toBe(null);
  });
});

describe('formatCuentaRegresiva', () => {
  it('con horas y minutos', () => {
    expect(formatCuentaRegresiva(200)).toBe('3h 20m');
  });
  it('sólo minutos cuando es menos de una hora', () => {
    expect(formatCuentaRegresiva(45)).toBe('45m');
  });
  it('clampea negativos a 0m', () => {
    expect(formatCuentaRegresiva(-10)).toBe('0m');
  });
});
