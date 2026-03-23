# ARYES STOCK — CONTEXT COMPLETO PARA CLAUDE
> Usá este archivo como documento base en el Project de Claude.
> Actualizalo cada vez que haya cambios importantes de arquitectura, credenciales o roadmap.
> Última actualización: 23 Mar 2026

---

## 1. QUÉ ES ESTE PROYECTO

**Aryes Stock** es una plataforma SaaS de gestión de inventario, operaciones y ERP para distribuidoras (inicialmente Aryes, distribuidora de insumos gastronómicos en Uruguay).

**Stack:**
- Frontend: React 18 + Vite, sin TypeScript, sin ESLint
- Backend: Supabase (Postgres + Auth + RLS) + Vercel Serverless Functions
- Deploy: Vercel (producción automática desde `main`)
- Estado: localStorage como cache + Supabase como source of truth
- Repositorio: `federicogonzaleztalvi-a11y/aryes-stock` (GitHub)

**URLs:**
- Producción: https://aryes-stock.vercel.app
- Supabase: https://mrotnqybqvmvlexncvno.supabase.co
- Supabase dashboard: https://supabase.com/dashboard/project/mrotnqybqvmvlexncvno

---

## 2. CREDENCIALES (SOLO USAR EN CONTEXTO DE DESARROLLO)

```
# Supabase
SUPABASE_URL=https://mrotnqybqvmvlexncvno.supabase.co
SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SUPABASE_SERVICE_ROLE_KEY

# Vercel
VERCEL_PROJECT_ID=prj_lfj7DhNMuPrrk4ZWF4YxLGz9iByJ
VERCEL_TEAM_ID=federico-gonzalezs-projects-7c7268fb

# GitHub
REPO=federicogonzaleztalvi-a11y/aryes-stock
TOKEN=TU_GITHUB_TOKEN
```

**Usuarios de prueba:**
- admin@aryes.com / TU_PASSWORD
- operador@aryes.com / TU_PASSWORD
- vendedor@aryes.com / TU_PASSWORD

---

## 3. ESTRUCTURA DEL REPO

```
src/
  App.jsx                    # 3357 líneas — layout principal, estado global, routing
  main.jsx                   # 165 líneas — auth/login, Root component
  lib/
    constants.js             # db object, LS helper, getAuthHeaders, ALERT_CFG
    ui.jsx                   # T theme object, Cap, Btn, AlertPill, StockBar, etc.
  components/                # Componentes aislados (patrón seguro)
    CommandPalette.jsx       # ⌘K palette — navegación + búsqueda
    NotificationBell.jsx     # 🔔 en topbar — alertas persistentes
    SetupChecklist.jsx       # Card de setup progress en dashboard
    SmartToasts.jsx          # Toasts efímeros al cargar
  tabs/                      # 28 tabs lazy-loaded
    DashboardInline.jsx      # Dashboard con KPIs dobles
    FacturacionTab.jsx       # CFEs, cuenta corriente, cobros, aging
    ClientesTab.jsx          # Gestión de clientes
    VentasTab.jsx            # Ventas
    ImporterTab.jsx          # Importación masiva de productos
    ... (22 tabs más)

api/
  admin-users.js             # CRUD usuarios via SECURITY DEFINER RPCs
  chat.js                    # Proxy Anthropic API con auth JWT

supabase-rls.sql             # Políticas RLS actuales
supabase-setup-final.sql     # Schema completo
supabase-orders-schema.sql   # Schema de órdenes

DEPLOY.md                    # Playbook para nuevos clientes
CONTEXT.md                   # Este archivo
```

---

## 4. ARQUITECTURA DE DATOS

### Tablas Supabase (relacionales, con RLS)
- `products` — tiene id INTEGER y uuid TEXT (dualidad — deuda técnica crítica)
- `suppliers`
- `orders`
- `stock_movements` — inmutable (solo INSERT)
- `users` — roles: admin / operador / vendedor
- `app_config` — configuración por empresa
- `audit_log`
- `plans`
- `aryes_data` — ⚠️ tabla blob KEY/VALUE (problema crítico de multi-tenancy)

