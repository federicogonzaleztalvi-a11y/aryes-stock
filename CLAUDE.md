# Pazque — Contexto para Claude Code

## Qué es
SaaS B2B para distribuidoras wholesale (HORECA, food, cosmetics). Multi-tenant.
Primer cliente real: Eric Da Silva (aryes-ltda-6223).
Construido por Federico González (fundador + único dev). Antes se llamaba Aryes Stock.

## Stack
- Frontend: React 18 + Vite (src/)
- Backend: Vercel Serverless Functions (api/)
- DB: Supabase PostgreSQL (mrotnqybqvmvlexncvno.supabase.co)
- Deploy: Vercel Pro → pazque.com
- Repo: GitHub → Vercel auto-deploy

## Reglas críticas
1. Deploy: siempre npm run build && git add -A && git commit -m "msg" && git push origin main && npx vercel --prod
2. Editar archivos JSX: usar Python heredoc con .replace() — NUNCA sed en JSX
3. DB updates: db.patch() nunca db.upsert() para actualizaciones
4. RLS Supabase: 42 tablas con RLS activo. Para UPDATE masivo: DISABLE RLS → ejecutar → ENABLE RLS
5. Vercel Pro, sin límite de funciones serverless

## Orgs
- aryes-ltda — org de Federico (demo/admin, NO distribuidor real)
- aryes-ltda-6223 — Eric Da Silva (primer cliente real)

## Auth portal B2B
- OTP por WhatsApp (Meta Cloud API, WA_ACCESS_TOKEN en Vercel)
- api/otp-send.js y api/otp-verify.js filtran por org_id en query de clientes
- Portal: pazque.com/pedidos?org=aryes-ltda-6223

## Estado actual (Jun 2026)
### Completado:
- 249 productos cargados para Eric con fotos
- ImportadorPrecios.jsx — importador de listas de precio desde Excel
- Soporta formato legado (Producto | $ | Precio | /kg)
- Soporta template Pazque (columnas: Nombre Pazque, Precio/kg, Unidad, Peso, Descuento%, Precio Final)
- Match exacto por nombre cuando usa template Pazque
- Guarda en price_list_items (no en precio_venta)
- Lista lista_xfl4ropb creada para Eric con lista_id asignada

### Pendiente urgente:
- Limpiar precio_venta incorrectos: UPDATE products SET precio_venta = 0 WHERE org_id = 'aryes-ltda-6223'
- price_list_items vacío para Eric — necesita correr importador con template
- Label /kg en portal debe eliminarse
- Zero-Touch Fulfillment (auto-factura, auto-ruta)
- VAPID keys rotas en prod

## Archivos clave
- src/tabs/ImportadorPrecios.jsx — importador de precios
- src/tabs/PreciosListasTab.jsx — gestión de listas de precio
- src/pages/PedidosPage.jsx — portal B2B cliente
- api/catalogo.js — API del catálogo (lee price_list_items cuando cliente tiene lista_id)
- api/otp-send.js / api/otp-verify.js — auth portal
- src/context/AppContext.tsx — estado global

## DB tabla products — columnas relevantes
uuid, name, category, precio_venta, imagen_url, descripcion, codigo, org_id, stock

## Env vars Vercel
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
WA_ACCESS_TOKEN, ANTHROPIC_KEY
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
