// ── Aryes catalog data — shared across importer sub-tabs ─────────────────────
// Exported so each section file can import what it needs.
import { SKEY } from '../../lib/constants.js';

// ── Brand / supplier catalog ─────────────────────────────────────────────────
const LOVABLE_CATALOG = [{"id":"p-0001","name":"Chocolate Cobertura Confeiteiro con Leche 1 kg.","supplierId":"arg","unit":"kg","minStock":10,"dailyUsage":0.5,"category":"Chocolates","brand":"Selecta"},{"id":"p-0002","name":"Chocolate Cobertura Confeiteiro Semiamargo 1 kg.","supplierId":"arg","unit":"kg","minStock":10,"dailyUsage":0.5,"category":"Chocolates","brand":"Selecta"},{"id":"p-0003","name":"Chocolate Cobertura Confeiteiro Blanco 1 kg.","supplierId":"arg","unit":"kg","minStock":5,"dailyUsage":0.3,"category":"Chocolates","brand":"Selecta"}];
const IMP_BRAND_COLORS = {"Adimix":"#e8735a","Agropalma":"#7ab648","Duas Rodas / Dreidoppel":"#4a90d9","Ledevit":"#f5a623","MEC3":"#9b59b6","Pernigotti":"#2c3e50","Selecta":"#e74c3c"};
const IMP_SUP_LABEL = {"arg":"🇦🇷 Argentina / Brasil","ecu":"🇪🇨 Ecuador","eur":"🇪🇺 Europa"};
const IMP_SUP_COLOR = {"arg":"#2980b9","ecu":"#27ae60","eur":"#8e44ad"};
const USERS = [];
const SB_KEY = SKEY;

const dbWriteWithRetry = async (fn) => {
  for (let i = 0; i <= 2; i++) {
    try { const r = await fn(); if (r !== null) return r; } catch { /* retry */ }
    if (i < 2) await new Promise(r => setTimeout(r, [500,1000][i]||1000));
  }
  return null;
};


export { LOVABLE_CATALOG, IMP_BRAND_COLORS, IMP_SUP_LABEL, IMP_SUP_COLOR, USERS, SB_KEY, dbWriteWithRetry };
