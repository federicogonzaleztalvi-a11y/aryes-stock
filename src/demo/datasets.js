// src/demo/datasets.js — Datasets para el ambiente demo
// Cada industria tiene: org, suppliers, products, clients, ventas, rutas, deposit_zones

export { demoHoreca } from './demo-horeca.js';
export { demoBebidas } from './demo-bebidas.js';
export { demoLimpieza } from './demo-limpieza.js';
export { demoConstruccion } from './demo-construccion.js';

export const DEMO_INDUSTRIES = [
  { id: 'horeca', name: 'HORECA', sub: 'Restaurantes, bares, hoteles', dataset: 'demoHoreca' },
  { id: 'bebidas', name: 'Bebidas', sub: 'Mayoristas de bebidas', dataset: 'demoBebidas' },
  { id: 'limpieza', name: 'Limpieza', sub: 'Productos de limpieza e higiene', dataset: 'demoLimpieza' },
  { id: 'construccion', name: 'Construcción', sub: 'Materiales y ferretería', dataset: 'demoConstruccion' },
];