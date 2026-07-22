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
//     ambiguos: [{ texto, qty, opciones:[{productId,nombre,unidad,precio}] }],
//               // el cliente nombró algo genérico ("chocolate") que calza con VARIOS
//               // productos del catálogo → en vez de adivinar o descartarlo, se le
//               // ofrecen las opciones candidatas para que elija (ver más abajo).
//     sinMatch: [string],         // texto que NO tiene ningún candidato razonable
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

El pedido puede llegar como TEXTO o como una FOTO de una lista de compra escrita a mano o impresa. Si te doy una imagen, leé cada renglón de la lista (aunque la letra sea difícil) y tratá cada ítem igual que si lo hubiera escrito. Para cada ítem que el cliente pide, clasificalo en UNA de estas tres categorías:

1. "items": mapea con confianza razonable a UN ÚNICO producto del catálogo (por significado, no solo texto exacto: "coca" → "Coca Cola", "agua chica" → el agua de menor tamaño, etc). Van con su "ref" y cantidad.
2. "ambiguos": el cliente nombró algo GENÉRICO o incompleto que podría referirse a 2 o más productos distintos del catálogo (ej: dice "chocolate" y hay Chocolate Águila, Chocolate Nestlé y Chocolate Milka; o dice "agua" sin decir tamaño y hay varios tamaños). En este caso NO adivines cuál quiso decir ni lo descartes: reportalo en "ambiguos" con el texto tal como lo dijo, la cantidad, y hasta 5 "refs" de los candidatos más probables del catálogo (el más probable primero).
3. "sinMatch": el texto NO tiene NINGÚN candidato razonable en el catálogo (producto que no existe, letra ilegible, etc). Ahí va como string simple (NO inventes una ref).

Reglas:
- Preferí "ambiguos" sobre "sinMatch" siempre que exista al menos un producto del catálogo remotamente relacionado — es mejor ofrecer opciones que decir "no lo encontré".
- Preferí "items" sobre "ambiguos" cuando el cliente ya fue específico (marca, tamaño, o el catálogo solo tiene una opción de esa categoría) — no generes ambigüedad artificial.
- NO inventes refs que no estén en el catálogo. NO inventes precios.
- Si el cliente repite un producto, sumá las cantidades en una sola línea.
- Ignorá saludos, "gracias", "por favor", y texto que no sea un ítem de pedido.
- Repetir el último pedido: si el cliente pide repetir lo anterior con frases como "lo de siempre", "lo mismo de siempre", "lo habitual", "lo mismo que la última vez", "repetime el último pedido", "mandame lo de la otra vez", poné "loDeSiempre":true. Esto NO reemplaza a los ítems explícitos: si dice "2 de tomate y lo de siempre", devolvé el tomate en "items" Y "loDeSiempre":true. Si no lo menciona, "loDeSiempre":false.

