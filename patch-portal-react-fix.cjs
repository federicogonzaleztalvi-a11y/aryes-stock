#!/usr/bin/env node
// patch-portal-react-fix.cjs — Fix "React is not defined" in PedidosPage

const fs = require('fs');
const path = require('path');

const pedidosPath = path.join(process.cwd(), 'src/pages/PedidosPage.jsx');
let pg = fs.readFileSync(pedidosPath, 'utf8');

// The file imports { useState, useEffect, ... } from 'react' but CartDrawer
// uses React.useState and React.useEffect directly. Fix: add React import.

const oldImport = "import { useState, useEffect, useMemo, useCallback } from 'react';";
const newImport = "import React, { useState, useEffect, useMemo, useCallback } from 'react';";

if (pg.includes(oldImport)) {
  pg = pg.replace(oldImport, newImport);
  console.log('✅ Added React default import');
} else if (pg.includes("import React,")) {
  console.log('⏭  React already imported');
} else {
  // Fallback: add React import at the top
  pg = "import React from 'react';\n" + pg;
  console.log('✅ Added React import at top (fallback)');
}

fs.writeFileSync(pedidosPath, pg, 'utf8');

console.log(`
══════════════════════════════════════════════
✅ Fixed: React is now imported in PedidosPage
  CartDrawer can use React.useState, React.useEffect
══════════════════════════════════════════════`);
