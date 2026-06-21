// Genera manual-aryes.html (versión a medida de Aryes/Eric) a partir de manual-pazque.html
// y renderiza manual-aryes.pdf. Sin mención a precios de Pazque.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import WebSocket from '../node_modules/ws/wrapper.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = ROOT + 'manual-pazque.html';
const HTML = ROOT + 'manual-aryes.html';
const PDF = ROOT + 'manual-aryes.pdf';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let h = readFileSync(SRC, 'utf8');

const reps = [
  // ---------- <title> ----------
  ['<title>Pazque · Manual y Guía de la Plataforma</title>',
   '<title>Pazque para Aryes · Lo que tu operación podría ser</title>'],

  // ---------- COVER ----------
  ['<span class="tag">Manual y guía de la plataforma</span>',
   '<span class="tag">Preparado para Aryes Ltda · El principal proveedor de sabores del Uruguay</span>'],

  ['<h1>La plataforma que opera tu distribuidora por vos.</h1>',
   '<h1>Lo que la operación de Aryes podría ser.</h1>'],

  [`<p class="lead">Stock, pedidos, facturación, logística y un copiloto de IA — todo en un solo lugar.
       Pazque <b>opera tu distribuidora</b>: el pedido entra solo, el stock se descuenta solo, la factura sale sola, y la <b>inteligencia artificial</b> hace el trabajo pesado por vos.</p>`,
   `<p class="lead">Aryes mueve más de <b>250 productos</b> —sabores, esencias, extractos, deshidratados y cacao— para <b>más de 1.000 clientes</b>: panaderías, heladerías, HORECA e industria.
       Hoy cada pedido pasa de un vendedor a un mail y de un mail a facturación. Pazque junta todo en una sola plataforma: el pedido <b>entra ya cargado</b>, sigue hasta la factura <b>sin que nadie lo vuelva a tipear</b>, y un <b>copiloto de IA</b> hace el trabajo pesado por vos.</p>`],

  [`<div class="pill-list">
      <span>Multiempresa</span><span>Portal de clientes</span><span>Pedidos por WhatsApp</span>
      <span>Copiloto IA</span><span>Facturación</span><span>Rutas y seguimiento</span><span>Stock en tiempo real</span>
    </div>`,
   `<div class="pill-list">
      <span>Portal para tus 1.000+ clientes</span><span>Pedidos por WhatsApp</span><span>Copiloto IA</span>
      <span>Facturación sin reprocesos</span><span>Listas de precio por cliente</span><span>Stock por lote y vencimiento</span>
    </div>`],

  [`<div><b>Para</b> distribuidoras mayoristas · gastronomía · alimentos · cosmética</div>
      <div><b>Acceso</b> pazque.com</div>`,
   `<div><b>Preparado para</b> Aryes Ltda · sabores, esencias y deshidratados · Montevideo, Uruguay</div>
      <div><b>Acceso</b> pazque.com</div>`],

  // ---------- INTRO ----------
  ['<div class="kicker">Por qué Pazque</div>',
   '<div class="kicker">Por qué Pazque para Aryes</div>'],

  ['<h2 class="sec">Menos planillas. Menos llamadas. Menos errores.</h2>',
   '<h2 class="sec">Menos mails. Menos reprocesos. Menos errores en facturas.</h2>'],

  [`<p class="sec-lead">Las distribuidoras viven entre el WhatsApp, el Excel y el cuaderno. Pazque reemplaza ese rompecabezas por una sola plataforma donde el pedido entra solo, el stock se descuenta solo, la factura sale sola y vos te enterás antes de que algo se rompa.</p>`,
   `<p class="sec-lead">Hoy en Aryes un pedido nace cuando uno de tus 3 vendedores lo toma y lo pasa por mail a quien factura. Recién ahí alguien lo vuelve a cargar a mano. En cada salto se pierde tiempo y se cuelan errores que después aparecen en la factura.</p>
    <div class="callout"><p><b>Lo que pasa hoy:</b> cliente → vendedor → mail → quien factura vuelve a tipear todo → factura. &nbsp;<b>Con Pazque:</b> el pedido entra ya cargado —con el cliente y sus precios— y sigue solo hasta la factura. Tus vendedores dejan de transcribir y nadie escribe lo mismo dos veces.</p></div>`],

  // primeras 3 cards del intro
  [`<h3>El pedido entra solo</h3>
        <p>Tus clientes piden desde un portal propio o por WhatsApp en texto libre. Sin que nadie cargue nada a mano.</p>`,
   `<h3>El pedido entra solo</h3>
        <p>Tus 1.000+ clientes —panaderías, heladerías, HORECA— piden desde un portal con la marca de Aryes o por WhatsApp. Sin que un vendedor lo transcriba.</p>`],

  [`<h3>El proceso se ejecuta solo</h3>
        <p>Cada pedido reserva el stock al instante —todo o nada, nunca a medias—, dispara la notificación, arma la orden en PDF y avisa por correo.</p>`,
   `<h3>El proceso se ejecuta solo</h3>
        <p>Cada pedido reserva stock, arma la orden en PDF y la deja lista para facturar — sin el mail de por medio ni el doble tipeo que hoy genera errores.</p>`],

  [`<h3>Del pedido a la factura</h3>
        <p>Ventas, facturación y listas de precio por cliente conectadas, sin recargar datos dos veces.</p>`,
   `<h3>Del pedido a la factura</h3>
        <p>Se termina el mail al facturador: el pedido llega a facturación con los datos del cliente y sus precios ya cargados. Menos reprocesos, menos errores.</p>`],

  // ---------- LEADS por sección ----------
  ['<p class="sec-lead">El centro desde donde ves el negocio entero: qué vendiste, qué te falta, qué se viene y qué pasó.</p>',
   '<p class="sec-lead">El centro desde donde ves Aryes entero: qué se vendió, qué hay que reponer, qué pedidos vienen y qué pasó — sin pedirle un reporte a nadie.</p>'],

  ['<p class="sec-lead">Una sola fuente de verdad para tus productos, con control fino de lotes, vencimientos y precios por cliente.</p>',
   '<p class="sec-lead">Tus 250+ productos —sabores, esencias, extractos, deshidratados y cacao— en una sola fuente de verdad: con fotos, lotes, vencimientos y la lista de precios de cada cliente.</p>'],

  ['<p class="sec-lead">El recorrido completo de un pedido: del cliente a la venta, de la venta a la factura — sin recargar datos.</p>',
   '<p class="sec-lead">El recorrido completo de un pedido de Aryes: del vendedor (o del propio cliente) a la venta, y de la venta a la factura — sin pasar por el mail ni recargar datos.</p>'],

  ['<p class="sec-lead">Tu propia tienda mayorista, con la imagen de tu distribuidora, donde cada cliente entra, ve sus precios y pide solo.</p>',
   '<p class="sec-lead">Tu propia tienda mayorista con la marca de Aryes, donde cada panadería, heladería o cuenta HORECA entra, ve sus precios y pide sola — sin ocupar a un vendedor.</p>'],

  ['<p class="sec-lead">La IA no es un chiste de marketing acá: entiende tu inventario, interpreta los pedidos de tus clientes y te ahorra trabajo real — siempre con vos al mando.</p>',
   '<p class="sec-lead">La IA no es marketing acá: entiende tu catálogo de sabores, interpreta los pedidos en texto libre que hoy te llegan por WhatsApp y te ahorra el trabajo de cargarlos — siempre con vos al mando.</p>'],

  ['<p class="sec-lead">Esto es lo que pasa solo, por debajo, cada vez que un cliente hace un pedido. Vos no tocás nada: la plataforma encadena todo y te avisa.</p>',
   '<p class="sec-lead">Esto es lo que hoy hacen a mano tus vendedores y tu facturador. Con Pazque pasa solo, por debajo, cada vez que un cliente pide. Vos no tocás nada: la plataforma encadena todo y te avisa.</p>'],

  ['<p class="sec-lead">Cada persona de tu equipo ve y hace exactamente lo que le corresponde.</p>',
   '<p class="sec-lead">Cada persona de Aryes —tus 3 vendedores, quien factura, el depósito— ve y hace exactamente lo que le corresponde.</p>'],

  ['<p class="sec-lead">De cero a operativo en pocos pasos.</p>',
   '<p class="sec-lead">De cero a operativo en pocos pasos. Tus 250+ productos ya están cargados con foto y precio — el primer paso ya está hecho.</p>'],

  // ---------- Ejemplos IA personalizados ----------
  ['<span class="ai">armame un excel con las ventas de la última semana por categoría</span>',
   '<span class="ai">armame un excel con las ventas de esencias y deshidratados del último mes</span>'],

  ['<li><b>Propone cambios masivos:</b> "subí 10% los precios de bebidas". La IA <b>propone</b> la acción y vos la <b>confirmás</b> antes de que se aplique.</li>',
   '<li><b>Propone cambios masivos:</b> "subí 8% los precios de la línea de cacao". La IA <b>propone</b> la acción y vos la <b>confirmás</b> antes de que se aplique.</li>'],

  ['<li>Entiende mensajes con typos, abreviaturas y cantidades en palabras: <i>"mandame 10 cajas de coca y 2 de agua chica"</i>.</li>',
   '<li>Entiende mensajes con typos, abreviaturas y cantidades en palabras: <i>"mandame 5 kg de esencia de vainilla y 2 de cacao en polvo"</i>.</li>'],

  // ---------- Empezar: catálogo ya cargado ----------
  [`<div class="step"><div><h4>Cargá tu catálogo</h4><p>Importá productos desde tu Excel o cargalos con foto y precio en Inventario.</p></div></div>`,
   `<div class="step"><div><h4>Tu catálogo ya está cargado</h4><p>Tus 250+ productos ya están en Pazque con foto y precio. Listo para operar — sin trabajo de carga inicial.</p></div></div>`],

  ['<div class="step"><div><h4>Habilitá tus clientes en el portal</h4><p>Dales acceso al portal B2B; entran con su WhatsApp y ven sus precios.</p></div></div>',
   '<div class="step"><div><h4>Habilitá a tus clientes en el portal</h4><p>Dales acceso a tus panaderías, heladerías y cuentas HORECA; entran con su WhatsApp y ven sus precios. Tus vendedores dejan de transcribir pedidos.</p></div></div>'],
];

