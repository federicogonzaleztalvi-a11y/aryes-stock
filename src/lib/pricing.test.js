/**
 * Tests de la lógica de PRECIOS del carrito B2B.
 *
 * A diferencia de los tests viejos (que copiaban la lógica adentro del test),
 * estos importan las funciones REALES de ../lib/pricing.js — las mismas que
 * usa el carrito del portal. Si la matemática de plata cambia, estos tests
 * lo detectan.
 *
 * Camino más crítico del producto: un error acá = cobrar de más o de menos
 * a un cliente real.
 */
import { describe, it, expect } from 'vitest';
import { volTierDto, calcLinea, calcTotales } from './pricing.js';

describe('volTierDto — descuento por volumen', () => {
  it('sin escalas → 0%', () => {
    expect(volTierDto({}, 100)).toBe(0);
    expect(volTierDto({ volume_tiers: [] }, 100)).toBe(0);
  });

  it('elige la mejor escala alcanzada por la cantidad', () => {
    const item = { volume_tiers: [{ min: 10, dto: 15 }, { min: 50, dto: 25 }] };
    expect(volTierDto(item, 5)).toBe(0);    // no llega a ninguna
    expect(volTierDto(item, 10)).toBe(15);  // justo en el mínimo
    expect(volTierDto(item, 49)).toBe(15);  // entre escalas → la de abajo
    expect(volTierDto(item, 50)).toBe(25);  // alcanza la de arriba
    expect(volTierDto(item, 999)).toBe(25); // por encima de todo → la mayor
  });
});

describe('calcLinea — línea sin descuentos', () => {
  it('neto = precio * cantidad, IVA aparte', () => {
    const r = calcLinea({ precio: 100, iva_rate: 22 }, 3);
    expect(r.precioConDto).toBe(100);
    expect(r.netoLinea).toBe(300);
    expect(r.ivaLinea).toBeCloseTo(66, 5);
    expect(r.cajaUnid).toBe(0);
  });

  it('iva_rate ausente → 0% IVA', () => {
    const r = calcLinea({ precio: 50 }, 2);
    expect(r.ivaRate).toBe(0);
    expect(r.netoLinea).toBe(100);
    expect(r.ivaLinea).toBe(0);
  });
});

describe('calcLinea — descuento puntual y por volumen (se usa el mayor)', () => {
  it('aplica descuento puntual (descGlobal)', () => {
    const r = calcLinea({ precio: 100, iva_rate: 22, descGlobal: 10 }, 2);
    expect(r.descPct).toBe(10);
    expect(r.precioConDto).toBe(90);
    expect(r.netoLinea).toBe(180);
    expect(r.ivaLinea).toBeCloseTo(39.6, 5);
  });

  it('el descuento por volumen le gana al puntual cuando es mayor', () => {
    const item = { precio: 100, iva_rate: 0, descGlobal: 5, volume_tiers: [{ min: 10, dto: 15 }] };
    const r = calcLinea(item, 12);
    expect(r.volDto).toBe(15);
    expect(r.descPct).toBe(15);     // max(5, 15)
    expect(r.netoLinea).toBe(1020); // 85 * 12
  });

  it('el puntual le gana al volumen cuando es mayor', () => {
    const item = { precio: 100, iva_rate: 22, descGlobal: 20, volume_tiers: [{ min: 10, dto: 15 }] };
    const r = calcLinea(item, 10);
    expect(r.descPct).toBe(20);     // max(20, 15)
    expect(r.precioConDto).toBe(80);
    expect(r.netoLinea).toBe(800);
  });

  it('redondea el precio con descuento a 2 decimales', () => {
    const r = calcLinea({ precio: 33.33, iva_rate: 22, descGlobal: 10 }, 3);
    expect(r.precioConDto).toBe(30);    // round2(33.33 * 0.9) = round2(29.997) = 30
    expect(r.netoLinea).toBe(90);
  });
});

