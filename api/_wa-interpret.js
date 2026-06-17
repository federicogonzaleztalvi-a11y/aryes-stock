// api/_wa-interpret.js — intérprete de pedidos en texto libre (bot WhatsApp)
// ============================================================================
// Fase 2 del bot de pedidos. Función PURA y testeable: dado el texto libre del
// cliente ("mandame 10 cajas de coca y 2 de agua") y el catálogo YA resuelto con
// los precios de ESE cliente, devuelve líneas estructuradas listas para armar el
// carrito.
//
// Principio de confianza (CRÍTICO):
//   Claude SOLO matchea texto→producto. El precio, nombre y unidad salen SIEMPRE
//   del catálogo (la lista del cliente), nunca de lo que diga Claude. Así un
//   modelo que alucine un precio no puede meter un precio falso en el pedido.
//
// Para evitar que Claude alucine UUIDs y para ahorrar tokens, le pasamos una
// lista NUMERADA (ref 1..N) y devuelve refs; nosotros resolvemos ref→producto.
//
// Contrato:
//   interpretarPedido({ texto, catalogo, model? }) → Promise<{
//     ok,                         // false si no hay API key o falló el parseo
//     lineas:   [{ productId, nombre, unidad, qty, precio, subtotal }],
//     sinPrecio:[{ productId, nombre, qty }],  // matcheado pero precio 0 → consultar
//     sinMatch: [string],         // texto que no se pudo mapear a un producto
//     error?,                     // detalle si ok=false
//   }>
//
//   catalogo: [{ id, nombre, unidad, precio, categoria?, marca? }]  (de api/catalogo.js)
// ============================================================================

import { log } from './_log.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
// Modelo acordado para el bot (ver memoria project_whatsapp_bot).
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Sos un asistente que interpreta pedidos mayoristas escritos en lenguaje natural (español rioplatense) y los convierte a JSON estructurado.

Te doy un CATÁLOGO numerado. Cada línea es:
  <ref>. <nombre> — <unidad> — $<precio>

El cliente escribe un pedido libre (puede tener typos, abreviaturas, cantidades en palabras, varios productos por renglón, marcas, etc). Tenés que:
1. Identificar cada producto que pide y mapearlo a la "ref" del catálogo que mejor coincida.
2. Extraer la cantidad pedida de cada uno (número; puede ser decimal como 2.5).
3. Lo que no puedas mapear con razonable confianza a una ref del catálogo, ponelo como texto en "sinMatch" (NO inventes una ref).

Reglas:
- Mapeá por significado, no solo por texto exacto: "coca" → "Coca Cola", "agua chica" → el agua de menor tamaño, etc. Si hay ambigüedad real entre varios, elegí el más probable; si no podés decidir, va a sinMatch.
- NO inventes refs que no estén en el catálogo. NO inventes precios.
- Si el cliente repite un producto, sumá las cantidades en una sola línea.
- Ignorá saludos, "gracias", "por favor", y texto que no sea un ítem de pedido.

Respondé ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"items":[{"ref":<entero>,"qty":<número>}],"sinMatch":[<string>]}`;

/**
 * Interpreta un pedido en texto libre contra el catálogo del cliente.
 * Función pura respecto del estado de la app: no escribe en DB, no envía nada.
 */
export async function interpretarPedido({ texto, catalogo = [], model } = {}) {
  const out = { ok: false, lineas: [], sinPrecio: [], sinMatch: [], error: null };

  if (!ANTHROPIC_KEY) {
    out.error = 'anthropic_not_configured';
    log.warn('wa-interpret', 'ANTHROPIC_KEY no configurada');
    return out;
  }
  const texInput = String(texto || '').trim();
  if (!texInput) { out.ok = true; return out; }            // sin texto → pedido vacío
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    out.error = 'empty_catalog';
    return out;
  }

  // Lista numerada 1..N para el prompt. El índice (ref) = posición+1.
  const listado = catalogo
    .map((p, i) => `${i + 1}. ${p.nombre} — ${p.unidad || 'un'} — $${Number(p.precio) || 0}`)
    .join('\n');

  let data;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT + '\n\nCATÁLOGO:\n' + listado,
        messages: [{ role: 'user', content: texInput }],
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      out.error = 'anthropic_error';
      log.error('wa-interpret', 'Anthropic error', { status: r.status, body: err.slice(0, 300) });
      return out;
    }
    data = await r.json();
  } catch (e) {
    out.error = 'fetch_error';
    log.error('wa-interpret', 'fetch a Anthropic falló', { error: e.message });
    return out;
  }

  // Extraer el texto de la respuesta y parsear el JSON (defensivo: el modelo podría
  // envolverlo en prosa pese a la instrucción, así que tomamos el primer bloque {...}).
  const rawText = (data?.content || []).map(b => b?.text || '').join('').trim();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { /* sigue null */ } }
  }
  if (!parsed || !Array.isArray(parsed.items)) {
    out.error = 'parse_error';
    log.warn('wa-interpret', 'respuesta no parseable', { sample: rawText.slice(0, 200) });
    return out;
  }

  // Resolver refs → productos del catálogo. Precio/nombre/unidad SIEMPRE del catálogo.
  const acumulado = new Map();  // productId → { producto, qty }
  for (const it of parsed.items) {
    const ref = Math.floor(Number(it?.ref));
    const qty = Number(it?.qty);
    if (!Number.isFinite(ref) || ref < 1 || ref > catalogo.length) continue;  // ref inválida → ignorar
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const prod = catalogo[ref - 1];
    if (!prod?.id) continue;
    const prev = acumulado.get(prod.id);
    if (prev) prev.qty += qty;                       // mismo producto repetido → sumar
    else acumulado.set(prod.id, { producto: prod, qty });
  }

  for (const { producto, qty } of acumulado.values()) {
    const precio = Number(producto.precio) || 0;
    if (precio <= 0) {
      // Producto en catálogo pero sin precio en la lista del cliente → "consultar".
      out.sinPrecio.push({ productId: producto.id, nombre: producto.nombre, qty });
      continue;
    }
    out.lineas.push({
      productId: producto.id,
      nombre:    producto.nombre,
      unidad:    producto.unidad || 'un',
      qty,
      precio,
      subtotal:  Math.round(precio * qty * 100) / 100,
    });
  }

  // sinMatch tal como lo devolvió el modelo (texto que no mapeó a producto).
  if (Array.isArray(parsed.sinMatch)) {
    out.sinMatch = parsed.sinMatch.map(s => String(s || '').trim()).filter(Boolean);
  }

  out.ok = true;
  return out;
}
