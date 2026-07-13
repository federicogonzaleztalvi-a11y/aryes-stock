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
// "Lo de siempre" (estilo Zapia):
//   Si además le pasamos `habituales` (los productos que ESE cliente suele pedir,
//   con su cantidad típica — ver api/_habituales.js), el modelo puede reconocer
//   frases como "mandame lo de siempre" / "lo mismo que la última vez" y las
//   marcamos con un flag. Nosotros expandimos ese flag a las líneas habituales
//   del cliente (productId + cantidad típica), resolviendo precio/nombre contra
//   el catálogo igual que siempre. Se combina con ítems explícitos en el mismo
//   pedido ("2 de tomate y lo de siempre").
//
// Contrato:
//   interpretarPedido({ texto, catalogo, habituales?, model? }) → Promise<{
//     ok,                         // false si no hay API key o falló el parseo
//     lineas:   [{ productId, nombre, unidad, qty, precio, subtotal }],
//     sinPrecio:[{ productId, nombre, qty }],  // matcheado pero precio 0 → consultar
//     sinMatch: [string],         // texto que no se pudo mapear a un producto
//     error?,                     // detalle si ok=false
//   }>
//
// Pedido por FOTO:
//   Si en vez de `texto` (o además) pasamos `imagen` ({ media_type, data:base64 }),
//   Claude LEE la foto de la lista de compra (escrita a mano o impresa) y aplica
//   exactamente las mismas reglas de matcheo. El resto del pipeline (resolución
//   ref→producto, precio del catálogo, sinMatch, "lo de siempre") es idéntico.
//
//   catalogo:   [{ id, nombre, unidad, precio, categoria?, marca? }]  (de api/catalogo.js)
//   habituales: [{ productId, qtyTipica }]                            (de api/_habituales.js)
//   imagen:     { media_type:'image/jpeg'|'image/png'|'image/webp', data:'<base64>' }
// ============================================================================

import { log } from './_log.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
// Modelo acordado para el bot (ver memoria project_whatsapp_bot).
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Sos un asistente que interpreta pedidos mayoristas escritos en lenguaje natural (español rioplatense) y los convierte a JSON estructurado.

Te doy un CATÁLOGO numerado. Cada línea es:
  <ref>. <nombre> — <unidad> — $<precio>

El pedido puede llegar como TEXTO o como una FOTO de una lista de compra escrita a mano o impresa. Si te doy una imagen, leé cada renglón de la lista (aunque la letra sea difícil) y tratá cada ítem igual que si lo hubiera escrito. Tenés que:
1. Identificar cada producto que pide y mapearlo a la "ref" del catálogo que mejor coincida.
2. Extraer la cantidad pedida de cada uno (número; puede ser decimal como 2.5).
3. Lo que no puedas mapear con razonable confianza a una ref del catálogo, ponelo como texto en "sinMatch" (NO inventes una ref).

Reglas:
- Mapeá por significado, no solo por texto exacto: "coca" → "Coca Cola", "agua chica" → el agua de menor tamaño, etc. Si hay ambigüedad real entre varios, elegí el más probable; si no podés decidir, va a sinMatch.
- NO inventes refs que no estén en el catálogo. NO inventes precios.
- Si el cliente repite un producto, sumá las cantidades en una sola línea.
- Ignorá saludos, "gracias", "por favor", y texto que no sea un ítem de pedido.
- Repetir el último pedido: si el cliente pide repetir lo anterior con frases como "lo de siempre", "lo mismo de siempre", "lo habitual", "lo mismo que la última vez", "repetime el último pedido", "mandame lo de la otra vez", poné "loDeSiempre":true. Esto NO reemplaza a los ítems explícitos: si dice "2 de tomate y lo de siempre", devolvé el tomate en "items" Y "loDeSiempre":true. Si no lo menciona, "loDeSiempre":false.

Respondé ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"items":[{"ref":<entero>,"qty":<número>}],"sinMatch":[<string>],"loDeSiempre":<booleano>}`;

/**
 * Interpreta un pedido en texto libre contra el catálogo del cliente.
 * Función pura respecto del estado de la app: no escribe en DB, no envía nada.
 */
export async function interpretarPedido({ texto, catalogo = [], habituales = [], imagen = null, model } = {}) {
  const out = { ok: false, lineas: [], sinPrecio: [], sinMatch: [], error: null };

  if (!ANTHROPIC_KEY) {
    out.error = 'anthropic_not_configured';
    log.warn('wa-interpret', 'ANTHROPIC_KEY no configurada');
    return out;
  }
  const texInput = String(texto || '').trim();
  const tieneImg = !!(imagen && imagen.data);
  if (!texInput && !tieneImg) { out.ok = true; return out; }   // sin texto ni foto → pedido vacío
  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    out.error = 'empty_catalog';
    return out;
  }

  // Lista numerada 1..N para el prompt. El índice (ref) = posición+1.
  const listado = catalogo
    .map((p, i) => `${i + 1}. ${p.nombre} — ${p.unidad || 'un'} — $${Number(p.precio) || 0}`)
    .join('\n');

  // Contenido del mensaje: texto solo, o imagen (+ texto opcional). Cuando hay
  // foto, mandamos el bloque de imagen y una instrucción para que lea la lista.
  const userContent = tieneImg
    ? [
        { type: 'image', source: { type: 'base64', media_type: imagen.media_type || 'image/jpeg', data: imagen.data } },
        { type: 'text', text: texInput || 'Esta es la foto de mi lista de pedido. Leela y armá el pedido con el catálogo.' },
      ]
    : texInput;

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
        messages: [{ role: 'user', content: userContent }],
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

  // "Lo de siempre": si el modelo detectó el pedido habitual, expandimos los
  // productos habituales del cliente con su cantidad típica. Resolvemos cada
  // productId contra el catálogo (precio/nombre/unidad SIEMPRE del catálogo).
  // No pisa lo que el cliente pidió explícito: si ya está en el pedido, se saltea.
  if (parsed.loDeSiempre === true && Array.isArray(habituales) && habituales.length) {
    const porId = new Map(catalogo.map(p => [p.id, p]));
    for (const h of habituales) {
      const prod = porId.get(h?.productId);
      if (!prod?.id) continue;                        // ya no está en el catálogo → ignorar
      if (acumulado.has(prod.id)) continue;           // el cliente ya lo pidió explícito
      const qty = Math.max(1, Math.floor(Number(h?.qtyTipica) || 1));
      acumulado.set(prod.id, { producto: prod, qty });
    }
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
