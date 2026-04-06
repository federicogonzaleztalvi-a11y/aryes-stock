#!/usr/bin/env node
// patch-rate-limit.cjs — Add rate limiting to catalogo, pedido, historial

const fs = require('fs');
const path = require('path');

// Rate limit code snippet (in-memory, same pattern as register.js)
const rateLimitCode = (name, maxReqs, windowMs) => `
// ── Rate limiting: max ${maxReqs} requests per IP per ${windowMs/60000} min ──
const _rl_${name} = new Map();
function _checkRate_${name}(ip) {
  const now = Date.now();
  const entry = _rl_${name}.get(ip) || [];
  const recent = entry.filter(t => now - t < ${windowMs});
  if (recent.length >= ${maxReqs}) return false;
  recent.push(now);
  _rl_${name}.set(ip, recent);
  return true;
}
`;

const rateLimitCheck = (name) => `
  const _ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!_checkRate_${name}(_ip)) return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un momento.' });
`;

// 1. catalogo.js — 60 requests per minute per IP
const catPath = path.join(process.cwd(), 'api/catalogo.js');
let cat = fs.readFileSync(catPath, 'utf8');

if (!cat.includes('_checkRate')) {
  // Add rate limit function after CORS definition
  const catAnchor = 'function setHeaders(res';
  cat = cat.replace(catAnchor, rateLimitCode('cat', 60, 60000) + catAnchor);
  
  // Add check at start of handler
  cat = cat.replace(
    "if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });",
    "if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });" + rateLimitCheck('cat')
  );
  console.log('✅ catalogo.js: rate limit added (60 req/min/IP)');
} else {
  console.log('⏭  catalogo.js: already has rate limiting');
}
fs.writeFileSync(catPath, cat, 'utf8');

// 2. pedido.js — 10 requests per minute per IP (creating orders)
const pedPath = path.join(process.cwd(), 'api/pedido.js');
let ped = fs.readFileSync(pedPath, 'utf8');

if (!ped.includes('_checkRate')) {
  // Add rate limit function after CORS
  const pedAnchor = 'async function validatePortalSession';
  ped = ped.replace(pedAnchor, rateLimitCode('ped', 10, 60000) + pedAnchor);
  
  // Add check at start of handler
  ped = ped.replace(
    "if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });",
    "if (!SB_URL || !SB_ANON)    return res.status(500).json({ error: 'Server misconfigured' });" + rateLimitCheck('ped')
  );
  console.log('✅ pedido.js: rate limit added (10 req/min/IP)');
} else {
  console.log('⏭  pedido.js: already has rate limiting');
}
fs.writeFileSync(pedPath, ped, 'utf8');

// 3. historial.js — 30 requests per minute per IP
const hisPath = path.join(process.cwd(), 'api/historial.js');
let his = fs.readFileSync(hisPath, 'utf8');

if (!his.includes('_checkRate')) {
  // Add rate limit function after CORS
  const hisAnchor = 'async function handler';
  his = his.replace(hisAnchor, rateLimitCode('his', 30, 60000) + hisAnchor);
  
  // Add check after method check
  his = his.replace(
    "if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });",
    "if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });" + rateLimitCheck('his')
  );
  console.log('✅ historial.js: rate limit added (30 req/min/IP)');
} else {
  console.log('⏭  historial.js: already has rate limiting');
}
fs.writeFileSync(hisPath, his, 'utf8');

// 4. otp-send.js — 5 requests per 10 minutes per IP (prevent OTP spam)
const otpPath = path.join(process.cwd(), 'api/otp-send.js');
let otp = fs.readFileSync(otpPath, 'utf8');

if (!otp.includes('_checkRate')) {
  const otpAnchor = 'export default async function handler';
  otp = otp.replace(otpAnchor, rateLimitCode('otp', 5, 600000) + otpAnchor);
  
  otp = otp.replace(
    "if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });",
    "if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });" + rateLimitCheck('otp')
  );
  console.log('✅ otp-send.js: rate limit added (5 req/10min/IP)');
} else {
  console.log('⏭  otp-send.js: already has rate limiting');
}
fs.writeFileSync(otpPath, otp, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Rate limiting patched!

  catalogo.js  → 60 req/min/IP (catalog browsing)
  pedido.js    → 10 req/min/IP (order creation)
  historial.js → 30 req/min/IP (order history)
  otp-send.js  → 5 req/10min/IP (OTP spam prevention)
  
  register.js already had 3 req/hr/IP (unchanged)
══════════════════════════════════════════════`);
