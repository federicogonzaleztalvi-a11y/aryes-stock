import { useState } from 'react';
import { db, LS } from '../lib/constants.js';

const G = '#059669';
const ONBOARDING_KEY = 'stock-onboarding-done';

const T = {
  serif: 'Playfair Display, serif',
  sans: 'Inter, sans-serif',
  text: '#1a1a18',
  textSm: '#6a6a68',
  border: '#e8e4dc',
  bg: '#faf9f6',
  muted: '#f4f3f0',
  green: G,
};

const inp = {
  width: '100%',
  padding: '10px 13px',
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 14,
  fontFamily: T.sans,
  color: T.text,
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
};

const STEPS = [
  { id: 'company',  label: 'Empresa',    icon: '🏢' },
  { id: 'brand',    label: 'Marca',      icon: '🎨' },
  { id: 'supplier', label: 'Proveedor',  icon: '🚚' },
  { id: 'product',  label: 'Producto',   icon: '📦' },
  { id: 'user',     label: 'Usuario',    icon: '👤' },
];

function StepDots({ current }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', margin: '0 0 32px' }}>
      {STEPS.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: i === current ? 28 : 10,
            height: 10,
            borderRadius: 5,
            background: i < current ? G : i === current ? G : T.border,
            opacity: i < current ? 0.4 : 1,
            transition: 'all .25s',
          }} />
        </div>
      ))}
    </div>
  );
}

function StepHeader({ step, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{STEPS[step].icon}</div>
      <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: G, marginBottom: 8 }}>
        Paso {step + 1} de {STEPS.length}
      </div>
      <h2 style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 500, color: T.text, margin: '0 0 8px' }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: T.sans, fontSize: 14, color: T.textSm, margin: 0, lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: T.textSm, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}{required && <span style={{ color: '#c00', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function BtnRow({ onBack, onNext, onSkip, nextLabel = 'Siguiente →', loading, canNext = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {onBack && (
          <button onClick={onBack} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: T.sans, color: T.textSm }}>
            ← Atrás
          </button>
        )}
        {onSkip && (
          <button onClick={onSkip} style={{ padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: T.sans, color: T.textSm, textDecoration: 'underline' }}>
            Saltear
          </button>
        )}
      </div>
      <button
        onClick={onNext}
        disabled={!canNext || loading}
        style={{ padding: '10px 28px', background: canNext && !loading ? G : '#ccc', color: '#fff', border: 'none', borderRadius: 8, cursor: canNext && !loading ? 'pointer' : 'not-allowed', fontSize: 14, fontFamily: T.sans, fontWeight: 600 }}
      >
        {loading ? 'Guardando...' : nextLabel}
      </button>
    </div>
  );
}

// ── STEP 1 — Company ──────────────────────────────────────────────────────────
function StepCompany({ data, setData, onNext, onSkip }) {
  return (
    <div>
      <StepHeader step={0} title="Contanos sobre tu empresa" subtitle="Esta información aparecerá en reportes y notificaciones." />
      <Field label="Nombre de la empresa" required>
        <input style={inp} value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ej: Distribuidora Gourmet S.A." />
      </Field>
      <Field label="País">
        <input style={inp} value={data.country} onChange={e => setData(d => ({ ...d, country: e.target.value }))} placeholder="Ej: Uruguay" />
      </Field>
      <Field label="Ciudad">
        <input style={inp} value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))} placeholder="Ej: Montevideo" />
      </Field>
      <Field label="Email de contacto">
        <input style={inp} type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="admin@empresa.com" />
      </Field>
      <BtnRow onSkip={onSkip} onNext={onNext} canNext={!!data.name.trim()} />
    </div>
  );
}