let applied = 0, missed = [];
for (const [a, b] of reps) {
  if (h.includes(a)) { h = h.split(a).join(b); applied++; }
  else missed.push(a.slice(0, 60));
}

writeFileSync(HTML, h);
console.log('aplicadas:', applied, '/', reps.length, '| tamaño:', (h.length / 1024 | 0) + 'KB');
if (missed.length) { console.log('NO encontradas:'); missed.forEach(m => console.log('  -', m)); }

// ---------- render PDF ----------
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9351;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--no-first-run', '--user-data-dir=/tmp/pz-aryes', 'about:blank'], { stdio: 'ignore' });
let idc = 0;
const rpc = (ws, m, p = {}) => new Promise((res, rej) => { const id = ++idc; const hh = d => { const x = JSON.parse(d); if (x.id === id) { ws.off('message', hh); x.error ? rej(new Error(x.error.message)) : res(x.result); } }; ws.on('message', hh); ws.send(JSON.stringify({ id, method: m, params: p })); });
(async () => {
  let u; for (let i = 0; i < 40; i++) { try { const t = await (await fetch(`http://localhost:${PORT}/json`)).json(); const p = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl); if (p) { u = p.webSocketDebuggerUrl; break; } } catch {} await sleep(250); }
  const ws = new WebSocket(u, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  await rpc(ws, 'Page.enable');
  const L = new Promise(r => { const hh = d => { const m = JSON.parse(d); if (m.method === 'Page.loadEventFired') { ws.off('message', hh); r(); } }; ws.on('message', hh); });
  await rpc(ws, 'Page.navigate', { url: 'file://' + HTML }); await L; await sleep(1200);
  const { data } = await rpc(ws, 'Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.3, marginBottom: 0.3, marginLeft: 0.3, marginRight: 0.3, scale: 0.92 });
  writeFileSync(PDF, Buffer.from(data, 'base64'));
  const m = Buffer.from(data, 'base64').toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  console.log('PDF:', PDF, '| páginas:', m ? m.length : '?');
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('ERR', e); chrome.kill(); process.exit(1); });
