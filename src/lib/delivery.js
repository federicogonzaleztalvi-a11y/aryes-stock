// src/lib/delivery.js — Lógica PURA de fecha de entrega (portal B2B, checkout).
// Sin React, sin Supabase, sin DOM: sólo fechas + config. La MISMA función se usa
// en el checkout (aviso al cliente), en la confirmación y en el comprobante/PDF,
// así el cliente ve exactamente la misma fecha en los tres lados.
//
// Multi-tenant: el modo lo define CADA distribuidora, no está atado a un cliente.
//   - 'off'     → no hay entrega programada (comportamiento actual, cero cambios).
//   - 'zona'    → el día lo manda la RUTA/ZONA del cliente (caso Eric: reparto por
//                 zona en días fijos; el cliente NO elige, sólo ve la estimada).
//   - 'cliente' → la distribuidora entrega cuando el cliente quiere; el cliente
//                 ELIGE una fecha entre las hábiles con una anticipación mínima.
//
// Hora de corte (opcional, GENÉRICA para ambos modos): si el pedido entra pasada
// esa hora, el cálculo salta al siguiente día válido (el reparto de hoy ya cerró).

// Días de la semana como los devuelve Date.getDay(): 0=domingo … 6=sábado.
export const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

// Etiqueta larga para mostrar (es-UY). No usamos toLocaleDateString acá para que
// el texto sea idéntico en server (PDF/mail) y cliente sin depender del locale del
// runtime — en Node y en el browser el mismo día debe leerse igual.
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Normaliza un nombre de zona para matchear tolerante a mayúsculas/acentos/espacios.
// Los clientes ya tienen `zona_entrega` como TEXTO LIBRE; el distribuidor define la
// lista canónica. Matcheamos por nombre normalizado para no exigir migración.
export function normZona(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // saca acentos
}