// ── STEP 2 — Brand ────────────────────────────────────────────────────────────
function StepBrand({ data, setData, onBack, onNext, onSkip }) {
  return (
    <div>
      <StepHeader step={1} title="Personalizá el sistema" subtitle="Podés cambiar esto más adelante en Config → Marca y empresa." />
      <Field label="Nombre visible en el sidebar">
        <input style={inp} value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ej: GourmetStock" />
      </Field>
      <Field label="URL del logo (opcional)">
        <input style={inp} value={data.logoUrl} onChange={e => setData(d => ({ ...d, logoUrl: e.target.value }))} placeholder="https://mi-empresa.com/logo.png" />
        {data.logoUrl && (
          <img src={data.logoUrl} alt="preview" onError={e => e.target.style.display = 'none'} style={{ marginTop: 8, height: 40, objectFit: 'contain', display: 'block' }} />
        )}
      </Field>
      <Field label="Color principal">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="color" value={data.color} onChange={e => setData(d => ({ ...d, color: e.target.value }))} style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }} />
          <input style={{ ...inp, width: 120 }} value={data.color} onChange={e => setData(d => ({ ...d, color: e.target.value }))} placeholder="#059669" />
          <span style={{ fontSize: 12, color: T.textSm }}>← Se aplica al sidebar</span>
        </div>
      </Field>
      <BtnRow onBack={onBack} onSkip={onSkip} onNext={onNext} />
    </div>
  );
}

// ── STEP 3 — First Supplier ───────────────────────────────────────────────────
function StepSupplier({ data, setData, onBack, onNext, onSkip }) {
  const FLAGS = ['🇦🇷 AR', '🇧🇷 BR', '🇺🇾 UY', '🇨🇱 CL', '🇵🇾 PY', '🇺🇸 US', '🇩🇪 DE', '🇮🇹 IT', '🇪🇸 ES', '🇫🇷 FR', '🇪🇨 EC', 'EU', '—'];
  return (
    <div>
      <StepHeader step={2} title="Agregá tu primer proveedor" subtitle="Podés agregar más desde el módulo de Proveedores." />
      <Field label="Nombre del proveedor" required>
        <input style={inp} value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ej: Argentina" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="País / Bandera">
          <select style={inp} value={data.flag} onChange={e => setData(d => ({ ...d, flag: e.target.value.slice(-2) }))}>
            {FLAGS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Moneda">
          <select style={inp} value={data.currency} onChange={e => setData(d => ({ ...d, currency: e.target.value }))}>
            {['USD', 'EUR', 'UYU', 'ARS', 'BRL'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Empresa">
        <input style={inp} value={data.company} onChange={e => setData(d => ({ ...d, company: e.target.value }))} placeholder="Razón social o nombre comercial" />
      </Field>
      <Field label="Email de contacto">
        <input style={inp} type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="contacto@proveedor.com" />
      </Field>
      <BtnRow onBack={onBack} onSkip={onSkip} onNext={onNext} canNext={!!data.name.trim()} />
    </div>
  );
}

// ── STEP 4 — First Product ────────────────────────────────────────────────────
function StepProduct({ data, setData, suppliers, onBack, onNext, onSkip }) {
  const UNITS = ['kg', 'g', 'lt', 'ml', 'u', 'pack', 'caja', 'bolsa', 'frasco', 'lata'];
  return (
    <div>
      <StepHeader step={3} title="Creá tu primer producto" subtitle="Podés importar el catálogo completo desde Importar datos." />
      <Field label="Nombre del producto" required>
        <input style={inp} value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ej: Chocolate amargo 70%" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Stock inicial">
          <input style={inp} type="number" min="0" value={data.stock} onChange={e => setData(d => ({ ...d, stock: e.target.value }))} placeholder="0" />
        </Field>
        <Field label="Unidad">
          <select style={inp} value={data.unit} onChange={e => setData(d => ({ ...d, unit: e.target.value }))}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Costo unitario">
          <input style={inp} type="number" min="0" step="0.01" value={data.unitCost} onChange={e => setData(d => ({ ...d, unitCost: e.target.value }))} placeholder="0.00" />
        </Field>
        <Field label="Proveedor">
          <select style={inp} value={data.supplierId} onChange={e => setData(d => ({ ...d, supplierId: e.target.value }))}>
            <option value="">— sin asignar —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <BtnRow onBack={onBack} onSkip={onSkip} onNext={onNext} canNext={!!data.name.trim()} />
    </div>
  );
}

// ── STEP 5 — First User ───────────────────────────────────────────────────────
function StepUser({ data, setData, onBack, onNext, onSkip, loading, error }) {
  const [show, setShow] = useState(false);
  const ROLES = [
    { value: 'admin', label: 'Administrador', desc: 'Acceso completo' },
    { value: 'operador', label: 'Operador', desc: 'Inventario y stock' },
    { value: 'vendedor', label: 'Vendedor', desc: 'Ventas y clientes' },
  ];
  return (
    <div>
      <StepHeader step={4} title="Creá el primer usuario" subtitle="Podés gestionar todos los usuarios desde Config → Usuarios." />
      <Field label="Nombre">
        <input style={inp} value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Nombre completo" />
      </Field>
      <Field label="Email" required>
        <input style={inp} type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="usuario@empresa.com" />
      </Field>
      <Field label="Contraseña" required>
        <div style={{ position: 'relative' }}>
          <input style={{ ...inp, paddingRight: 44 }} type={show ? 'text' : 'password'} value={data.password} onChange={e => setData(d => ({ ...d, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
          <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.textSm }}>
            {show ? '🙈' : '👁'}
          </button>
        </div>
      </Field>
      <Field label="Rol">
        <div style={{ display: 'flex', gap: 10 }}>
          {ROLES.map(r => (
            <button key={r.value} onClick={() => setData(d => ({ ...d, role: r.value }))}
              style={{ flex: 1, padding: '10px 8px', border: `2px solid ${data.role === r.value ? G : T.border}`, borderRadius: 8, background: data.role === r.value ? '#f0f9f0' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: data.role === r.value ? G : T.text }}>{r.label}</div>
              <div style={{ fontFamily: T.sans, fontSize: 11, color: T.textSm, marginTop: 2 }}>{r.desc}</div>
            </button>
          ))}
        </div>
      </Field>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontFamily: T.sans, marginTop: 4 }}>{error}</div>}
      <BtnRow onBack={onBack} onSkip={onSkip} onNext={onNext} nextLabel="Crear usuario →" loading={loading}
        canNext={!!data.email.trim() && data.password.length >= 6} />
    </div>
  );
}

// ── DONE screen ───────────────────────────────────────────────────────────────
function StepDone({ onFinish }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 500, color: T.text, margin: '0 0 12px' }}>¡Todo listo!</h2>
      <p style={{ fontFamily: T.sans, fontSize: 15, color: T.textSm, lineHeight: 1.7, margin: '0 0 28px' }}>
        Tu sistema está configurado.<br />Podés seguir agregando proveedores, productos y usuarios en cualquier momento.
      </p>
      <button onClick={onFinish} style={{ padding: '12px 36px', background: G, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontFamily: T.sans, fontWeight: 700 }}>
        Ir al dashboard →
      </button>
    </div>
  );
}