Respondé ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"items":[{"ref":<entero>,"qty":<número>}],"ambiguos":[{"texto":<string>,"qty":<número>,"refs":[<entero>]}],"sinMatch":[<string>],"loDeSiempre":<booleano>}`;

// ── Helper compartido: llamada a Claude + parseo defensivo del JSON ──────────
// Usado por interpretarPedido (pedido completo) y resolverOpcionLibre (respuesta
// corta a una pregunta de desambiguación). Centraliza fetch/errores/parseo para
// no duplicar el boilerplate en cada función que habla con Anthropic.
async function callClaude({ system, userContent, maxTokens, model }) {
  const res = { rawText: null, error: null };
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
        max_tokens: maxTokens || 1500,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      res.error = 'anthropic_error';
      log.error('wa-interpret', 'Anthropic error', { status: r.status, body: err.slice(0, 300) });
      return res;
    }
    data = await r.json();
  } catch (e) {
    res.error = 'fetch_error';
    log.error('wa-interpret', 'fetch a Anthropic falló', { error: e.message });
    return res;
  }
  res.rawText = (data?.content || []).map(b => b?.text || '').join('').trim();
  return res;
}

// Parsea JSON de la respuesta de forma defensiva: el modelo podría envolverlo en
// prosa pese a la instrucción, así que si el parseo directo falla tomamos el
// primer bloque {...} que aparezca.
function parseJsonLoose(rawText) {
  try { return JSON.parse(rawText); } catch { /* sigue */ }
  const m = String(rawText || '').match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* sigue null */ } }
  return null;
}

/**
 * Interpreta un pedido en texto libre contra el catálogo del cliente.
 * Función pura respecto del estado de la app: no escribe en DB, no envía nada.
 */
export async function interpretarPedido({ texto, catalogo = [], habituales = [], imagen = null, model } = {}) {
  const out = { ok: false, lineas: [], sinPrecio: [], ambiguos: [], sinMatch: [], error: null };

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

  const { rawText, error } = await callClaude({
    system: SYSTEM_PROMPT + '\n\nCATÁLOGO:\n' + listado,
    userContent,
    maxTokens: 1500,
    model,
  });
  if (error) { out.error = error; return out; }

  const parsed = parseJsonLoose(rawText);
  if (!parsed || !Array.isArray(parsed.items)) {
    out.error = 'parse_error';
    log.warn('wa-interpret', 'respuesta no parseable', { sample: String(rawText).slice(0, 200) });
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

  // Resolver "ambiguos": texto genérico con varios candidatos posibles del
  // catálogo. Si tras filtrar refs inválidas queda UN solo candidato, la
  // ambigüedad se disolvió sola → lo tratamos como match directo (evita
  // pedirle al cliente que "elija" cuando en realidad ya está resuelto).
  if (Array.isArray(parsed.ambiguos)) {
    for (const a of parsed.ambiguos) {
      const texto = String(a?.texto || '').trim();
      const qty = Number(a?.qty);
      if (!texto || !Number.isFinite(qty) || qty <= 0) continue;
      const refs = Array.isArray(a?.refs) ? a.refs : [];
      const vistos = new Set();
      const opciones = [];
      for (const r of refs) {
        const ref = Math.floor(Number(r));
        if (!Number.isFinite(ref) || ref < 1 || ref > catalogo.length) continue;
        const prod = catalogo[ref - 1];
        if (!prod?.id || vistos.has(prod.id)) continue;
        vistos.add(prod.id);
        opciones.push(prod);
        if (opciones.length >= 5) break;
      }
      if (opciones.length === 0) {
        out.sinMatch.push(texto);                        // sin candidatos válidos → sinMatch
      } else if (opciones.length === 1) {
        // Un solo candidato válido → ya no es ambiguo, resolver directo.
        const prod = opciones[0];
        const prev = acumulado.get(prod.id);
        if (prev) prev.qty += qty; else acumulado.set(prod.id, { producto: prod, qty });
      } else {
        out.ambiguos.push({
          texto, qty,
          opciones: opciones.map(p => ({
            productId: p.id, nombre: p.nombre, unidad: p.unidad || 'un', precio: Number(p.precio) || 0,
          })),
        });
      }
    }
    // Si un candidato de "ambiguos" se resolvió solo, recién ahora lo pasamos a
    // líneas/sinPrecio (mismo criterio de precio que el resto del pedido).
    for (const { producto, qty } of acumulado.values()) {
      const yaAgregado = out.lineas.some(l => l.productId === producto.id)
        || out.sinPrecio.some(s => s.productId === producto.id);
      if (yaAgregado) continue;
      const precio = Number(producto.precio) || 0;
      if (precio <= 0) { out.sinPrecio.push({ productId: producto.id, nombre: producto.nombre, qty }); continue; }
      out.lineas.push({
        productId: producto.id, nombre: producto.nombre, unidad: producto.unidad || 'un',
        qty, precio, subtotal: Math.round(precio * qty * 100) / 100,
      });
    }
  }

  // sinMatch tal como lo devolvió el modelo (texto que no mapeó a producto).
  if (Array.isArray(parsed.sinMatch)) {
    out.sinMatch = out.sinMatch.concat(parsed.sinMatch.map(s => String(s || '').trim()).filter(Boolean));
  }

  out.ok = true;
  return out;
}

// ── Resolver una desambiguación con la respuesta LIBRE del cliente ───────────
// Cuando el pedido queda "ambiguo" (ver arriba), el portal le pregunta al
// cliente cuál de 2-5 opciones quiso decir. El cliente puede tocar un botón
// (resolución instantánea, sin IA) O escribir/decir su respuesta con sus
// palabras ("el nestlé", "el más barato", "el segundo", "ninguno"). Para eso
// está esta función: es una llamada MINI y ACOTADA (compara solo contra esas
// pocas opciones ya filtradas, nunca contra todo el catálogo de nuevo), así
// que es rápida, barata, y no puede "irse" a matchear un producto no
// relacionado — el universo posible es exactamente las opciones ofrecidas.
//
// Contrato:
//   resolverOpcionLibre({ texto, opciones:[{productId,nombre,unidad,precio}], model })
//     → Promise<{ ok, productId: string|null, error? }>
//       productId=null → el cliente no eligió ninguna opción, o no se pudo
//       determinar con confianza cuál quiso decir (se le vuelve a preguntar).
export async function resolverOpcionLibre({ texto, opciones = [], model } = {}) {
  const out = { ok: false, productId: null, error: null };

  if (!ANTHROPIC_KEY) { out.error = 'anthropic_not_configured'; return out; }
  const t = String(texto || '').trim();
  if (!t || !Array.isArray(opciones) || opciones.length === 0) { out.ok = true; return out; }

  const listado = opciones
    .map((o, i) => `${i + 1}. ${o.nombre} — ${o.unidad || 'un'} — $${Number(o.precio) || 0}`)
    .join('\n');

  const system = `Le mostramos al cliente estas opciones de un catálogo mayorista para que elija una:
${listado}

El cliente respondió en sus propias palabras: "${t}"

Puede: nombrar la opción (aunque no sea el nombre exacto), decir "el primero/segundo/tercero" o "la primera/segunda", compararlas por precio o tamaño ("el más barato", "el más grande"), o decir que no quiere ninguna ("ninguno", "no", "ninguna de esas", "sacalo").

Respondé ÚNICAMENTE con este JSON, sin texto adicional:
{"opcion":<entero 1..${opciones.length}, o 0 si no eligió ninguna o no se puede determinar>}`;

  const { rawText, error } = await callClaude({ system, userContent: t, maxTokens: 60, model });
  if (error) { out.error = error; return out; }

  const parsed = parseJsonLoose(rawText);
  const idx = Math.floor(Number(parsed?.opcion));
  if (Number.isFinite(idx) && idx >= 1 && idx <= opciones.length) {
    out.productId = opciones[idx - 1].productId;
  }
  out.ok = true;
  return out;
}
