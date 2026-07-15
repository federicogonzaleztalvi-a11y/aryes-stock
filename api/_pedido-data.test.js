/**
 * Tests del armado del payload de la orden de compra (PDF/mail).
 *
 * Importan las funciones REALES de ./_pedido-data.js — las mismas que usan
 * api/pedido.js (comprobante + vista previa) y api/_create-order.js (email).
 * Antes esta lógica estaba copiada en 3 lugares; un bug en el fallback de
 * precio base se colaba en el PDF que recibe el cliente. Estos tests cubren
 * ese armado en un solo lugar.
 */
import { describe, it, expect } from 'vitest';
import { buildLineas, sumLineas, mapClienteFiscal } from './_pedido-data.js';

const BASE = {
  'uuid-1': { precio: 100, codigo: 'COD-1' },
  'uuid-2': { precio: 50, codigo: 'COD-2' },
};

describe('buildLineas', () => {
  it('mapea item con precio base de la lista y descuento aplicado', () => {
    const items = [{ id: 'uuid-1', nombre: 'Choco', unidad: 'kg', cantidad: 2, precioUnit: 90, subtotal: 180 }];
    const [l] = buildLineas(items, BASE);
    expect(l).toEqual({ codigo: 'COD-1', nombre: 'Choco', unidad: 'kg', qty: 2, precioBase: 100, precioUnit: 90, subtotal: 180 });
  });

  it('precioBase cae al precioUnit si el producto no está en baseMap', () => {
    const items = [{ id: 'desconocido', nombre: 'X', cantidad: 1, precioUnit: 70 }];
    const [l] = buildLineas(items, BASE);
    expect(l.precioBase).toBe(70);
    expect(l.codigo).toBe('');
  });

  it('calcula subtotal si el item no lo trae (unit × qty)', () => {
    const items = [{ id: 'uuid-2', nombre: 'Y', qty: 3, precioUnit: 50 }];
    const [l] = buildLineas(items, BASE);
    expect(l.subtotal).toBe(150);
  });

  it('resuelve el id sea id, productId o productoId', () => {
    const items = [
      { productId: 'uuid-1', precioUnit: 90 },
      { productoId: 'uuid-2', precioUnit: 40 },
    ];
    const lineas = buildLineas(items, BASE);
    expect(lineas[0].codigo).toBe('COD-1');
    expect(lineas[1].codigo).toBe('COD-2');
  });

  it('lista vacía / undefined → []', () => {
    expect(buildLineas([], BASE)).toEqual([]);
    expect(buildLineas(undefined, BASE)).toEqual([]);
  });

  it('funciona sin baseMap (default {})', () => {
    const [l] = buildLineas([{ id: 'uuid-1', precioUnit: 80 }]);
    expect(l.precioBase).toBe(80);
    expect(l.codigo).toBe('');
  });

  it('desglosa en filas por tramo cuando hay caja cerrada (>1 tramo)', () => {
    const items = [{
      id: 'uuid-1', nombre: 'Choco', unidad: 'kg', cantidad: 15, precioUnit: 82, subtotal: 1230,
      tramos: [
        { unidades: 10, precioUnit: 70, distribuidor: true },  // caja cerrada
        { unidades: 5,  precioUnit: 100, distribuidor: false }, // sueltas
      ],
    }];
    const lineas = buildLineas(items, BASE);
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toEqual({ codigo: 'COD-1', nombre: 'Choco (caja cerrada)', unidad: 'kg', qty: 10, precioBase: 100, precioUnit: 70, subtotal: 700 });
    expect(lineas[1]).toEqual({ codigo: 'COD-1', nombre: 'Choco', unidad: 'kg', qty: 5, precioBase: 100, precioUnit: 100, subtotal: 500 });
    // El desglose no cambia el subtotal total ni el descuento respecto del blended.
    expect(sumLineas(lineas)).toEqual({ subtotal: 1200, descuentoTotal: 300 });
  });

  it('un solo tramo → una fila (no desglosa)', () => {
    const items = [{ id: 'uuid-1', nombre: 'Choco', cantidad: 3, precioUnit: 90, subtotal: 270,
      tramos: [{ unidades: 3, precioUnit: 90, distribuidor: false }] }];
    const lineas = buildLineas(items, BASE);
    expect(lineas).toHaveLength(1);
    expect(lineas[0].nombre).toBe('Choco');
  });
});

describe('sumLineas', () => {
  it('subtotal = suma de subtotales; descuento = (base-unit)×qty por línea', () => {
    const lineas = [
      { qty: 2, precioBase: 100, precioUnit: 90, subtotal: 180 }, // dto 10×2 = 20
      { qty: 3, precioBase: 50, precioUnit: 50, subtotal: 150 },  // dto 0
    ];
    expect(sumLineas(lineas)).toEqual({ subtotal: 330, descuentoTotal: 20 });
  });

  it('nunca cuenta descuento negativo (precioUnit > base)', () => {
    const lineas = [{ qty: 1, precioBase: 50, precioUnit: 60, subtotal: 60 }];
    expect(sumLineas(lineas).descuentoTotal).toBe(0);
  });

  it('carrito vacío → 0 / 0', () => {
    expect(sumLineas([])).toEqual({ subtotal: 0, descuentoTotal: 0 });
  });
});

describe('mapClienteFiscal', () => {
  it('mapea las columnas de DB a las claves del PDF', () => {
    const cli = {
      name: 'Bar Central', codigo: 'C-9', rut: '21000', address: 'Av 1', ciudad: 'Mvd',
      horario_desde: '09:00', horario_hasta: '13:00', zona_entrega: 'Centro', cond_pago: 'credito_30',
    };
    expect(mapClienteFiscal(cli)).toEqual({
      nombre: 'Bar Central', codigo: 'C-9', rut: '21000', direccion: 'Av 1', ciudad: 'Mvd',
      horarioDesde: '09:00', horarioHasta: '13:00', zonaEntrega: 'Centro', condPago: 'credito_30',
    });
  });

  it('usa fallbackNombre sólo si el cliente no trae name (caso email)', () => {
    expect(mapClienteFiscal({}, 'Cliente del pedido').nombre).toBe('Cliente del pedido');
    expect(mapClienteFiscal({ name: 'Real' }, 'Fallback').nombre).toBe('Real');
  });

  it('sin fallback y sin name → nombre undefined (caso comprobante)', () => {
    expect(mapClienteFiscal({}).nombre).toBeUndefined();
  });
});
