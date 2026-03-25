/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useContext,
  useState, useEffect, useMemo,
} from 'react';
import { LS, db, SB_URL, SKEY } from '../lib/constants.js';
import { alertLevel, ALERT_CFG, totalLead } from '../lib/ui.jsx';
import type { AppContextValue, Product, Supplier, Movement, Order, Plans,
              Session, EmailCfg, BrandCfg, SyncToast, EnrichedProduct, DbProduct,
              Venta, Cfe, Cobro, Cliente, Lote, Devolucion, Conteo, Ruta,
              PriceLista, PriceListItem, Transfer, PurchaseInvoice, PurchaseInvoiceItem, AuditLog } from '../types.js';

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
  const [ventas,    setVentas]    = useState<Venta[]>(() => LS.get('aryes-ventas',     []));
  const [cfes,      setCfes]      = useState<Cfe[]>(() => LS.get('aryes-cfe',          []));
  const [auditLogs,         setAuditLogs]         = useState<AuditLog[]>(() => LS.get('aryes-audit-log-v2', []));
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(() => LS.get('aryes-purchase-invoices', []));
  const [transfers,     setTransfers]     = useState<Transfer[]>(() => LS.get('aryes-transfers-v2', []));
  const [priceListas,   setPriceListas]   = useState<PriceLista[]>(() => LS.get('aryes-listas-precio-v2', []));
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>(() => LS.get('aryes-listas-precio-items', []));
  const [cobros,    setCobros]    = useState<Cobro[]>(() => LS.get('aryes-cobros',       []));
  const [clientes,  setClientes]  = useState<Cliente[]>(() => LS.get('aryes-clients',     []));
  const [lotes,     setLotes]     = useState<Lote[]>(() => LS.get('aryes-lots',          []));
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>(() => LS.get('aryes-devoluciones', []));
  const [conteos,      setConteos]      = useState<Conteo[]>(() => LS.get('aryes-conteos',        []));
  const [rutas,        setRutas]        = useState<Ruta[]>(() => LS.get('aryes-rutas',           []));
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
  useEffect(() => LS.set('aryes-ventas',     ventas),    [ventas]);
  useEffect(() => LS.set('aryes-cfe',         cfes),      [cfes]);
  useEffect(() => LS.set('aryes-audit-log-v2', auditLogs.slice(0, 500)), [auditLogs]);
  useEffect(() => LS.set('aryes-purchase-invoices', purchaseInvoices), [purchaseInvoices]);
  useEffect(() => LS.set('aryes-transfers-v2', transfers), [transfers]);
  useEffect(() => LS.set('aryes-listas-precio-v2',    priceListas),    [priceListas]);
  useEffect(() => LS.set('aryes-listas-precio-items', priceListItems), [priceListItems]);
  useEffect(() => LS.set('aryes-cobros',      cobros),    [cobros]);
  useEffect(() => LS.set('aryes-clients',     clientes),  [clientes]);
  useEffect(() => LS.set('aryes-lots',         lotes),     [lotes]);
  useEffect(() => LS.set('aryes-devoluciones', devoluciones), [devoluciones]);
  useEffect(() => LS.set('aryes-conteos',       conteos),      [conteos]);
  useEffect(() => LS.set('aryes-rutas',          rutas),        [rutas]);
  useEffect(() => LS.set('aryes9-notified',  notified),  [notified]);

  // ── JWT auto-refresh 5 min before expiry ───────────────────────────────────

