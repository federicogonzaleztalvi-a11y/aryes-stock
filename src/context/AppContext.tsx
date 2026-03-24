/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useContext,
  useState, useEffect, useMemo,
} from 'react';
import { LS, db, SB_URL, SKEY } from '../lib/constants.js';
import { alertLevel, ALERT_CFG, totalLead } from '../lib/ui.jsx';
import type { AppContextValue, Product, Supplier, Movement, Order, Plans,
              Session, EmailCfg, BrandCfg, SyncToast, EnrichedProduct, DbProduct } from '../types.js';

// ─── Default suppliers (self-contained, no App.jsx dep) ──────────────────────
const DEFAULT_SUPPLIERS = [
  { id:'arg', name:'Argentina / Brasil', flag:'🇦🇷', color:'#2980b9', times:{preparation:2,customs:1,freight:4,warehouse:1}, company:'', contact:'', email:'', phone:'', country:'Argentina', city:'Buenos Aires', currency:'USD', paymentTerms:'30', paymentMethod:'', minOrder:'', discount:'0', rating:4, active:true, notes:'' },
  { id:'ecu', name:'Ecuador',            flag:'🇪🇨', color:'#27ae60', times:{preparation:2,customs:3,freight:6,warehouse:2}, company:'', contact:'', email:'', phone:'', country:'Ecuador',   city:'Guayaquil',   currency:'USD', paymentTerms:'30', paymentMethod:'', minOrder:'', discount:'0', rating:3, active:true, notes:'' },
  { id:'eur', name:'Europa',             flag:'🇪🇺', color:'#8e44ad', times:{preparation:5,customs:7,freight:20,warehouse:3}, company:'', contact:'', email:'', phone:'', country:'Italia',    city:'Milano',      currency:'EUR', paymentTerms:'60', paymentMethod:'', minOrder:'', discount:'0', rating:5, active:true, notes:'' },
  { id:'oth', name:'Otros',              flag:'🌐', color:'#7f8c8d', times:{preparation:2,customs:0,freight:3,warehouse:1},  company:'', contact:'', email:'', phone:'', country:'',          city:'',            currency:'USD', paymentTerms:'30', paymentMethod:'', minOrder:'', discount:'0', rating:3, active:true, notes:'' },
];

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ session, onLogout, onSessionUpdate, children }: {
  session: Session | null;
  onLogout?: () => void;
  onSessionUpdate?: (s: Session) => void;
  children: React.ReactNode;
}) {

  // ── Core data ──────────────────────────────────────────────────────────────
  const [products,  setProducts]  = useState<Product[]>(() => LS.get('aryes6-products',  []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => LS.get('aryes6-suppliers', DEFAULT_SUPPLIERS));
  const [movements, setMovements] = useState<Movement[]>(() => LS.get('aryes8-movements', []));
  const [orders,    setOrders]    = useState<Order[]>(() => LS.get('aryes6-orders',    []));
  const [plans,     setPlans]     = useState<Plans>(() => LS.get('aryes7-plans',     {}));
  const [notified,  setNotified]  = useState<Record<string, import('../types.js').AlertLevel>>(() => LS.get('aryes9-notified',  {}));

  // ── Async / UI state ───────────────────────────────────────────────────────
  const [dbReady,        setDbReady]        = useState<boolean>(false);
  const [syncStatus,     setSyncStatus]     = useState<string>('');
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const [syncToast,      setSyncToast]      = useState<SyncToast | null>(null);
  const [emailCfg,       setEmailCfg]       = useState<EmailCfg>({ serviceId:'', templateId:'', publicKey:'', toEmail:'', enabled:false });
  const [brandCfg,       setBrandCfg]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('aryes-brand') || 'null') || { name:'', logoUrl:'', color:'#3a7d1e' }; }
    catch { return { name:'', logoUrl:'', color:'#3a7d1e' }; }
  });

  // ── Persist to localStorage on every change ────────────────────────────────
  useEffect(() => LS.set('aryes6-products',  products),  [products]);
  useEffect(() => LS.set('aryes6-suppliers', suppliers), [suppliers]);
  useEffect(() => LS.set('aryes6-orders',    orders),    [orders]);
  useEffect(() => LS.set('aryes7-plans',     plans),     [plans]);
  useEffect(() => LS.set('aryes8-movements', movements), [movements]);
  useEffect(() => LS.set('aryes9-notified',  notified),  [notified]);

  // ── JWT auto-refresh 5 min before expiry ───────────────────────────────────
  useEffect(() => {
    if (!session?.refresh_token || !session?.expiresAt) return;
    const refreshIn = Math.max(0, session.expiresAt - Date.now() - 5 * 60 * 1000);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'apikey': SKEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
          const refreshed = { ...session, access_token: data.access_token, refresh_token: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
          LS.set('aryes-session', refreshed);
          onSessionUpdate?.(refreshed);
        } else { LS.remove('aryes-session'); onLogout?.(); }
      } catch (e) { console.warn('[AppContext] token refresh failed', e); }
    }, refreshIn);
    return () => clearTimeout(timer);
  }, [session?.refresh_token, session?.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load config from Supabase (admin only) ─────────────────────────────────
  useEffect(() => {
    if (session?.role !== 'admin') return;
    (async () => {
      try {
        const rows = await db.get<Array<{value: EmailCfg}>>('app_config?key=eq.emailcfg');
        if (rows?.[0]?.value) setEmailCfg(rows[0].value);
        LS.remove('aryes9-emailcfg');
        const brandRows = await db.get<Array<{value: BrandCfg}>>('app_config?key=eq.brandcfg');
        if (brandRows?.[0]?.value) {
          const b = brandRows[0].value;
          setBrandCfg(b);
          localStorage.setItem('aryes-brand', JSON.stringify(b));
          if (b.name) document.title = b.name + ' · Stock';
        }
      } catch { /* offline */ }
    })();
  }, [session?.role]);  

  // ── Load operational data (movements, ventas, recepciones) ────────────────
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const sbMovs = await db.get<Record<string, any>[]>('stock_movements?order=timestamp.desc&limit=2000');
        if (sbMovs?.length > 0) {
          const mapped = sbMovs.map(r => ({ id:r.id, tipo:r.tipo, productoId:r.producto_id, productoNombre:r.producto_nombre, cantidad:r.cantidad, referencia:r.referencia, notas:r.notas, fecha:r.fecha, timestamp:r.timestamp }));
          setMovements(mapped as unknown as Movement[]); LS.set('aryes8-movements', mapped);
        } else {
          const lsMovs = LS.get<any[]>('aryes8-movements', []);
          if (lsMovs.length > 0 && session.role !== 'vendedor') {
            const rows = lsMovs.map(m => ({ id:m.id, tipo:m.tipo, producto_id:m.productoId, producto_nombre:m.productoNombre, cantidad:m.cantidad, referencia:m.referencia, notas:m.notas, fecha:m.fecha, timestamp:m.timestamp || new Date().toISOString() }));
            db.insertMany('stock_movements', rows).catch(e => console.warn('[AppContext] movement backfill failed:', e?.message || e));
          }
        }
        const sbVentas = await db.get<Record<string, any>[]>('ventas?order=creado_en.desc&limit=500');
        if (sbVentas?.length > 0) LS.set('aryes-ventas', sbVentas.map(r => ({ id:r.id, nroVenta:r.nro_venta, clienteId:r.cliente_id, clienteNombre:r.cliente_nombre, items:r.items, total:r.total, descuento:r.descuento, estado:r.estado, notas:r.notas, fechaEntrega:r.fecha_entrega, creadoEn:r.creado_en })));
        const sbRecs = await db.get<Record<string, any>[]>('recepciones?order=creado_en.desc&limit=500');
        if (sbRecs?.length > 0) LS.set('aryes-recepciones', sbRecs.map(r => ({ id:r.id, fecha:r.fecha, proveedor:r.proveedor, nroRemito:r.nro_remito, notas:r.notas, pedidoId:r.pedido_id, items:r.items, estado:r.estado, diferencias:r.diferencias, creadoEn:r.creado_en })));
      } catch (e) { console.warn('[AppContext] operational load failed', e); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run when role changes, not on every JWT refresh
  }, [session?.role]);

  // ── Initial full sync from Supabase ───────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    setSyncStatus('sync');
    (async () => {
      try {
        const prods = await db.get<Record<string, any>[]>('products', 'order=id.asc&limit=1000');
        if (prods?.length > 0) {
          const mapped = prods.map(p => ({ id:p.uuid, name:p.name, barcode:p.barcode||'', supplierId:p.supplier_id||'', unit:p.unit||'kg', stock:Number(p.stock)||0, unitCost:Number(p.unit_cost)||0, minStock:Number(p.min_stock)||5, dailyUsage:Number(p.daily_usage)||0.5, category:p.category||'', brand:p.brand||'', history:p.history||[] }));
          LS.set('aryes6-products', mapped); setProducts(mapped);
        }
        const sups = await db.get<Record<string, any>[]>('suppliers', 'order=name.asc');
        if (sups?.length > 0) {
          const mapped = sups.map(s => ({ id:s.id, name:s.name, flag:s.flag||'', color:s.color||'#3a7d1e', times:s.times||{preparation:2,customs:1,freight:4,warehouse:1}, company:s.company||'', contact:s.contact||'', email:s.email||'', phone:s.phone||'', country:s.country||'', city:s.city||'', currency:s.currency||'USD', paymentTerms:s.payment_terms||'30', paymentMethod:s.payment_method||'', minOrder:s.min_order||'', discount:s.discount||'0', rating:s.rating||3, active:s.active!==false, notes:s.notes||'' }));
          LS.set('aryes6-suppliers', mapped); setSuppliers(mapped);
        }
        const usrs = await db.get<Record<string, any>[]>('users', 'order=id.asc');
        if (usrs?.length > 0) LS.set('aryes-users', usrs.map(u => ({ username:u.username, name:u.name, role:u.role, active:u.active })));
        const sbOrders = await db.get<Record<string, any>[]>('orders', 'order=ordered_at.desc&limit=500');
        if (sbOrders?.length > 0) {
          const mapped = sbOrders.map(o => ({ id:o.id, productId:o.product_id, productName:o.product_name, supplierId:o.supplier_id, supplierName:o.supplier_name, qty:Number(o.qty), unit:o.unit, status:o.status, orderedAt:o.ordered_at, expectedArrival:o.expected_arrival, totalCost:o.total_cost, leadBreakdown:o.lead_breakdown||{} }));
          setOrders(mapped); LS.set('aryes6-orders', mapped);
        }
        const sbPlans = await db.get<Record<string, any>[]>('plans');
        if (sbPlans?.length > 0) {
          const plansMap: Record<string, unknown> = {};
          sbPlans.forEach(p => { plansMap[p.product_id] = { ...(p.data||{}), coverageMonths:Number(p.coverage_months)||2 }; });
          setPlans(plansMap as unknown as Plans); LS.set('aryes7-plans', plansMap);
        }
        setDbReady(true); setSyncStatus('ok'); setTimeout(() => setSyncStatus(''), 3000);
      } catch (e) {
        console.warn('[AppContext] Supabase offline:', e);
        setDbReady(true); setSyncStatus('error'); setTimeout(() => setSyncStatus(''), 4000);
      }
    })();
  }, [session]);

  // ── Multi-device conflict detection ───────────────────────────────────────
  useEffect(() => {
    if (!session || !dbReady) return;
    const syncFromServer = async () => {
      try {
        const serverProds = await db.get<Record<string, any>[]>('products', 'order=id.asc&limit=1000');
        if (!serverProds?.length) return;
        const serverMap: Record<string, Record<string, any>> = {};
        serverProds.forEach(p => { serverMap[p.uuid] = p; });
        let hasChanges = false;
        const merged = products.map(local => {
          const server = serverMap[local.id];
          if (!server) return local;
          const serverStock = Number(server.stock) || 0;
          if (serverStock !== local.stock) { hasChanges = true; return { ...local, stock: serverStock }; }
          return local;
        });
        if (hasChanges) {
          setProducts(merged); LS.set('aryes6-products', merged);
          setSyncToast({ msg: 'Datos actualizados desde otro dispositivo', type: 'info' });
          setTimeout(() => setSyncToast(null), 4000);
        }
      } catch { /* offline */ }
    };
    const pollTimer = setInterval(syncFromServer, 30000);
    const onFocus = () => syncFromServer();
    const onVisible = () => { if (document.visibilityState === 'visible') syncFromServer(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, dbReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Retry wrapper ─────────────────────────────────────────────────────────
  const dbWriteWithRetry = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    for (let i = 0; i <= 3; i++) {
      try { const r = await fn(); if (r !== null) { setHasPendingSync(false); return r; } } catch { /* retry */ }
      if (i < 3) await new Promise(r => setTimeout(r, [500, 1000, 2000][i]));
    }
    setHasPendingSync(true); return null;
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const getSup = (id: string): Supplier | undefined => suppliers.find(s => s.id === id);

  const enriched = useMemo(() =>
    (products || []).map(p => { const sup = getSup(p.supplierId); return { ...p, sup, alert: alertLevel(p, sup) }; }),
    [products, suppliers] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const alerts = (enriched || [])
    .filter(p => p.alert.level !== 'ok')
    .sort((a, b) => ALERT_CFG[b.alert.level as import('../types.js').AlertLevel].pri - ALERT_CFG[a.alert.level as import('../types.js').AlertLevel].pri);

  const critN = alerts.filter(p => p.alert.level === 'order_now').length;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMov = (m: Omit<Movement, 'id' | 'timestamp'>) => {
    const mov = { ...m, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setMovements((ms: Movement[]) => [mov as Movement, ...ms]);
    db.insert('stock_movements', {
      id:mov.id, product_id:mov.productId||null, product_name:mov.productName||null,
      type:mov.type||'manual', qty:Number(mov.qty)||0, unit:mov.unit||'', note:mov.note||'',
      timestamp:mov.timestamp, tipo:mov.type||'manual', producto_id:mov.productId||null,
      producto_nombre:mov.productName||null, cantidad:Number(mov.qty)||0,
      referencia:mov.productName||null, notas:mov.note||'',
      fecha:mov.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
    }).catch(e => console.warn('[addMov] insert failed (non-critical):', e?.message || e));
  };

  const savePlan = async (productId: string, planData: Record<string, unknown>) => {
    setPlans((p: Plans) => ({ ...p, [productId]: planData as unknown as import('../types.js').PlanEntry }));
    try {
      await db.upsert('plans', { product_id:productId, coverage_months:Number(planData.coverageMonths)||2, data:planData, updated_at:new Date().toISOString() });
    } catch (e) { console.warn('[AppContext] savePlan:', e); setHasPendingSync(true); }
  };

  const markDelivered = async (id: string): Promise<void> => {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const prod = products.find(p => p.id === o.productId);
    if (!prod) return;
    const newStock = (prod.stock || 0) + (o.qty || 0);
    const now = new Date().toISOString();
    setOrders(os => os.map(x => x.id === id ? { ...x, status: 'delivered' } : x));
    setProducts(ps => ps.map(p => p.id === o.productId ? { ...p, stock: newStock, updatedAt: now } : p));
    addMov({ type:'delivery', stockAfter:newStock, productId:o.productId, productName:o.productName, qty:o.qty, unit:o.unit, note:'Entrega pedido' });
    // Both writes are critical — stock and order status must persist to DB.
    // On failure: optimistic UI stays (data is in localStorage) but we surface
    // a visible error so the operator knows to check connectivity.
    const notifyWriteError = (op: string, err: any) => {
      console.warn(`[markDelivered] ${op} failed:`, err?.message || err);
      setHasPendingSync(true);
      setSyncToast({ msg: `Error al guardar entrega en servidor. El cambio está guardado localmente — se sincronizará al reconectar.`, type: 'error' });
      setTimeout(() => setSyncToast(null), 7000);
    };
    db.patch('orders', { status:'delivered', updated_at:now }, { id })
      .catch(e => notifyWriteError('orders.patch', e));
    db.patchWithLock('products', { stock:newStock, updated_at:now }, `uuid=eq.${o.productId}`, 'stock', prod.stock)
      .catch(e => notifyWriteError('products.patchWithLock', e));
  };

  const confirmOrder = async (product: Product, qty: number): Promise<void> => {
    const sup = getSup(product.supplierId);
    const lead = totalLead(sup);
    const arrival = new Date(); arrival.setDate(arrival.getDate() + lead);
    const o = { id:crypto.randomUUID(), productId:product.id, productName:product.name, supplierId:product.supplierId, supplierName:sup?.name, qty, unit:product.unit, orderedAt:new Date().toISOString(), expectedArrival:arrival.toISOString(), status:'pending', totalCost:(qty*(product.unitCost||0)).toFixed(2), leadBreakdown:{...sup?.times} };
    setOrders((os: Order[]) => [o as unknown as Order, ...os]);
    addMov({ type:'order_placed', stockAfter:product.stock, productId:product.id, productName:product.name, qty, unit:product.unit, note:`Pedido a ${sup?.name}` });
    db.upsert('orders', { id:o.id, product_id:o.productId, product_name:o.productName, supplier_id:o.supplierId, supplier_name:o.supplierName, qty:o.qty, unit:o.unit, status:o.status, ordered_at:o.orderedAt, expected_arrival:o.expectedArrival, total_cost:o.totalCost, lead_breakdown:o.leadBreakdown }, 'id')
      .catch(e => {
        console.warn('[confirmOrder] upsert failed:', e?.message || e);
        setHasPendingSync(true);
        setSyncToast({ msg: 'Error al guardar pedido en servidor. Guardado localmente — se sincronizará al reconectar.', type: 'error' });
        setTimeout(() => setSyncToast(null), 7000);
      });
  };

  // Note: callers must confirm before calling these — no window.confirm here.
  const deleteSupplier = async (id: string): Promise<{ ok: true } | { error: string }> => {
    if (products.some(p => p.supplierId === id)) {
      // Return error string so caller can show it via proper UI
      return { error: 'No se puede eliminar: hay productos asociados a este proveedor.' };
    }
    const snap = suppliers;
    setSuppliers(ss => ss.filter(s => s.id !== id));
    db.del('suppliers', { id }).catch(() => setSuppliers(snap));
    return { ok: true };
  };

  const saveProduct = async (
    f: Record<string, unknown>,
    isEdit: boolean,
    id: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const productData = {
      uuid: id,
      name: (f.name || f.nombre || '') as string,
      barcode: (f.barcode || '') as string,
      supplier_id: (f.supplierId || '') as string,
      unit: (f.unit || 'kg') as string,
      stock: Number(f.stock) || 0,
      unit_cost: Number(f.unitCost) || 0,
      min_stock: Number(f.minStock) || 5,
      daily_usage: Number(f.dailyUsage) || 0.5,
      category: (f.category || '') as string,
      brand: (f.brand || '') as string,
      history: (f.history || []) as unknown[],
      updated_at: now,
    };
    // Optimistic update
    if (isEdit) setProducts(ps => ps.map(p => p.id === id ? { ...p, ...(f as Partial<Product>) } : p));
    else setProducts(ps => [...ps, { ...(f as unknown as Product), id }]);
    // Persist to Supabase
    try {
      await db.upsert('products', productData, 'uuid');
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[saveProduct] SB failed:', msg);
      setSyncToast({ msg: 'Error al guardar producto. Guardado localmente — se sincronizará al reconectar.', type: 'error' });
      setTimeout(() => setSyncToast(null), 6000);
      setHasPendingSync(true);
    }
    // Audit log (non-critical)
    try {
      await db.insert('audit_log', {
        id: crypto.randomUUID(), timestamp: now,
        user: (() => { try { return JSON.parse(localStorage.getItem('aryes-session') || 'null')?.email || 'unknown'; } catch { return 'unknown'; } })(),
        action: 'producto_guardado',
        detail: JSON.stringify({ isEdit, id, nombre: productData.name, stock: productData.stock }),
      });
    } catch { /* non-critical */ }
  };

  const deleteProduct = async (id: string): Promise<void> => {
    const snap = products;
    setProducts(ps => ps.filter(p => p.id !== id));
    db.del('products', { uuid: id }).catch(() => setProducts(snap));
  };

  const applyExcel = async (matches: Array<{ product: Product; newStock: number }>): Promise<void> => {
    const excelProds = products.map(p => { const m = matches.find((x) => x.product.id === p.id); return m ? { ...p, stock: m.newStock } : p; });
    setProducts(excelProds);
    const results = await Promise.allSettled(
      matches.map(m => db.patchWithLock(
        'products',
        { stock:m.newStock, updated_at:new Date().toISOString() },
        `uuid=eq.${m.product.id}`,
        'stock',
        m.product.stock
      ))
    );
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[applyExcel] ${failed.length}/${matches.length} writes failed:`,
        failed.map(r => r.reason?.message).join(', '));
      setHasPendingSync(true);
      setSyncToast({
        msg: `${failed.length} producto(s) no se pudieron sincronizar. Guardados localmente — se sincronizarán al reconectar.`,
        type: 'error',
      });
      setTimeout(() => setSyncToast(null), 8000);
    }
  };

  const sendAlertEmail = (alertProducts: Product[], cfg: EmailCfg): void => {
    const rows = (alertProducts as Product[]).map(p => `- ${p.name}: ${p.stock} ${p.unit} (mín ${p.minStock})`).join('\n');
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id:cfg.serviceId, template_id:cfg.templateId, user_id:cfg.publicKey, template_params:{ to_email:cfg.toEmail, subject:`⚠ ${alertProducts.length} producto(s) con stock crítico`, message:rows } }),
    }).catch(e => console.warn('[AppContext] sendAlertEmail:', e));
  };

  // ── Context value ─────────────────────────────────────────────────────────
  const value: AppContextValue = {
    // Data
    products, setProducts,
    suppliers, setSuppliers,
    movements, setMovements,
    orders, setOrders,
    plans, setPlans,
    notified, setNotified,
    // Config
    emailCfg, setEmailCfg,
    brandCfg, setBrandCfg,
    // Sync
    dbReady, syncStatus, hasPendingSync, setHasPendingSync, setSyncToast, syncToast,
    // Derived
    enriched: enriched as unknown as EnrichedProduct[], alerts: alerts as unknown as EnrichedProduct[], critN, getSup,
    // Mutations
    saveProduct,
    addMov: addMov as AppContextValue['addMov'], savePlan: savePlan as unknown as AppContextValue['savePlan'], markDelivered, confirmOrder: confirmOrder as unknown as AppContextValue['confirmOrder'],
    deleteSupplier, deleteProduct, applyExcel,
    sendAlertEmail, dbWriteWithRetry,
    // Auth
    handleLogout: () => onLogout?.(),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