### localStorage keys activas (37 total, las críticas)
```
aryes6-products         → array de productos
aryes6-suppliers        → array de proveedores
aryes6-orders           → array de pedidos
aryes8-movements        → array de movimientos
aryes7-plans            → planes de compra
aryes-cfe               → ⚠️ facturas CFE (solo localStorage, sin tabla)
aryes-clients           → ⚠️ clientes (solo localStorage, sin tabla)
aryes-cobros            → ⚠️ cobros (solo localStorage, sin tabla)
aryes-session           → JWT del usuario autenticado
aryes-brand             → configuración de marca
```

### Patrón de sync
- **Reads:** localStorage primero (instant), Supabase en background
- **Writes:** localStorage inmediato + Supabase async (non-blocking)
- **Problema:** last-write-wins en blob data, sin conflict resolution

---

## 5. COMPONENTES AISLADOS (PATRÓN SEGURO)

Todos los features nuevos van en `src/components/` siguiendo estas reglas:
1. Un archivo por feature
2. Zero referencias a `T` (theme object) a nivel de módulo — colores inline
3. `import React from 'react'` explícito
4. App.jsx changes: máximo 2 líneas (1 import + 1 render)
5. Sin mutaciones ni efectos secundarios complejos

**Estado actual de componentes:**
- ✅ `SetupChecklist.jsx` — setup progress en dashboard (vertical list, 5 pasos)
- ✅ `SmartToasts.jsx` — toasts al cargar (critN + CFEs vencidas)
- ✅ `CommandPalette.jsx` — ⌘K, extraído de App.jsx
- ✅ `NotificationBell.jsx` — 🔔 en topbar, panel persistente

---

## 6. ITERACIONES COMPLETADAS (SAFE AUTONOMOUS ENGINEER)

El workflow es: PLAN → aprobación → IMPLEMENT → VALIDATE → STOP.

| # | Feature | Estado | Notas |
|---|---|---|---|
| 1 | SetupChecklist MVP | ✅ Done | Grid 2x2 inicial |
| 2 | SetupChecklist polished | ✅ Done | Lista vertical, hints, numeración |
| 3 | SmartToasts | ✅ Done | Toast efímeros, critN + CFE vencidas |
| 4 | CommandPalette extract | ✅ Done | 164 líneas removidas de App.jsx |
| 5 | NotificationBell | ✅ Done | 🔔 con badge, panel dropdown |
| 6 | QuickStats bar | ⏳ PENDIENTE | Plan aprobado, no implementado |

**Iteración 6 — QuickStats (PLAN APROBADO, PENDIENTE IMPLEMENTAR):**
- Archivo nuevo: `src/components/QuickStats.jsx`
- Pills en topbar: stock crítico, pedidos activos, deuda pendiente
- Solo aparecen si valor > 0
- App.jsx changes: 1 import + 1 render entre search bar y bell
- Props: `critN`, `orders` (ya disponibles en ese scope)

---

## 7. PROBLEMAS CRÍTICOS (del Technical Audit)

### 🔴 URGENTE — Hacer antes del segundo cliente

1. **`aryes_data` RLS es un data breach**: política `USING (true)` — todos los tenants ven todos los datos de todos. Fix: agregar `company_id` y actualizar política.

2. **`aryes-cfe`, `aryes-clients`, `aryes-cobros` sin tabla real**: facturas, clientes y cobros viven solo en localStorage y se replican como JSON blobs. Sin foreign keys, sin queries, sin consistencia. Migrar a tablas propias.

3. **Dualidad `products.id`**: tiene id INTEGER (legacy) y uuid TEXT (nuevo). El código usa ambos. Migrar a UUID como PK.

### 🟡 ALTO — Próximo sprint

4. **Sin rate limiting en `api/chat.js`**: un usuario puede quemar el budget de Anthropic sin límite.

5. **`App.jsx` 3357 líneas**: extraer Context + hooks (`useProducts`, `useOrders`, `useMovements`).

6. **Stock update + movement insert no son atómicos**: dos `await` separados sin transacción. Si el segundo falla, el audit log queda incorrecto.

---

## 8. REGLAS TÉCNICAS APRENDIDAS (no romper)

### La causa raíz de los crashes de producción anteriores
Los componentes definidos a nivel de módulo en `App.jsx` que referencian el objeto `T` (theme) antes de que esté inicializado causan errores TDZ (`Cannot access 'Yt' before initialization`) en el bundle de Vite con `target: 'es2022'`.

**Solución definitiva:** Todo componente nuevo va en `src/components/` con `import React` explícito y colores inline (nunca `T.*` a nivel de módulo).

