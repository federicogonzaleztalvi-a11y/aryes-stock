# New Client Deployment Playbook

Estimated time: ~2 hours end to end.

---

## 1. Supabase — new project

1. Go to supabase.com → New Project
2. Name: `[client-slug]-stock` (e.g. `acme-stock`)
3. Region: same as Vercel deployment (US East or EU West)
4. Copy: **Project URL**, **anon key**, **service_role key**
5. Run the schema SQL from `supabase/schema.sql` in the SQL Editor
6. Create initial users in Authentication → Users, then set roles in the `users` table

---

## 2. Vercel — new project

1. Fork or duplicate the `aryes-stock` repo into the client's GitHub account  
   OR keep in the same account with a new branch/repo named `[client-slug]-stock`
2. Vercel → New Project → Import from GitHub
3. Set these Environment Variables:

| Key | Value | Notes |
|-----|-------|-------|
| `SUPABASE_URL` | `https://[ref].supabase.co` | From Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | `eyJ...` | Optional — used as fallback in chat proxy |
| `ANTHROPIC_KEY` | `sk-ant-...` | Shared or client-specific |
| `APP_URL` | `https://[client].vercel.app` | Exact production URL for CORS |

4. Set custom domain if client wants one (e.g. `stock.acme.com`)

---

## 3. Logo & branding (in the running app)

Once the app is deployed and the admin user is logged in:

1. Go to **Configuración → Marca**
2. Upload the client logo (PNG, max 500KB)
3. Set company name → appears in the sidebar and browser tab
4. Set brand color → used for active nav items
5. Save → branding persists in `app_config` table (`key = 'brandcfg'`)

The browser tab title updates automatically: `[Company Name] · Stock`

**Fallback behavior when no logo is configured:**
- Sidebar shows a green `STOCK` badge
- Login screen shows `/logo.png` from the public folder

To set a static login logo without using the branding UI, put a `logo.png`
in the `public/` folder of the repo before deploying.

---

## 4. Initial data setup

Two paths:

**Path A — Start from scratch (recommended)**
- Log in as admin → go to Importar datos
- Select the products from the built-in catalog that apply to this client
- Configure suppliers in Proveedores

**Path B — Import from Excel**
- Log in as admin → Inventario → Importar Excel
- Upload a spreadsheet with columns: name, stock, unit_cost (minimum)

---

## 5. Onboarding wizard

The onboarding wizard runs automatically on first login (before `stock-onboarding-done`
is set in localStorage). It guides the admin through:
- Company name and branding
- First supplier
- First product
- First user

To re-run the wizard manually (e.g. for a demo reset):
```js
// In browser devtools console:
localStorage.removeItem('stock-onboarding-done')
location.reload()
```

---

## 6. Checklist before handoff

- [ ] Admin user created and tested
- [ ] Operador user created and tested (verify they can't access config)
- [ ] Logo and company name set in Configuración → Marca
- [ ] At least one supplier configured
- [ ] Products imported or entered
- [ ] Email alerts configured (if client wants them)
- [ ] Custom domain set (if applicable)
- [ ] ANTHROPIC_KEY confirmed working (test the chat bubble)

---

## Environment variables reference

```
# Required
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Required for chat AI feature
ANTHROPIC_KEY=sk-ant-api03-...

# Required for CORS security
APP_URL=https://[your-domain].vercel.app

# Optional (chat proxy fallback, same as anon key)
SUPABASE_ANON_KEY=eyJ...
```

---

## localStorage key prefix

All localStorage keys use the prefix `aryes` (e.g. `aryes6-products`).
This is internal and invisible to the end client. No change needed per client
since each client has their own browser/device.

If you want to change the prefix for a fork, search and replace `aryes6-`,
`aryes7-`, `aryes8-`, `aryes9-` across `src/` and `src/tabs/`.
