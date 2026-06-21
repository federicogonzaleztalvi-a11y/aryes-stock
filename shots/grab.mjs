// Headless-Chrome screenshot grabber via raw CDP (ws). Drives the Pazque demo.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import WebSocket from '../node_modules/ws/wrapper.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const BASE = 'http://localhost:5173';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--window-size=1440,900', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=/tmp/pazque-shots-profile', `${BASE}/?demo=true`,
], { stdio: 'ignore' });

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json`);
      const tabs = await r.json();
      const page = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('no devtools target');
}

let idc = 0;
function rpc(ws, method, params = {}) {
  const id = ++idc;
  return new Promise((resolve, reject) => {
    const onMsg = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) { ws.off('message', onMsg); msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result); }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const evalJs = (ws, expr) => rpc(ws, 'Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
const val = async (ws, expr) => (await evalJs(ws, expr)).result.value;
async function waitFor(ws, expr, ms = 12000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await val(ws, expr)) return true; } catch {}
    await sleep(300);
  }
  console.log('  (timeout waiting:', label || expr.slice(0, 40), ')');
  return false;
}

async function shot(ws, name) {
  const { data } = await rpc(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(OUT + name + '.png', Buffer.from(data, 'base64'));
  console.log('saved', name);
}

const clickText = (txt) => `(()=>{const t=${JSON.stringify(txt)};const els=[...document.querySelectorAll('nav button, aside button, button')].filter(e=>e.offsetParent&&e.textContent.replace(/[0-9]/g,'').includes(t));if(els[0]){els[0].click();return true;}return false;})()`;

(async () => {
  const wsUrl = await getWs();
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await rpc(ws, 'Page.enable');
  await rpc(ws, 'Runtime.enable');
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });

  await sleep(2500); // app boot
  console.log('path:', await val(ws, 'location.pathname'));

  // If demo selector isn't showing, click the landing "Explorá el producto" button.
  const hasSelector = await val(ws, `!!document.querySelector('.ds-card')`);
  if (!hasSelector) {
    await val(ws, `(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>/explor/i.test(x.textContent)&&x.offsetParent);if(b){b.click();return b.textContent.trim();}return null;})()`);
    await waitFor(ws, `!!document.querySelector('.ds-card')`, 8000, 'demo selector');
  }
  // Select first industry card, then click "Explorar ..."
  await val(ws, `(()=>{const c=document.querySelector('.ds-card');if(c)c.click();return !!c;})()`);
  await sleep(600);
  await val(ws, `(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^explorar/i.test(x.textContent.trim()));if(b){b.click();return true;}return false;})()`);

  // Wait until we're inside the SaaS app (sidebar nav present).
  await waitFor(ws, `!!document.querySelector('nav button')`, 12000, 'app nav');
  await sleep(1500);
  console.log('entered app, path:', await val(ws, 'location.pathname'),
              '| navBtns:', await val(ws, `document.querySelectorAll('nav button').length`));

  const tabs = [
    ['Dashboard', 'dashboard'],
    ['Inventario', 'inventario'],
    ['Pedidos', 'pedidos'],
    ['Clientes', 'clientes'],
    ['Precios', 'precios'],
    ['KPIs', 'kpis'],
    ['Rutas', 'rutas'],
  ];
  for (const [label, file] of tabs) {
    const ok = await evalJs(ws, clickText(label));
    await sleep(1800);
    await shot(ws, file);
    if (!ok.result.value) console.log('  (warn: tab not found via text:', label, ')');
  }

  // AI copilot: open the floating chat (bottom-right). Try known selectors then fallback to last fixed button.
  await evalJs(ws, `(()=>{
    const cand=[...document.querySelectorAll('button')].filter(b=>{const s=getComputedStyle(b);return s.position==='fixed'&&parseInt(s.bottom)<60&&parseInt(s.right)<60;});
    if(cand[0]){cand[0].click();return true;}
    return false;
  })()`);
  await sleep(1600);
  await shot(ws, 'ai-copilot');

  await rpc(ws, 'Browser.close').catch(()=>{});
  ws.close();
  chrome.kill();
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.error('ERR', e); chrome.kill(); process.exit(1); });