### Vite config crítica
```js
// vite.config.js — NO cambiar el target
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' } // evita que esbuild transforme const/let y cause TDZ
})
```

### Cómo agregar un tab nuevo
1. Crear `src/tabs/NuevoTab.jsx` con `import React from 'react'`
2. En App.jsx: `const NuevoTab = React.lazy(() => import('./tabs/NuevoTab.jsx'))`
3. En el nav array: `{id:'nuevo', label:'Nuevo', icon:'🔧'}`
4. En NAV_ROLES: agregar el id a los roles que correspondan
5. En el render: `{activeTab==='nuevo'&&<ErrorBoundary><Suspense fallback={...}><NuevoTab .../></Suspense></ErrorBoundary>}`

### Cómo agregar un componente nuevo (patrón seguro)
1. Crear `src/components/NuevoComponente.jsx`
2. `import React from 'react'` al inicio
3. Colores como strings inline, nunca `T.green` etc.
4. En App.jsx: 1 línea import + 1 línea render máximo
5. Verificar: `npx vite build` pasa sin errores
6. Verificar: `git diff --stat` muestra solo +2 en App.jsx

---

## 9. MÓDULOS DEL SIDEBAR

```
PRINCIPAL:    Dashboard, Inventario, Pedidos, Proveedores
OPERACIONES:  Movimientos, Lotes/Venc., Depósito, Rutas, Tracking, Recepcion, Scanner
COMERCIAL:    Clientes, Ventas, Facturación
ANÁLISIS:     KPIs, Informes, Demanda, Auditoría
SISTEMA:      Importar datos, Configuración
```

**Roles y acceso:**
- admin: todo
- operador: sin config, sin audit, sin demanda, sin precios, sin informes
- vendedor: dashboard, inventory, clientes, ventas, facturacion, movimientos

---

## 10. FACTURACIÓN (módulo propio)

`src/tabs/FacturacionTab.jsx` — 1286 líneas, completamente funcional.

**4 vistas:**
- Comprobantes: lista de CFEs con filtros, filas rojas si vencidas
- Cuenta Corriente: estado de cuenta por cliente, KPIs, historial
- Cobros: registro de pagos por método (transferencia/efectivo/cheque/tarjeta)
- Informes: aging de deuda (Al día / 1-30d / 31-60d / 61-90d / +90d)

**Storage actual:** localStorage (`aryes-cfe`, `aryes-cobros`) + Supabase no-blocking.
**DGI integration:** pendiente (banner "Proveedor habilitado DGI no configurado").
**Numeración:** eFact-000001, eTick-000002, etc. (secuencia en localStorage).

---

## 11. DEPLOY WORKFLOW

```bash
# Todo push a main trigerea deploy automático en Vercel
git add .
git commit -m "feat: descripción"
git push origin main
# Deploy tarda ~90 segundos
# Verificar en https://aryes-stock.vercel.app
```

**Vercel env vars configuradas:**
- `ANTHROPIC_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `APP_URL=https://aryes-stock.vercel.app`

---

## 12. CONTEXTO DE NEGOCIO

- **Cliente actual:** Aryes (distribuidora gastronómica, Uruguay)
- **Mercado objetivo:** Distribuidoras LATAM (Uruguay, Argentina, México)
- **Competencia:** Saico (legacy desktop), Holded (España), Xero, Tiny ERP/Omie
- **Pricing recomendado:** $89 Starter / $199 Pro / $349 Business
- **Diferenciador clave:** WMS + facturación + gestión de proveedores importadores en una sola plataforma, onboarding en 48hs vs meses de los ERPs legacy
- **Próxima integración crítica:** DGI Uruguay (UCFE/pymo) para CFEs con validez legal

---

## 13. CÓMO USAR ESTE CONTEXT CON CLAUDE

**Al inicio de cada sesión en el Project, decile:**
> "Estoy trabajando en Aryes Stock. El contexto completo está en CONTEXT.md. Quiero continuar con [tarea específica]."

**Para sesiones de código:**
> "Seguimos con el Safe Autonomous Engineer workflow. El último estado es [iteración X]. Planificá la siguiente."

**Para decisiones de arquitectura:**
> "Revisá la sección de problemas críticos en el CONTEXT y ayudame a planificar el fix de [problema]."

**Para nuevas sesiones largas de implementación técnica:**
> Considera usar Claude Code (terminal) para editar archivos directamente sin el overhead del chat.