// ── MAIN WIZARD ───────────────────────────────────────────────────────────────
export default function OnboardingWizard({ session, onComplete, onSkip: onSkipAll }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userError, setUserError] = useState('');

  // Accumulated state per step
  const [company, setCompany] = useState({ name: '', country: '', city: '', email: '' });
  const [brand, setBrand] = useState({ name: '', logoUrl: '', color: '#059669' });
  const [supplier, setSupplier] = useState({ name: '', flag: 'AR', currency: 'USD', company: '', email: '' });
  const [product, setProduct] = useState({ name: '', stock: '0', unit: 'kg', unitCost: '0', supplierId: '' });
  const [user, setUser] = useState({ name: '', email: '', password: '', role: 'operador' });

  // savedSuppliers accumulates as we create them, so product step can reference them
  const [savedSuppliers, setSavedSuppliers] = useState([]);

  const markDone = () => {
    LS.set(ONBOARDING_KEY, { completedAt: new Date().toISOString(), email: session?.email });
    setDone(true);
  };

  // ── Save helpers ─────────────────────────────────────────────────────────────
  const saveCompanyAndBrand = async () => {
    // Save brand to app_config
    const brandToSave = { ...brand, name: brand.name || company.name };
    // Update localStorage for immediate sidebar update
    localStorage.setItem('aryes-brand', JSON.stringify(brandToSave));
    try {
      await db.upsert('app_config',
        { key: 'brandcfg', value: brandToSave, updated_at: new Date().toISOString() },
        'key'
      );
    } catch { /* non-blocking */ }
    // Also save company info to app_config
    try {
      await db.upsert('app_config',
        { key: 'companycfg', value: company, updated_at: new Date().toISOString() },
        'key'
      );
    } catch { /* non-blocking */ }
  };

  const saveSupplierData = async () => {
    if (!supplier.name.trim()) return null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const supData = {
      id, name: supplier.name, flag: supplier.flag || '—', color: G,
      times: { preparation: 2, customs: 1, freight: 4, warehouse: 1 },
      company: supplier.company || '', contact: '', email: supplier.email || '',
      phone: '', country: '', city: '',
      currency: supplier.currency || 'USD', payment_terms: '30',
      payment_method: '', min_order: '', discount: '0',
      rating: 3, active: true, notes: '', updated_at: now,
    };
    // Update LS
    const existing = LS.get('aryes6-suppliers', []);
    LS.set('aryes6-suppliers', [...existing, { ...supData, id, paymentTerms: '30', paymentMethod: '' }]);
    setSavedSuppliers(s => [...s, { id, name: supplier.name }]);
    try { await db.upsert('suppliers', supData); } catch { /* non-blocking */ }
    return id;
  };

  const saveProductData = async (supplierId) => {
    if (!product.name.trim()) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const prod = {
      uuid: id,
      name: product.name,
      barcode: '',
      supplier_id: supplierId || product.supplierId || '',
      unit: product.unit || 'kg',
      stock: Number(product.stock) || 0,
      unit_cost: Number(product.unitCost) || 0,
      min_stock: 5,
      daily_usage: 0.5,
      category: '',
      brand: '',
      history: [],
      updated_at: now,
    };
    // Update LS
    const existing = LS.get('aryes6-products', []);
    LS.set('aryes6-products', [...existing, {
      id, name: product.name, supplierId: prod.supplier_id,
      unit: prod.unit, stock: prod.stock, unitCost: prod.unit_cost,
      minStock: prod.min_stock, history: [],
    }]);
    try { await db.upsert('products', prod, 'uuid'); } catch { /* non-blocking */ }
  };

  const createUser = async () => {
    if (!user.email.trim() || user.password.length < 6) return false;
    try {
      const res = await fetch('/api/admin-users?action=create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name || user.email.split('@')[0],
          role: user.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || 'Error al crear usuario');
        return false;
      }
      return true;
    } catch {
      setUserError('Error de conexión. Podés crear el usuario desde Config → Usuarios.');
      return false;
    }
  };

  // ── Step navigation ──────────────────────────────────────────────────────────
  const goNext = async () => {
    setLoading(true);
    try {
      if (step === 0) {
        // just advance — company saved together with brand in step 1
        setStep(1);
      } else if (step === 1) {
        await saveCompanyAndBrand();
        setStep(2);
      } else if (step === 2) {
        await saveSupplierData();
        setStep(3);
      } else if (step === 3) {
        await saveProductData();
        setStep(4);
      } else if (step === 4) {
        setUserError('');
        const ok = await createUser();
        if (ok || !user.email.trim()) markDone();
      }
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));

  const skipStep = () => {
    if (step >= STEPS.length - 1) { markDone(); return; }
    setStep(s => s + 1);
  };

  // ── Skip all wizard ──────────────────────────────────────────────────────────
  const handleSkipAll = () => {
    LS.set(ONBOARDING_KEY, { skipped: true, at: new Date().toISOString() });
    onSkipAll?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: T.bg, borderRadius: 16, width: '100%', maxWidth: 520,
        padding: '36px 40px', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        maxHeight: '90vh', overflowY: 'auto',
        fontFamily: T.sans,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: G, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Configuración inicial
          </div>
          {!done && (
            <button onClick={handleSkipAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textSm, textDecoration: 'underline', padding: 0 }}>
              Saltear todo
            </button>
          )}
        </div>

        {!done && <StepDots current={step} />}

        {done ? (
          <StepDone onFinish={onComplete} />
        ) : step === 0 ? (
          <StepCompany data={company} setData={setCompany} onNext={goNext} onSkip={skipStep} />
        ) : step === 1 ? (
          <StepBrand data={brand} setData={setBrand} onBack={goBack} onNext={goNext} onSkip={skipStep} />
        ) : step === 2 ? (
          <StepSupplier data={supplier} setData={setSupplier} onBack={goBack} onNext={goNext} onSkip={skipStep} />
        ) : step === 3 ? (
          <StepProduct data={product} setData={setProduct} suppliers={savedSuppliers} onBack={goBack} onNext={goNext} onSkip={skipStep} />
        ) : (
          <StepUser data={user} setData={setUser} onBack={goBack} onNext={goNext} onSkip={skipStep} loading={loading} error={userError} />
        )}
      </div>
    </div>
  );
}

export { ONBOARDING_KEY };
