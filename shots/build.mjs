// Embeds screenshots (base64) into manual-pazque.html and renders manual-pazque.pdf via headless Chrome.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import WebSocket from '../node_modules/ws/wrapper.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = ROOT + 'shots/';
const HTML = ROOT + 'manual-pazque.html';
const PDF = ROOT + 'manual-pazque.pdf';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const b64 = (f) => 'data:image/png;base64,' + readFileSync(SHOTS + f).toString('base64');
const fig = (file, cap, url = 'pazque.com/app') =>
  `\n<figure class="shot"><div class="bar"><i></i><i></i><i></i><span class="u">${url}</span></div>` +
  `<img alt="${cap}" src="${b64(file)}"><figcaption>${cap}</figcaption></figure>`;

const CSS = `
  /* ---------- Screenshot device frame ---------- */
  figure.shot{margin:22px 0 4px; border-radius:14px; overflow:hidden; border:1px solid var(--line); background:#0b1f1a; box-shadow:0 10px 40px rgba(2,40,30,.18); position:relative}
  figure.shot .bar{height:34px; background:linear-gradient(#0f2a23,#0b1f1a); display:flex; align-items:center; gap:7px; padding:0 14px}
  figure.shot .bar i{width:11px; height:11px; border-radius:50%; display:inline-block}
  figure.shot .bar i:nth-child(1){background:#ff5f57} figure.shot .bar i:nth-child(2){background:#febc2e} figure.shot .bar i:nth-child(3){background:#28c840}
  figure.shot .bar .u{margin-left:14px; font-size:12px; color:#7fe7c4; font-family:ui-monospace,Menlo,monospace}
  figure.shot img{display:block; width:100%; height:auto; background:#f5f5f7}
  figure.shot figcaption{position:absolute; left:0; right:0; bottom:0; padding:10px 14px; font-size:13px; color:#eafff6; background:linear-gradient(transparent, rgba(2,28,22,.85)); font-weight:600}
  .shot-grid{display:grid; grid-template-columns:1fr 1fr; gap:18px}
  @media (max-width:720px){ .shot-grid{grid-template-columns:1fr} }
`;

let html = readFileSync(HTML, 'utf8');

// 1) inject CSS before the footer-style comment
html = html.replace('  /* ---------- Footer ---------- */', CSS + '\n  /* ---------- Footer ---------- */');

// 2) insert figures right after each section's sec-lead paragraph (unique anchors)
const inserts = [
  ['qué vendiste, qué te falta, qué se viene y qué pasó.</p>',
    fig('dashboard.png', 'Tablero en vivo: ventas, cobranzas, deuda y alertas de stock — todo de un vistazo.')],
  ['control fino de lotes, vencimientos y precios por cliente.</p>',
    fig('inventario.png', 'Catálogo con stock en tiempo real, fotos, lotes y reposición sugerida.')],
  ['del cliente a la venta, de la venta a la factura — sin recargar datos.</p>',
    `\n<div class="shot-grid">${fig('pedidos.png', 'Pedidos del portal y WhatsApp en un solo tablero.')}${fig('clientes.png', 'Cartera de clientes con precios y descuentos por cliente.')}</div>`],
  ['interpreta los pedidos de tus clientes y te ahorra trabajo real — siempre con vos al mando.</p>',
    fig('ai-copilot.png', 'Pazque AI: tu copiloto que entiende tu inventario, genera reportes y propone cambios — con tu confirmación.')],
];
for (const [anchor, frag] of inserts) {
  if (!html.includes(anchor)) { console.log('  (anchor NOT found:', anchor.slice(0, 40), ')'); continue; }
  html = html.replace(anchor, anchor + frag);
}

writeFileSync(HTML, html);
console.log('embedded; html size:', (html.length / 1024 | 0) + 'KB',
            '| data-uris:', (html.match(/data:image\/png/g) || []).length);

// 3) render PDF via headless Chrome printToPDF
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--no-first-run', '--no-default-browser-check', '--user-data-dir=/tmp/pazque-pdf-profile',
  'about:blank',
], { stdio: 'ignore' });

let idc = 0;
function rpc(ws, method, params = {}) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    const onMsg = (data) => { const m = JSON.parse(data); if (m.id === id) { ws.off('message', onMsg); m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result); } };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try { const t = await (await fetch(`http://localhost:${PORT}/json`)).json(); const p = t.find(x => x.type === 'page' && x.webSocketDebuggerUrl); if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch {}
    await sleep(250);
  }
  if (!wsUrl) throw new Error('no devtools target');
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await rpc(ws, 'Page.enable');
  const loaded = new Promise(res => { const h = d => { const m = JSON.parse(d); if (m.method === 'Page.loadEventFired') { ws.off('message', h); res(); } }; ws.on('message', h); });
  await rpc(ws, 'Page.navigate', { url: 'file://' + HTML });
  await loaded;
  await sleep(1200); // fonts/layout settle
  const { data } = await rpc(ws, 'Page.printToPDF', {
    printBackground: true, preferCSSPageSize: false,
    paperWidth: 8.27, paperHeight: 11.69, // A4 inches
    marginTop: 0.3, marginBottom: 0.3, marginLeft: 0.3, marginRight: 0.3,
    scale: 0.92,
  });
  writeFileSync(PDF, Buffer.from(data, 'base64'));
  console.log('PDF written:', PDF);
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('ERR', e); chrome.kill(); process.exit(1); });