describe('calcLinea — caja cerrada (distribuidores)', () => {
  it('cantidad múltiplo exacto de caja → todo a precio de caja', () => {
    const item = { precio: 100, iva_rate: 22, unidades_por_caja: 6, descuento_caja: 10 };
    const r = calcLinea(item, 12); // 2 cajas justas
    expect(r.cajaUnid).toBe(6);
    expect(r.netoLinea).toBe(1080);     // 12 * 90
    expect(r.precioConDto).toBe(90);
    expect(r.ivaLinea).toBeCloseTo(237.6, 5);
    expect(r.faltanParaCaja).toBe(0);   // sin resto → sin nudge
    expect(r.ahorroSiCompleta).toBe(0);
  });

  it('con resto: las unidades de caja a precio caja, el resto a precio normal', () => {
    const item = { precio: 100, iva_rate: 0, unidades_por_caja: 6, descuento_caja: 10 };
    const r = calcLinea(item, 8); // 1 caja (6) + 2 sueltas
    expect(r.netoLinea).toBe(740);       // 6*90 + 2*100
    expect(r.precioConDto).toBe(92.5);   // round2(740/8) — promedio ponderado
    expect(r.faltanParaCaja).toBe(4);    // 6 - 2
    expect(r.ahorroSiCompleta).toBe(60); // (100-90) * 6
  });

  it('cantidad menor a una caja → todo a precio normal, con nudge para completar', () => {
    const item = { precio: 100, iva_rate: 0, unidades_por_caja: 6, descuento_caja: 10 };
    const r = calcLinea(item, 4);
    expect(r.netoLinea).toBe(400);       // 4 * 100 (nada completa caja)
    expect(r.precioConDto).toBe(100);
    expect(r.faltanParaCaja).toBe(2);    // 6 - 4
    expect(r.ahorroSiCompleta).toBe(60);
  });

  it('si el descuento puntual es mayor que el de caja, no hay nudge (precio igual)', () => {
    const item = { precio: 100, iva_rate: 0, descGlobal: 20, unidades_por_caja: 6, descuento_caja: 10 };
    const r = calcLinea(item, 8);
    expect(r.descPct).toBe(20);
    expect(r.netoLinea).toBe(640);       // todo a 80 (puntual gana)
    expect(r.precioConDto).toBe(80);
    expect(r.faltanParaCaja).toBe(0);    // precioCaja == precioReg → sin nudge
    expect(r.ahorroSiCompleta).toBe(0);
  });

  it('caja NO aplica si descuento_caja es 0 (lista no lo habilita)', () => {
    const item = { precio: 100, iva_rate: 0, unidades_por_caja: 6, descuento_caja: 0 };
    const r = calcLinea(item, 12);
    expect(r.cajaUnid).toBe(0);
    expect(r.netoLinea).toBe(1200);      // sin descuento de caja
  });
});

describe('calcTotales — totales del carrito', () => {
  it('suma neto, IVA y total de varias líneas', () => {
    const lineas = [
      calcLinea({ precio: 100, iva_rate: 22 }, 2),                       // neto 200, iva 44
      calcLinea({ precio: 50, iva_rate: 10, descGlobal: 10 }, 4),        // 45*4=180, iva 18
    ];
    const t = calcTotales(lineas);
    expect(t.subtotalNeto).toBeCloseTo(380, 5);
    expect(t.ivaTotal).toBeCloseTo(62, 5);
    expect(t.total).toBeCloseTo(442, 5);
  });

  it('carrito vacío → todo en 0', () => {
    const t = calcTotales([]);
    expect(t.subtotalNeto).toBe(0);
    expect(t.ivaTotal).toBe(0);
    expect(t.total).toBe(0);
  });
});

// Modelo v2: el servidor manda precioBase SIN descontar + los descuentos por
// separado (descGlobal='siempre', descuento_caja='caja', volume_tiers='cantidad')
// y reglasV2:true. calcLinea resuelve con el MAYOR que aplica por unidad, sin apilar.
describe('calcLinea — modelo v2 (reglas, base sin descontar)', () => {
  it('solo regla caja (distribuidor Eric): caja completa con dto, sueltas a precio pleno', () => {
    const item = { precioBase: 100, iva_rate: 0, descGlobal: 0,
                   unidades_por_caja: 6, descuento_caja: 20, reglasV2: true };
    const r = calcLinea(item, 8); // 1 caja (6) + 2 sueltas
    expect(r.netoLinea).toBe(680);       // 6*80 + 2*100 (sueltas SIN descuento)
    expect(r.faltanParaCaja).toBe(4);
  });

  it('regla siempre + regla caja: sueltas con "siempre", caja con el mayor', () => {
    const item = { precioBase: 100, iva_rate: 0, descGlobal: 10,
                   unidades_por_caja: 6, descuento_caja: 20, reglasV2: true };
    const r = calcLinea(item, 8);
    expect(r.netoLinea).toBe(660);       // 6*80 (caja 20%) + 2*90 (siempre 10%)
  });

  it('NO apila: siempre 30% + cantidad 15% → gana el mayor (30%), no 40,5%', () => {
    const item = { precioBase: 100, iva_rate: 0, descGlobal: 30,
                   volume_tiers: [{ min: 10, dto: 15 }], reglasV2: true };
    const r = calcLinea(item, 12);
    expect(r.descPct).toBe(30);          // max(30, 15)
    expect(r.netoLinea).toBe(840);       // 12 * 70 (no 12 * 59,5)
  });

  it('precio especial fijo: es el precio final, sin descuentos', () => {
    const item = { precioBase: 550, precio: 550, iva_rate: 0, descGlobal: 0, reglasV2: true };
    const r = calcLinea(item, 3);
    expect(r.precioConDto).toBe(550);
    expect(r.netoLinea).toBe(1650);
  });
});
