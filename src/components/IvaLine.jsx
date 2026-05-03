// src/components/IvaLine.jsx — IVA breakdown display for product cards
// Patrón B: precio del catálogo es NETO (sin IVA). El IVA se suma encima.
import React from 'react';

export default function IvaLine({ precio, iva_rate }) {
  if (precio <= 0) return null;

  // null/undefined = IVA no configurado en el producto → no mostrar nada
  if (iva_rate == null) return null;

  const iva = Number(iva_rate);

  // 0 = exento real (configurado explícitamente)
  if (iva === 0) {
    return <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>Exento de IVA</div>;
  }

  // > 0 = sumar IVA encima del neto
  return <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>+ IVA {iva}%</div>;
}
