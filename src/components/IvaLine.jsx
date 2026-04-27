// src/components/IvaLine.jsx — IVA breakdown display for product cards
import React from 'react';

export default function IvaLine({ precio, iva_rate }) {
  const iva = Number(iva_rate || 0);
  if (precio <= 0) return null;
  const sinIva = Math.round(precio / (1 + iva / 100));
  const label = iva > 0
    ? ('$' + sinIva.toLocaleString() + ' + IVA ' + iva + '%')
    : 'Exento de IVA';
  return <div style={{ fontSize: 10, color: '#b0b0a8', marginTop: 1 }}>{label}</div>;
}