// ¿La hora de corte ya pasó? corte = "HH:MM" (24h) o vacío. Si no hay corte → false.
// `now` es un Date; comparamos contra la hora local de ese Date.
function corteVencido(corte, now) {
  if (!corte || typeof corte !== 'string') return false;
  const m = corte.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const cutoffMin = Number(m[1]) * 60 + Number(m[2]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= cutoffMin;
}

// Suma días a un Date SIN mutarlo (devuelve uno nuevo, a medianoche local).
function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

// Formatea "jueves 21 de agosto" (sin año; es un pedido, no un contrato).
export function formatFechaLarga(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return `${DIAS_LARGO[date.getDay()]} ${date.getDate()} de ${MESES_LARGO[date.getMonth()]}`;
}

// Igual que formatFechaLarga pero con SÓLO la primera letra en mayúscula
// ("Jueves 21 de agosto"). Se usa donde el texto va suelto como título; evita el
// text-transform:capitalize de CSS, que capitaliza "De" y "Agosto" y se ve mal.
export function formatFechaLargaCap(date) {
  const s = formatFechaLarga(date);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// Etiqueta compacta para cards / espacios chicos ("jue 21"). Si se pasa `now`,
// resuelve relativo cuando es útil: hoy → "hoy", mañana → "mañana" (patrón Amazon,
// "Tomorrow"). Sin año ni mes: es un pedido, no un contrato.
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function formatFechaCorta(date, now = null) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  if (now instanceof Date && !isNaN(now)) {
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((d1 - d0) / 86400000);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
  }
  return `${DIAS_CORTO[date.getDay()]} ${date.getDate()}`;
}

// Minutos hasta la hora de corte HOY. corte = "HH:MM" (24h). Devuelve:
//   null  → no hay corte configurado (o formato inválido).
//   > 0   → minutos que faltan para el corte (ventana de hoy sigue abierta).
//   <= 0  → el corte de hoy ya venció.
// Espeja a corteVencido() (misma comparación) pero expone la magnitud para el countdown.
export function minutosHastaCorte(corte, now = new Date()) {
  if (!corte || typeof corte !== 'string') return null;
  const m = corte.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const cutoffMin = Number(m[1]) * 60 + Number(m[2]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return cutoffMin - nowMin;
}

// Formatea una cuenta regresiva en minutos a "3h 20m" / "45m". Negativos → "0m".
export function formatCuentaRegresiva(min) {
  const total = Math.max(0, Math.floor(Number(min) || 0));
  const h = Math.floor(total / 60), mm = total % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

// Set de días válidos (índices 0-6) a partir de una lista de labels ['lun','mie'].
// Vacío o inválido → los 5 días hábiles (lun-vie) como fallback razonable.
function diasValidosSet(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return new Set([1, 2, 3, 4, 5]);
  const set = new Set();
  dias.forEach(d => {
    const i = DIAS_SEMANA.indexOf(normZona(d).slice(0, 3));
    if (i >= 0) set.add(i);
  });
  return set.size ? set : new Set([1, 2, 3, 4, 5]);
}

// Resuelve los días de reparto de la ZONA de un cliente dentro de la config del org.
// reparto.zonas = { "Centro": ['lun','mie','vie'], ... }. Si la zona del cliente no
// matchea ninguna (o no tiene), cae a reparto.diasDefault (o lun-vie).
function diasDeZona(reparto, zonaCliente) {
  const zonas = reparto?.zonas || {};
  const target = normZona(zonaCliente);
  if (target) {
    for (const nombre of Object.keys(zonas)) {
      if (normZona(nombre) === target) return diasValidosSet(zonas[nombre]);
    }
  }
  return diasValidosSet(reparto?.diasDefault);
}

// Primer día (>= offset desde `now`) cuyo getDay() esté en el set válido.
// Busca hasta 14 días hacia adelante; si nada matchea (config imposible) → null.
function proximoDiaValido(validSet, now, offset) {
  for (let i = offset; i <= offset + 14; i++) {
    const cand = addDays(now, i);
    if (validSet.has(cand.getDay())) return cand;
  }
  return null;
}

// ── API principal ─────────────────────────────────────────────────────────────
// Calcula la info de entrega para el checkout. Devuelve SIEMPRE un objeto:
//   { modo, fecha: Date|null, label, sub, opciones: Date[] }
// - modo 'off'     → fecha null, label '' (el checkout no muestra nada).
// - modo 'zona'    → fecha estimada (read-only), sub explica la zona/días.
// - modo 'cliente' → fecha = primera opción; opciones[] para el selector.
//
// reparto: brandCfg.reparto (config por-org). zonaCliente: string del cliente.
// now: Date (default new Date()) — inyectable para tests deterministas.
export function calcularEntrega(reparto, zonaCliente, now = new Date()) {
  const modo = reparto?.modo || 'off';
  if (modo === 'off') return { modo, fecha: null, label: '', sub: '', opciones: [] };

  const corte = reparto?.corte || '';
  // Si el corte de hoy ya venció, el día de reparto de hoy ya cerró → arrancamos
  // a buscar desde mañana (offset 1). Si no, hoy todavía cuenta (offset 0).
  const offset = corteVencido(corte, now) ? 1 : 0;

  if (modo === 'zona') {
    const validSet = diasDeZona(reparto, zonaCliente);
    const fecha = proximoDiaValido(validSet, now, offset);
    if (!fecha) return { modo, fecha: null, label: '', sub: '', opciones: [] };
    const zonaTxt = zonaCliente ? `tu zona: ${zonaCliente}` : 'según nuestra ruta';
    return {
      modo,
      fecha,
      label: formatFechaLargaCap(fecha),
      sub: zonaTxt,
      opciones: [],
    };
  }

  // modo 'cliente': el cliente elige. Anticipación mínima en días (default 1 =
  // "mañana o después"). Ofrecemos las próximas N fechas hábiles como opciones.
  const antic = Math.max(0, Number(reparto?.anticipacionDias ?? 1));
  const validSet = diasValidosSet(reparto?.diasDefault); // días que la distri opera
  const startOffset = Math.max(offset, antic);
  const opciones = [];
  let cursor = startOffset;
  while (opciones.length < 6 && cursor <= startOffset + 21) {
    const cand = addDays(now, cursor);
    if (validSet.has(cand.getDay())) opciones.push(cand);
    cursor++;
  }
  const fecha = opciones[0] || null;
  return {
    modo,
    fecha,
    label: fecha ? formatFechaLargaCap(fecha) : '',
    sub: 'elegí el día que preferís recibir',
    opciones,
  };
}
