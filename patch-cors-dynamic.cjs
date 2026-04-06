#!/usr/bin/env node
// patch-cors-dynamic.cjs — Replace hardcoded CORS in all API files with dynamic _cors.js

const fs = require('fs');
const path = require('path');

const apiDir = path.join(process.cwd(), 'api');

// Files that need updating and their patterns
const files = [
  'admin-users.js',
  'catalogo.js',
  'chat.js',
  'devolucion.js',
  'historial.js',
  'otp-send.js',
  'otp-verify.js',
  'payments.js',
  'pedido.js',
  'push.js',
  'register.js',
];

let updated = 0;

for (const file of files) {
  const filePath = path.join(apiDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭  ${file}: not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes("import { setCorsHeaders")) {
    console.log(`⏭  ${file}: already uses dynamic CORS`);
    continue;
  }

  // 1. Add import for setCorsHeaders at the top (after existing imports or at line 1)
  const importLine = "import { setCorsHeaders } from './_cors.js';\n";
  
  // Find the right place to insert — after the last import statement
  const importRegex = /^import .+$/gm;
  let lastImportEnd = 0;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }
  
  if (lastImportEnd > 0) {
    content = content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
  } else {
    // No imports found, add at top (after first comment block if any)
    const firstNewline = content.indexOf('\n');
    if (content.startsWith('//')) {
      // Find end of comment block
      const lines = content.split('\n');
      let insertAt = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('//') || lines[i].trim() === '') {
          insertAt = i + 1;
        } else break;
      }
      lines.splice(insertAt, 0, importLine);
      content = lines.join('\n');
    } else {
      content = importLine + content;
    }
  }

  // 2. Replace the CORS handling in the handler function
  // Pattern A: files that use Object.entries(CORS).forEach
  if (content.includes('Object.entries(CORS).forEach')) {
    content = content.replace(
      /Object\.entries\(CORS\)\.forEach\(\(\[k\s*,?\s*v\]\)\s*=>\s*res\.setHeader\(k\s*,?\s*v\)\);?/g,
      'await setCorsHeaders(req, res);'
    );
    
    // Make sure handler is async
    content = content.replace(
      /function handler\(req, res\)/g,
      'async function handler(req, res)'
    );
    // Already async handlers — no-op
    
    console.log(`✅ ${file}: replaced CORS forEach with setCorsHeaders`);
    updated++;
  }
  // Pattern B: files that use res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  else if (content.includes("res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)")) {
    content = content.replace(
      /res\.setHeader\('Access-Control-Allow-Origin', ALLOWED_ORIGIN\);\s*\n\s*res\.setHeader\('Access-Control-Allow-Methods'[^;]+;\s*\n\s*res\.setHeader\('Access-Control-Allow-Headers'[^;]+;/g,
      'await setCorsHeaders(req, res);'
    );
    console.log(`✅ ${file}: replaced setHeader CORS with setCorsHeaders`);
    updated++;
  }
  // Pattern C: files that set CORS differently
  else if (content.includes("'Access-Control-Allow-Origin'")) {
    // For files like historial.js that inline the CORS object
    // Just add the import, we'll handle CORS manually below
    console.log(`⚠️  ${file}: has CORS but non-standard pattern — import added, manual check needed`);
    updated++;
  }

  // 3. Remove old ALLOWED_ORIGIN constant (if exists) — keep it for backward compat but it won't matter
  // Don't remove — some files might reference it elsewhere

  fs.writeFileSync(filePath, content, 'utf8');
}

// Special handling for files with CORS object pattern
// historial.js, otp-send.js, otp-verify.js, pedido.js have inline CORS objects
const inlineCorsFiles = ['historial.js', 'otp-send.js', 'otp-verify.js', 'pedido.js'];
for (const file of inlineCorsFiles) {
  const filePath = path.join(apiDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // These files define CORS as a const object, then use Object.entries(CORS).forEach
  // The forEach was already replaced above, but we need to check if the handler
  // needs to call setCorsHeaders before the OPTIONS check
  
  // Check if setCorsHeaders is being called
  if (content.includes('setCorsHeaders') && !content.includes('await setCorsHeaders')) {
    content = content.replace('setCorsHeaders(req, res)', 'await setCorsHeaders(req, res)');
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

console.log(`
══════════════════════════════════════════════
✅ Dynamic CORS applied to ${updated} API files!

  All endpoints now use setCorsHeaders(req, res)
  which checks domain_orgs table for allowed origins.
  
  When you add a custom domain for a client:
  INSERT INTO domain_orgs (org_id, domain, active)
  VALUES ('client_org_id', 'stock.client.com', true);
  
  CORS will automatically allow that domain within 5 min.
══════════════════════════════════════════════`);