// Maps DB audit_log.action → human-readable descripcion
const describeAction = (action: string, detail: string): string => {
  try {
    const d = JSON.parse(detail || '{}');
    const map: Record<string, (d: Record<string,unknown>) => string> = {
      venta:             d => `Venta ${d.nroVenta||''} · ${d.clienteNombre||''}`,
      recepcion:         d => `Recepción de ${d.proveedor||''} · ${d.items||0} items`,
      movimiento:        d => `${d.tipo||''} · ${d.productoNombre||''}`,
      devolucion:        d => `Devolución · ${d.productoNombre||''}`,
      conteo:            d => `Conteo de inventario`,
      producto_guardado: d => `Producto: ${d.nombre||d.name||''}`,
      proveedor_guardado:d => `Proveedor: ${d.nombre||''}`,
      config:            d => `Configuración actualizada`,
      login:             d => `Login de usuario`,
    };
    return (map[action]?.(d as Record<string,unknown>)) || action;
  } catch { return action; }
};

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
        if (sbVentas?.length > 0) {
          const mappedVentas: Venta[] = sbVentas.map(r => ({
            id: r.id, nroVenta: r.nro_venta, clienteId: r.cliente_id || '',
            clienteNombre: r.cliente_nombre || '', items: r.items || [],
            total: r.total || 0, descuento: r.descuento || 0, estado: r.estado || 'pendiente',
            notas: r.notas || '', fechaEntrega: r.fecha_entrega || null, creadoEn: r.creado_en,
          }));
          setVentas(mappedVentas); // ← updates AppContext state — reactive
          // LS.set is handled by the useEffect above
        }
        // Load invoices (cfes) from Supabase
        const sbInvoices = await db.get<Record<string, any>[]>('invoices?order=created_at.desc&limit=500');
        if (sbInvoices?.length > 0) {
          const mappedCfes: Cfe[] = sbInvoices.map(r => ({
            id: r.id, numero: r.numero||'', tipo: r.tipo||'', moneda: r.moneda||'UYU',
            fecha: r.fecha||'', fechaVenc: r.fecha_venc||null,
            clienteId: r.cliente_id||null, clienteNombre: r.cliente_nombre||'',
            clienteRut: r.cliente_rut||'', subtotal: r.subtotal||0,
            ivaTotal: r.iva_total||0, descuento: r.descuento||0,
            total: r.total||0, saldoPendiente: r.saldo_pendiente||0,
            status: r.status||'borrador', items: r.items||[], notas: r.notas||'',
            createdAt: r.created_at||'',
          }));
          setCfes(mappedCfes); // reactive — LS.set handled by useEffect
        }
        // Load collections (cobros) from Supabase
        const sbCollections = await db.get<Record<string, any>[]>('collections?order=created_at.desc&limit=500');
        if (sbCollections?.length > 0) {
          const mappedCobros: Cobro[] = sbCollections.map(r => ({
            id: r.id, clienteId: r.cliente_id||null, monto: r.monto||0,
            metodo: r.metodo||'', fecha: r.fecha||'', fechaCheque: r.fecha_cheque||null,
            notas: r.notas||'', facturasAplicar: r.facturas_aplicar||[],
            createdAt: r.created_at||'',
          }));
          setCobros(mappedCobros); // reactive — LS.set handled by useEffect
        }
        // Load clients from Supabase
        const sbClients = await db.get<Record<string, any>[]>('clients?order=created_at.asc&limit=2000');
        if (sbClients?.length > 0) {
          const mappedClientes: Cliente[] = sbClients.map(r => ({
            id: r.id, nombre: r.nombre||r.name||'', tipo: r.tipo||r.type||'',
            rut: r.rut||'', telefono: r.telefono||r.phone||'',
            email: r.email||'', emailFacturacion: r.email_facturacion||'',
            contacto: r.contacto||r.contact||'', direccion: r.direccion||r.address||'',
            ciudad: r.ciudad||'', condPago: r.cond_pago||'credito_30',
            limiteCredito: r.limite_credito ? String(r.limite_credito) : '',
            notas: r.notas||'', creado: r.created_at||'',
          }));
          setClientes(mappedClientes); // reactive — LS.set handled by useEffect
        }
        // Load lotes from Supabase
        const sbLotes = await db.get<Record<string, any>[]>('lotes?order=fecha_venc.asc.nullslast&limit=2000');
        if (sbLotes?.length > 0) {
          const mappedLotes: Lote[] = sbLotes.map(r => ({
            id: r.id, productoId: r.producto_id||'', productoNombre: r.producto_nombre||'',
            lote: r.lote||'', fechaVenc: r.fecha_venc||null,
            cantidad: Number(r.cantidad)||0, proveedor: r.proveedor||'',
            notas: r.notas||'', creadoEn: r.creado_en||'',
          }));
          setLotes(mappedLotes); // reactive — LS.set handled by useEffect
        }
        // Load devoluciones from Supabase
        const sbDevs = await db.get<Record<string, any>[]>('devoluciones?order=creado_en.desc&limit=500');
        if (sbDevs?.length > 0) {
          const mappedDevs: Devolucion[] = sbDevs.map(r => ({
            id: r.id, nroDevolucion: r.nro_devolucion||'', ventaId: r.venta_id||'',
            clienteNombre: r.cliente_nombre||'', motivo: r.motivo||'',
            notas: r.notas||'', items: r.items||[], estado: r.estado||'procesada',
            fecha: r.fecha||'', creadoEn: r.creado_en||'',
          }));
          setDevoluciones(mappedDevs); // reactive — LS.set handled by useEffect
        }
        // Load conteos from Supabase
        const sbConteos = await db.get<Record<string, any>[]>('conteos?order=creado_en.desc&limit=200');
        if (sbConteos?.length > 0) {
          const mappedConteos: Conteo[] = sbConteos.map(r => ({
            id: r.id, fecha: r.fecha||'', items: r.items||[],
            completado: r.completado||false, creadoEn: r.creado_en||'',
            finalizadoEn: r.finalizado_en||undefined,
          }));
          setConteos(mappedConteos); // reactive — LS.set handled by useEffect
        }
        // Load rutas from Supabase
        const sbRutas = await db.get<Record<string, any>[]>('rutas?order=creado_en.desc&limit=200');
        if (sbRutas?.length > 0) {
          const mappedRutas: Ruta[] = sbRutas.map(r => ({
            id: r.id, vehiculo: r.vehiculo||'', zona: r.zona||'',
            dia: r.dia||'', notas: r.notas||'', entregas: r.entregas||[],
            creadoEn: r.creado_en||'',
          }));
          setRutas(mappedRutas); // reactive — LS.set handled by useEffect
        }
        // Load audit log from Supabase
        const sbAudit = await db.get<Record<string, any>[]>('audit_log?order=timestamp.desc&limit=500');
        if (sbAudit && sbAudit.length > 0) {
          const mappedAudit: AuditLog[] = sbAudit.map(r => ({
            id: r.id, timestamp: r.timestamp||'', user: r.user||'sistema',
            action: r.action||'', detail: r.detail||'{}',
            fecha: r.timestamp ? new Date(r.timestamp).toLocaleString('es-UY') : '',
            usuario: r.user||'sistema',
            tipo: r.action||'',
            descripcion: describeAction(r.action||'', r.detail||'{}'),
            detalle: r.detail||'',
          }));
          setAuditLogs(mappedAudit);
        }
        // Load purchase invoices from Supabase
        const sbPI = await db.get<Record<string, any>[]>('purchase_invoices?order=creado_en.desc&limit=300');
        if (sbPI && sbPI.length > 0) {
          const mappedPI: PurchaseInvoice[] = sbPI.map(r => ({
            id: r.id, proveedorId: r.proveedor_id||'', proveedorNombre: r.proveedor_nombre||'',
            numero: r.numero||'', fecha: r.fecha||'', fechaVenc: r.fecha_venc||null,
            moneda: r.moneda||'USD', subtotal: Number(r.subtotal)||0,
            ivaTotal: Number(r.iva_total)||0, total: Number(r.total)||0,
            saldoPendiente: Number(r.saldo_pendiente)||0,
            status: r.status||'pendiente', recepcionId: r.recepcion_id||null,
            items: (r.items||[]) as PurchaseInvoiceItem[],
            notas: r.notas||'', creadoEn: r.creado_en||'',
          }));
          setPurchaseInvoices(mappedPI);
        }
        // Load transfers from Supabase
        const sbTransfers = await db.get<Record<string, any>[]>('transfers?order=creado_en.desc&limit=200');
        if (sbTransfers && sbTransfers.length > 0) {
          const mappedTransfers: Transfer[] = sbTransfers.map(r => ({
            id: r.id, productoId: r.producto_id, productoNombre: r.producto_nombre||'',
            cantidad: Number(r.cantidad)||0, origen: r.origen||'', destino: r.destino||'',
            notas: r.notas||'', fecha: r.fecha||'', creadoEn: r.creado_en||'',
          }));
          setTransfers(mappedTransfers);
        }
        // Load price lists from Supabase
        const sbPriceListas = await db.get<Record<string, any>[]>('price_lists?order=id.asc');
        if (sbPriceListas && sbPriceListas.length > 0) {
          const mappedListas: PriceLista[] = sbPriceListas.map(r => ({
            id: r.id, nombre: r.nombre||'', descuento: Number(r.descuento)||0,
            color: r.color||'#3b82f6', activa: r.activa!==false,
            creadoEn: r.creado_en||'', updatedAt: r.updated_at||'',
          }));
          setPriceListas(mappedListas);
        }
        const sbPriceItems = await db.get<Record<string, any>[]>('price_list_items?order=lista_id.asc');
        if (sbPriceItems && sbPriceItems.length > 0) {
          const mappedItems: PriceListItem[] = sbPriceItems.map(r => ({
            id: r.id, listaId: r.lista_id, productUuid: r.product_uuid,
            precio: Number(r.precio)||0, updatedAt: r.updated_at||'',
          }));
          setPriceListItems(mappedItems);
        }
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
          const mapped = prods.map(p => ({ id:p.uuid, name:p.name, barcode:p.barcode||'', supplierId:p.supplier_id||'', unit:p.unit||'kg', stock:Number(p.stock)||0, unitCost:Number(p.unit_cost)||0, precioVenta:Number(p.precio_venta)||0, minStock:Number(p.min_stock)||5, dailyUsage:Number(p.daily_usage)||0.5, category:p.category||'', brand:p.brand||'', history:p.history||[], costSource:p.cost_source||null, costUpdatedAt:p.cost_updated_at||null }));
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
      precio_venta: Number(f.precioVenta) || 0,
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
    ventas, setVentas,
    cfes, setCfes,
    cobros, setCobros,
    clientes, setClientes,
    lotes, setLotes,
    devoluciones, setDevoluciones,
    conteos, setConteos,
    rutas, setRutas,
    auditLogs, setAuditLogs,
    purchaseInvoices, setPurchaseInvoices,
    transfers, setTransfers,
    priceListas, setPriceListas,
    priceListItems, setPriceListItems,
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
