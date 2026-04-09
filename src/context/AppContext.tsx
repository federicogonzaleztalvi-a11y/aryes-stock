/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext, useContext,
  useState, useEffect, useMemo,
} from 'react';
import { LS, db, SB_URL, SKEY, getOrgId, getSession } from '../lib/constants.js';

// Multi-user filter: vendedor/repartidor only see their own data
const getUserFilter = (session: any, field: string = 'vendedor_id'): string => {
  if (!session || session.role === 'admin' || session.role === 'contador') return '';
  // Show records assigned to this user OR unassigned (null) — so new records are visible to everyone
  return `&or=(${field}.eq.${encodeURIComponent(session.email)},${field}.is.null)`;
};
import { useRealtime } from '../hooks/useRealtime.js';
import { mapDemoProducts, mapDemoClients, mapDemoSuppliers, mapDemoVentas, mapDemoCfes, mapDemoCobros, mapDemoMovements, mapDemoRutas } from './demoMapper.ts';
import { alertLevel, ALERT_CFG, totalLead } from '../lib/ui.jsx';
import type { AppContextValue, Product, Supplier, Movement, Order, Plans,
              Session, EmailCfg, BrandCfg, SyncToast, EnrichedProduct, DbProduct,
              Venta, Cfe, Cobro, Cliente, Lote, Devolucion, Conteo, Ruta,
              PriceLista, PriceListItem, Transfer, PurchaseInvoice, PurchaseInvoiceItem, AuditLog } from '../types.js';


// ─── Supabase row shapes (internal to AppContext) ─────────────────────────────
// These match the DB column names exactly. Mapped to domain types on read.
type DbClientRow    = { id: string; name: string; type: string; phone: string; email: string; address: string; ciudad: string; cond_pago: string; limite_credito: number; notes: string; activo: boolean; lista_id: string | null; lat: number | null; lng: number | null; org_id: string; };
type DbSupplierRow  = { id: string; name: string; flag: string; color: string; times: Record<string,number>; company: string; contact: string; email: string; phone: string; country: string; city: string; currency: string; payment_terms: string; payment_method: string; min_order: number; discount: number; rating: number; active: boolean; notes: string; org_id: string; };
type DbVentaRow     = { id: string; nro_venta: string; cliente_id: string; cliente_nombre: string; cliente_telefono: string; fecha: string; estado: string; items: unknown[]; total: number; descuento: number; notas: string; estado_log: unknown[]; creado_en: string; updated_at: string; tiene_devolucion: boolean; moneda: string; org_id: string; };
type DbProductRow   = { uuid: string; nombre: string; id: string; };
type DbStockRow     = { product_uuid: string; [key: string]: unknown; };

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
export function AppProvider({ session, onLogout, onSessionUpdate, children, demoState }: {
  session: Session | null;
  onLogout?: () => void;
  onSessionUpdate?: (s: Session) => void;
  children: React.ReactNode;
  demoState?: { org: any; products: any[]; clients: any[]; suppliers: any[]; ventas: any[]; rutas: any[]; deposit_zones: any[]; cfes?: any[]; cobros?: any[]; movements?: any[]; industry: string } | null;
}) {
  const isDemoMode = !!demoState;

  // ── Core data ──────────────────────────────────────────────────────────────
  const [products,  setProducts]  = useState<Product[]>([]) // SB source of truth — loaded in sync effect;

  const [suppliers, setSuppliers] = useState<Supplier[]>(DEFAULT_SUPPLIERS) // SB overrides on load;
  const [movements, setMovements] = useState<Movement[]>([]) // SB source of truth — loaded in batch-B;
  const [orders,    setOrders]    = useState<Order[]>([]); // SB source of truth — loaded in batch-C
  const [ventas,    setVentas]    = useState<Venta[]>([]) // SB source of truth — loaded in batch-A;

  const [cfes,      setCfes]      = useState<Cfe[]>([]) // SB source of truth — loaded in batch-A;
  const [auditLogs,         setAuditLogs]         = useState<AuditLog[]>([]) // SB source of truth — loaded in batch-C;
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]) // SB source of truth — loaded in batch-C;
  const [transfers,     setTransfers]     = useState<Transfer[]>([]) // SB source of truth — loaded in batch-C;
  const [priceListas,   setPriceListas]   = useState<PriceLista[]>([]) // SB source of truth — loaded in batch-C;
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]) // SB source of truth — loaded in batch-C;
  const [cobros,    setCobros]    = useState<Cobro[]>([]) // SB source of truth — loaded in batch-A;
  const [clientes,  setClientes]  = useState<Cliente[]>([]) // SB source of truth — loaded in batch-A;
  const [lotes,     setLotes]     = useState<Lote[]>([]) // SB source of truth — loaded in batch-B;
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]) // SB source of truth — loaded in batch-B;
  const [conteos,      setConteos]      = useState<Conteo[]>([]) // SB source of truth — loaded in batch-B;
  const [rutas,        setRutas]        = useState<Ruta[]>([]) // SB source of truth — loaded in batch-B;
  const [plans,     setPlans]     = useState<Plans>({}); // SB source of truth — loaded in batch-C
  const [notified,  setNotified]  = useState<Record<string, import('../types.js').AlertLevel>>(() => LS.get('aryes9-notified',  {}));

  // ── Async / UI state ───────────────────────────────────────────────────────
  const [dbReady,        setDbReady]        = useState<boolean>(!!demoState);
  const [syncStatus,     setSyncStatus]     = useState<string>('');
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const [syncToast,      setSyncToast]      = useState<SyncToast | null>(null);
  const [emailCfg,       setEmailCfg]       = useState<EmailCfg>({ serviceId:'', templateId:'', publicKey:'', toEmail:'', enabled:false });
  const [brandCfg,       setBrandCfg]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('aryes-brand') || 'null') || { name:'', logoUrl:'', color:'#1a8a3c' }; }
    catch { return { name:'', logoUrl:'', color:'#1a8a3c' }; }
  });

  // ── Persist to localStorage on every change ────────────────────────────────
  // orders: Supabase is source of truth — no LS cache needed
  // plans: Supabase is source of truth — no LS cache needed
  // ventas: sync bidireccional LS + Supabase
  // ── Demo mode: cargar datos del dataset ──────────────────────────────────
  const demoLoadedRef = React.useRef(false);
  useEffect(() => {
    if (!isDemoMode || !demoState) return;
    if (demoLoadedRef.current) return; // already loaded — prevent infinite loop
    demoLoadedRef.current = true;
    try {
      const dp = mapDemoProducts(demoState.products);
      const dc = mapDemoClients(demoState.clients);
      const ds = mapDemoSuppliers(demoState.suppliers);
      const dv = mapDemoVentas(demoState.ventas, demoState.clients, demoState.products);
      setProducts(dp); setClientes(dc); setSuppliers(ds); setVentas(dv);
      if (demoState.cfes) setCfes(mapDemoCfes(demoState.cfes, demoState.clients));
      if (demoState.cobros) setCobros(mapDemoCobros(demoState.cobros));
      if (demoState.movements) setMovements(mapDemoMovements(demoState.movements) as unknown as Movement[]);
      if (demoState.rutas) setRutas(mapDemoRutas(demoState.rutas) as unknown as Ruta[]);
      setBrandCfg({ name:demoState.org.name, logoUrl:'', color:'#1a8a3c', ownerPhone:demoState.org.ownerPhone||'', horario:demoState.org.horario||'', address:demoState.org.address||'', rut:demoState.org.rut||'' });
      setDbReady(true); setSyncStatus('demo');
      console.debug('[AppContext] Demo data loaded:', demoState.industry, dp.length, 'products');
    } catch (err) {
      console.error('[AppContext] DEMO LOAD ERROR:', err);
      setDbReady(true); // still allow render
    }
  }, [isDemoMode, demoState]);

  // clientes: loaded in batch-A (removed standalone duplicate fetch)

  // suppliers: loaded in initial sync (removed standalone duplicate fetch)
  // ventas: loaded in batch-A (removed standalone duplicate fetch)
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
    if (!session?.refresh_token || !session?.expiresAt || isDemoMode) return;
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
    if (session?.role !== 'admin' || isDemoMode) return;
    (async () => {
      try {
        const rows = await db.get<Array<{value: EmailCfg}>>(`app_config?key=eq.emailcfg&org_id=eq.${getOrgId()}`);
        if (rows?.[0]?.value) setEmailCfg(rows[0].value);
        LS.remove('aryes9-emailcfg');
        const brandRows = await db.get<Array<{value: BrandCfg}>>(`app_config?key=eq.brandcfg&org_id=eq.${getOrgId()}`);
        if (brandRows?.[0]?.value) {
          const b = brandRows[0].value;
          setBrandCfg(b);
          localStorage.setItem('aryes-brand', JSON.stringify(b));
          if (b.name) document.title = b.name + ' · Stock';
        }
      } catch { /* offline */ }
    })();
  }, [session?.role]);  

  // ── Load operational data — parallelized into 3 independent batches ────────
  // REMEDIATION: was 15 sequential awaits in one try/catch.
  // A single failure blocked all subsequent loads silently.
  // Now: 3 parallel batches, each with independent error handling.
  // A failure in one batch does not affect the others.
  useEffect(() => {
    if (!session) return;
    if (isDemoMode || (session as any)?._demo) return; // skip all Supabase fetches in demo
    (async () => {

      // ── Batch A: commercial data (critical for daily ops UI) ──────────────
      const [sbVentas, sbClients, sbCollections, sbInvoices] = await Promise.all([
        db.get<Record<string, any>[]>(`ventas?org_id=eq.${getOrgId()}${getUserFilter(session)}&order=creado_en.desc&limit=500`),
        db.get<Record<string, any>[]>(`clients?org_id=eq.${getOrgId()}${getUserFilter(session)}&order=created_at.asc&limit=2000`),
        db.get<Record<string, any>[]>(`collections?org_id=eq.${getOrgId()}&order=created_at.desc&limit=500`),
        db.get<Record<string, any>[]>(`invoices?org_id=eq.${getOrgId()}&order=created_at.desc&limit=500`),
      ]);

      try {
        if (sbVentas?.length > 0) {
          const mappedVentas: Venta[] = sbVentas.map(r => ({
            id: r.id, nroVenta: r.nro_venta, clienteId: r.cliente_id || '',
            clienteNombre: r.cliente_nombre || '', items: r.items || [],
            total: r.total || 0, descuento: r.descuento || 0, estado: r.estado || 'pendiente',
            notas: r.notas || '', fechaEntrega: r.fecha_entrega || null, creadoEn: r.creado_en,
            tieneDevolucion: r.tiene_devolucion || false,
            estadoLog: r.estado_log || [], estadoUpdatedBy: r.estado_updated_by || '',
            vendedorId: r.vendedor_id||null,
          }));
          setVentas(mappedVentas);
        }
        if (sbClients?.length > 0) {
          const mappedClientes: Cliente[] = sbClients.map(r => ({
            id: r.id, nombre: r.nombre||r.name||'', tipo: r.tipo||r.type||'',
            rut: r.rut||'', telefono: r.telefono||r.phone||'',
            email: r.email||'', emailFacturacion: r.email_facturacion||'',
            contacto: r.contacto||r.contact||'', direccion: r.direccion||r.address||'',
            ciudad: r.ciudad||'', condPago: r.cond_pago||'credito_30',
            limiteCredito: r.limite_credito ? String(r.limite_credito) : '',
            listaId: r.lista_id || null,
            horarioDesde: r.horario_desde || null,
            horarioHasta: r.horario_hasta || null,
            lat: r.lat ? Number(r.lat) : null,
            lng: r.lng ? Number(r.lng) : null,
            geocodedAt: r.geocoded_at || null,
            razonSocial: r.razon_social || '',
            celular: r.celular || '',
            pais: r.pais || 'Uruguay',
            modoEntrega: ['envio','retira','express'].includes(r.modo_entrega) ? r.modo_entrega : (r.modo_entrega ? 'otro' : 'envio'),
            modoEntregaCustom: ['envio','retira','express'].includes(r.modo_entrega) ? '' : (r.modo_entrega || ''),
            notasEntrega: r.notas_entrega || '',
            notas: r.notas||'', creado: r.created_at||'',
            vendedorId: r.vendedor_id||null,
          }));
          setClientes(mappedClientes);
        }
        if (sbCollections?.length > 0) {
          const mappedCobros: Cobro[] = sbCollections.map(r => ({
            id: r.id, clienteId: r.cliente_id||null, monto: r.monto||0,
            metodo: r.metodo||'', fecha: r.fecha||'', fechaCheque: r.fecha_cheque||null,
            notas: r.notas||'', facturasAplicar: r.facturas_aplicar||[],
            createdAt: r.created_at||'',
          }));
          setCobros(mappedCobros);
        }
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
          setCfes(mappedCfes);
        }
      } catch (e) { console.warn('[AppContext] batch-A (commercial) failed:', e); }

      // ── Batch B: operations data ─────────────────────────────────────────
      const [sbMovs, sbLotes, sbRutas, sbDevs, sbConteos] = await Promise.all([
        db.get<Record<string, any>[]>(`stock_movements?org_id=eq.${getOrgId()}&order=created_at.desc&limit=2000`),
        db.get<Record<string, any>[]>(`lotes?org_id=eq.${getOrgId()}&order=fecha_venc.asc.nullslast&limit=2000`),
        db.get<Record<string, any>[]>(`rutas?org_id=eq.${getOrgId()}${getUserFilter(session, 'repartidor_id')}&order=creado_en.desc&limit=200`),
        db.get<Record<string, any>[]>(`devoluciones?org_id=eq.${getOrgId()}&order=creado_en.desc&limit=500`),
        db.get<Record<string, any>[]>(`conteos?org_id=eq.${getOrgId()}&order=creado_en.desc&limit=200`),
      ]);

      try {
        if (sbMovs?.length > 0) {
          const mapped = sbMovs.map(r => ({ id:r.id, tipo:r.tipo, productoId:r.producto_id, productoNombre:r.producto_nombre, cantidad:r.cantidad, referencia:r.referencia, notas:r.notas, fecha:r.fecha, timestamp:r.timestamp }));
          setMovements(mapped as unknown as Movement[]); LS.set('aryes8-movements', mapped);
        }
        // Backfill removed — was causing duplicate movements when Supabase returned empty due to RLS/org_id mismatch
        if (sbLotes?.length > 0) {
          const mappedLotes: Lote[] = sbLotes.map(r => ({
            id: r.id, productoId: r.producto_id||'', productoNombre: r.producto_nombre||'',
            lote: r.lote||'', fechaVenc: r.fecha_venc||null,
            cantidad: Number(r.cantidad)||0, proveedor: r.proveedor||'',
            notas: r.notas||'', creadoEn: r.creado_en||'',
          }));
          setLotes(mappedLotes);
        }
        if (sbRutas?.length > 0) {
          const mappedRutas: Ruta[] = sbRutas.map(r => ({
            id: r.id, vehiculo: r.vehiculo||'', zona: r.zona||'',
            dia: r.dia||'', notas: r.notas||'', entregas: r.entregas||[],
            creadoEn: r.creado_en||'',
            capacidadKg:     r.capacidad_kg     ? Number(r.capacidad_kg)     : undefined,
            capacidadBultos: r.capacidad_bultos ? Number(r.capacidad_bultos) : undefined,
          }));
          setRutas(mappedRutas);
        }
        if (sbDevs?.length > 0) {
          const mappedDevs: Devolucion[] = sbDevs.map(r => ({
            id: r.id, nroDevolucion: r.nro_devolucion||'', ventaId: r.venta_id||'',
            clienteNombre: r.cliente_nombre||'', motivo: r.motivo||'',
            notas: r.notas||'', items: r.items||[], estado: r.estado||'procesada',
            fecha: r.fecha||'', creadoEn: r.creado_en||'',
          }));
          setDevoluciones(mappedDevs);
        }
        if (sbConteos?.length > 0) {
          const mappedConteos: Conteo[] = sbConteos.map(r => ({
            id: r.id, fecha: r.fecha||'', items: r.items||[],
            completado: r.completado||false, creadoEn: r.creado_en||'',
            finalizadoEn: r.finalizado_en||undefined,
          }));
          setConteos(mappedConteos);
        }
      } catch (e) { console.warn('[AppContext] batch-B (operations) failed:', e); }

      // ── Batch C: secondary data (audit, financial, pricing) ──────────────
      const [sbAudit, sbPI, sbTransfers, sbPriceListas, sbPriceItems, sbRecs] = await Promise.all([
        db.get<Record<string, any>[]>(`audit_log?org_id=eq.${getOrgId()}&order=timestamp.desc&limit=500`),
        db.get<Record<string, any>[]>(`purchase_invoices?org_id=eq.${getOrgId()}&order=creado_en.desc&limit=300`),
        db.get<Record<string, any>[]>(`transfers?org_id=eq.${getOrgId()}&order=creado_en.desc&limit=200`),
        fetch(`${SB_URL}/rest/v1/price_lists?order=creado_en.desc&org_id=eq.${getOrgId()}`, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Accept: 'application/json' } }).then(r => r.ok ? r.json() : []),
        fetch(`${SB_URL}/rest/v1/price_list_items?org_id=eq.${getOrgId()}&order=updated_at.desc`, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Accept: 'application/json' } }).then(r => r.ok ? r.json() : []),
        db.get<Record<string, any>[]>(`recepciones?org_id=eq.${getOrgId()}&order=creado_en.desc&limit=500`),
      ]);

      try {
        if (sbAudit?.length > 0) {
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
        if (sbPI?.length > 0) {
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
        if (sbTransfers?.length > 0) {
          const mappedTransfers: Transfer[] = sbTransfers.map(r => ({
            id: r.id, productoId: r.producto_id, productoNombre: r.producto_nombre||'',
            cantidad: Number(r.cantidad)||0, origen: r.origen||'', destino: r.destino||'',
            notas: r.notas||'', fecha: r.fecha||'', creadoEn: r.creado_en||'',
          }));
          setTransfers(mappedTransfers);
        }
        if (sbPriceListas?.length > 0) {
          const mappedListas: PriceLista[] = sbPriceListas.map(r => ({
            id: r.id, nombre: r.nombre||'', descuento: Number(r.descuento)||0,
            color: r.color||'#3b82f6', activa: r.activa!==false,
            creadoEn: r.creado_en||'', updatedAt: r.updated_at||'',
          }));
          setPriceListas(mappedListas);
        }
        if (sbPriceItems?.length > 0) {
          const mappedItems: PriceListItem[] = sbPriceItems.map(r => ({
            id: r.id, listaId: r.lista_id, productUuid: r.product_uuid,
            precio: Number(r.precio)||0, updatedAt: r.updated_at||'',
          }));
          setPriceListItems(mappedItems);
        }
        if (sbRecs?.length > 0) {
          LS.set('aryes-recepciones', sbRecs.map(r => ({ id:r.id, fecha:r.fecha, proveedor:r.proveedor, nroRemito:r.nro_remito, notas:r.notas, pedidoId:r.pedido_id, items:r.items, estado:r.estado, diferencias:r.diferencias, creadoEn:r.creado_en })));
        }
      } catch (e) { console.warn('[AppContext] batch-C (secondary) failed:', e); }

    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run when role changes, not on every JWT refresh
  }, [session?.role]);

  // ── Initial full sync from Supabase ───────────────────────────────────────
  useEffect(() => {
    if (!session || isDemoMode) return;
    setSyncStatus('sync');
    (async () => {
      try {
        const prods = await db.get<Record<string, any>[]>('products', `org_id=eq.${getOrgId()}&order=id.asc&limit=1000`);
        if (prods?.length > 0) {
          const mapped = prods.map(p => ({ id:p.uuid, name:p.name, barcode:p.barcode||'', supplierId:p.supplier_id||'', unit:p.unit||'kg', stock:Number(p.stock)||0, unitCost:Number(p.unit_cost)||0, precioVenta:Number(p.precio_venta)||0, imagen_url:p.imagen_url||'', descripcion:p.descripcion||'', minStock:Number(p.min_stock)||5, dailyUsage:Number(p.daily_usage)||0.5, category:p.category||'', brand:p.brand||'', history:p.history||[], costSource:p.cost_source||null, costUpdatedAt:p.cost_updated_at||null }));
          setProducts(mapped);
        }
        const sups = await db.get<Record<string, any>[]>('suppliers', `org_id=eq.${getOrgId()}&order=name.asc`);
        if (sups?.length > 0) {
          const mapped = sups.map(s => ({ id:s.id, name:s.name, flag:s.flag||'', color:s.color||'#1a8a3c', times:s.times||{preparation:2,customs:1,freight:4,warehouse:1}, company:s.company||'', contact:s.contact||'', email:s.email||'', phone:s.phone||'', country:s.country||'', city:s.city||'', currency:s.currency||'USD', paymentTerms:s.payment_terms||'30', paymentMethod:s.payment_method||'', minOrder:s.min_order||'', discount:s.discount||'0', rating:s.rating||3, active:s.active!==false, notes:s.notes||'' }));
          setSuppliers(mapped);
        }
        const usrs = await db.get<Record<string, any>[]>('users', `org_id=eq.${getOrgId()}&order=id.asc`);
        if (usrs?.length > 0) LS.set('aryes-users', usrs.map(u => ({ username:u.username, name:u.name, role:u.role, active:u.active })));
        const sbOrders = await db.get<Record<string, any>[]>('orders', `org_id=eq.${getOrgId()}&order=ordered_at.desc&limit=500`);
        if (sbOrders?.length > 0) {
          const mapped = sbOrders.map(o => ({ id:o.id, productId:o.product_id, productName:o.product_name, supplierId:o.supplier_id, supplierName:o.supplier_name, qty:Number(o.qty), unit:o.unit, status:o.status, orderedAt:o.ordered_at, expectedArrival:o.expected_arrival, totalCost:o.total_cost, leadBreakdown:o.lead_breakdown||{} }));
          setOrders(mapped);
        }
        const sbPlans = await db.get<Record<string, any>[]>('plans', `org_id=eq.${getOrgId()}`);
        if (sbPlans?.length > 0) {
          const plansMap: Record<string, unknown> = {};
          sbPlans.forEach(p => { plansMap[p.product_id] = { ...(p.data||{}), coverageMonths:Number(p.coverage_months)||2 }; });
          setPlans(plansMap as unknown as Plans);
        }
        // Cargar permissions del rol del usuario
        if (session?.role) {
          const orgId = getOrgId();
          const roleId = (session as any).roleId;
          const roleQuery = roleId
            ? `id=eq.${roleId}&org_id=eq.${orgId}&limit=1`
            : `org_id=eq.${orgId}&nombre=ilike.${encodeURIComponent(session.role)}&limit=1`;
          const roleRows = await db.get('roles', roleQuery);
          if (roleRows?.[0]?.permissions && onSessionUpdate) {
            onSessionUpdate({ ...session, permissions: roleRows[0].permissions } as any);
          }
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
    if (!session || !dbReady || isDemoMode) return;
    const syncFromServer = async () => {
      try {
        const serverProds = await db.get<Record<string, any>[]>('products', `org_id=eq.${getOrgId()}&order=id.asc&limit=1000`);
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
          setProducts(merged);
          setSyncToast({ msg: 'Datos actualizados desde otro dispositivo', type: 'info' });
          setTimeout(() => setSyncToast(null), 4000);
        }
      } catch { /* offline */ }
    };
    const pollTimer = setInterval(syncFromServer, 300000); // 5 min — Realtime handles live updates
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

  // ── Realtime sync — multi-device (Supabase Realtime) ────────────────────
  // When another device/user changes data in Supabase, these callbacks
  // update local state immediately without requiring a page reload.
  useRealtime(isDemoMode ? {} : {
    onProductChange: ({ eventType, new: row, old: oldRow }) => {
      if (!row && !oldRow) return;
      setProducts(ps => {
        if (eventType === 'INSERT') {
          if (ps.find(p => p.id === row.uuid)) return ps; // already have it
          const p = { id:row.uuid, nombre:row.nombre||row.name||'', tipo:row.tipo||row.type||'',
            rut:row.rut||'', telefono:row.telefono||row.phone||'', stock:Number(row.stock)||0,
            minStock:Number(row.min_stock)||0, unitCost:Number(row.unit_cost)||0, unit:row.unit||'',
            supplierId:row.supplier_id||'', name:row.name||row.nombre||'', brand:row.brand||'',
            category:row.category||'', precioVenta:Number(row.precio_venta)||0, imagen_url:row.imagen_url||'', descripcion:row.descripcion||'',
            dailyUsage:Number(row.daily_usage)||0, updatedAt:row.updated_at||'' };
          return [p, ...ps];
        }
        if (eventType === 'UPDATE') {
          return ps.map(p => p.id === row.uuid
            ? { ...p, stock: Number(row.stock)||0, nombre: row.nombre||row.name||p.nombre,
                unitCost: Number(row.unit_cost)||p.unitCost,
                precioVenta: Number(row.precio_venta)||p.precioVenta, imagen_url: row.imagen_url||p.imagen_url||'',
                updatedAt: row.updated_at||'' }
            : p);
        }
        if (eventType === 'DELETE') return ps.filter(p => p.id !== (oldRow?.uuid || row?.uuid));
        return ps;
      });
    },

    onVentaChange: ({ eventType, new: row, old: oldRow }) => {
      if (!row && !oldRow) return;
      setVentas(vs => {
        if (eventType === 'INSERT') {
          if (vs.find(v => v.id === row.id)) return vs;
          const v = { id:row.id, nroVenta:row.nro_venta, clienteId:row.cliente_id||'',
            clienteNombre:row.cliente_nombre||'', items:row.items||[], total:row.total||0,
            descuento:row.descuento||0, estado:row.estado||'pendiente',
            notas:row.notas||'', fechaEntrega:row.fecha_entrega||null, creadoEn:row.creado_en,
            tieneDevolucion:false, estadoLog:row.estado_log||[] };
          return [v, ...vs];
        }
        if (eventType === 'UPDATE') {
          return vs.map(v => v.id === row.id
            ? { ...v, estado: row.estado||v.estado, estadoLog: row.estado_log||v.estadoLog,
                total: Number(row.total)||v.total }
            : v);
        }
        if (eventType === 'DELETE') return vs.filter(v => v.id !== (oldRow?.id || row?.id));
        return vs;
      });
    },

    onRutaChange: ({ eventType, new: row, old: oldRow }) => {
      if (!row && !oldRow) return;
      setRutas(rs => {
        if (eventType === 'INSERT') {
          if (rs.find(r => r.id === row.id)) return rs;
          return [row, ...rs];
        }
        if (eventType === 'UPDATE') {
          // For rutas, the key field is entregas (delivery statuses)
          return rs.map(r => r.id === row.id
            ? { ...r, entregas: row.entregas || r.entregas,
                enRuta: row.en_ruta || r.enRuta,
                salidaEn: row.salida_en || r.salidaEn }
            : r);
        }
        if (eventType === 'DELETE') return rs.filter(r => r.id !== (oldRow?.id || row?.id));
        return rs;
      });
    },

    onClienteChange: ({ eventType, new: row, old: oldRow }) => {
      if (!row && !oldRow) return;
      setClientes(cs => {
        if (eventType === 'INSERT') {
          if (cs.find(c => c.id === row.id)) return cs;
          return [row, ...cs];
        }
        if (eventType === 'UPDATE') {
          return cs.map(c => c.id === row.id ? { ...c, ...row } : c);
        }
        if (eventType === 'DELETE') return cs.filter(c => c.id !== (oldRow?.id || row?.id));
        return cs;
      });
    },
  }, !!session && !isDemoMode); // only enable when logged in (disabled in demo)

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
    const notifyWriteError = (op: string, err: unknown) => {
      console.warn(`[markDelivered] ${op} failed:`, err?.message || err);
      setHasPendingSync(true);
      setSyncToast({ msg: `Error al guardar entrega en servidor. El cambio está guardado localmente — se sincronizará al reconectar.`, type: 'error' });
      setTimeout(() => setSyncToast(null), 7000);
    };
    // Sequential writes — if order patch fails, don't update stock (prevents inconsistency)
    try {
      await db.patch('orders', { status:'delivered', updated_at:now }, { id });
      await db.patchWithLock('products', { stock:newStock, updated_at:now }, `uuid=eq.${o.productId}`, 'stock', prod.stock);
    } catch (e) {
      notifyWriteError('markDelivered', e);
    }
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
      iva_rate: Number(f.iva_rate) ?? 22,
      imagen_url: (f.imagen_url || '') as string,
      descripcion: (f.descripcion || '') as string,
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

  const applyExcel = async (matches: Array<any>): Promise<void> => {
    const toCreate = matches.filter((m: any) => m.action === 'create' && !m.existing);
    const toUpdate = matches.filter((m: any) => m.action === 'update' && m.existing);

    // ── Crear productos nuevos ────────────────────────────────────────────────
    const created: any[] = [];
    for (const item of toCreate) {
      const newProd = {
        id:        crypto.randomUUID(),
        uuid:      crypto.randomUUID(),
        name:      item.name,
        barcode:   item.code || '',
        stock:     item.stock || 0,
        minStock:  0,
        unit:      item.unit || 'u',
        unitCost:  item.cost || 0,
        salePrice: item.price || 0,
        category:  item.category || '',
        supplierId:'',
        orgId:     getOrgId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      created.push(newProd);
    }

    if (created.length > 0) {
      setProducts(prev => [...created, ...prev]);
      await Promise.allSettled(
        created.map(p => db.upsert('products', {
          uuid: p.uuid, name: p.name, barcode: p.barcode,
          stock: p.stock, min_stock: p.minStock, unit: p.unit,
          unit_cost: p.unitCost, sale_price: p.salePrice,
          category: p.category, supplier_id: p.supplierId,
          org_id: getOrgId(), created_at: p.createdAt, updated_at: p.updatedAt,
        }, 'uuid'))
      );
    }

    // ── Actualizar stock de existentes ────────────────────────────────────────
    if (toUpdate.length > 0) {
      setProducts(prev => prev.map(p => {
        const m = toUpdate.find((x: any) => x.existing?.id === p.id);
        return m ? { ...p, stock: m.stock } : p;
      }));
      await Promise.allSettled(
        toUpdate.map((m: any) => db.patchWithLock(
          'products',
          { stock: m.stock, updated_at: new Date().toISOString() },
          `uuid=eq.${m.existing.id}`,
          'stock',
          m.existing.stock
        ))
      );
    }

    setSyncToast({
      msg: `Importación completa: ${created.length} creados, ${toUpdate.length} actualizados.`,
      type: 'info',
    });
    setTimeout(() => setSyncToast(null), 5000);
  };

  const sendAlertEmail = (alertProducts: Product[], cfg: EmailCfg): void => {
    const rows = (alertProducts as Product[]).map(p => `- ${p.name}: ${p.stock} ${p.unit} (mín ${p.minStock})`).join('\n');
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id:cfg.serviceId, template_id:cfg.templateId, user_id:cfg.publicKey, template_params:{ to_email:cfg.toEmail, subject:`⚠ ${alertProducts.length} producto(s) con stock crítico`, message:rows } }),
    }).catch(e => console.warn('[AppContext] sendAlertEmail:', e));
  };

  // ── Context value ─────────────────────────────────────────────────────────

  // ── Dynamic Reorder Point ─────────────────────────────────────────────────
  const calcReorderPoints = async (): Promise<any[]> => {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/calc_reorder_points`, {
        method: 'POST',
        headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`,
                   'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_org_id: getOrgId() }),
      });
      if (!r.ok) return [];
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length > 0) {
        setProducts((ps) => ps.map((p) => {
          const row = rows.find((rr: DbStockRow) => rr.product_uuid === p.uuid || rr.product_uuid === p.id);
          return row ? { ...p, minStock: Number(row.new_min_stock) || p.minStock } : p;
        }));
      }
      return rows || [];
    } catch(e) { console.warn('[calcReorderPoints]', e); return []; }
  };

  // ═══════════════════════════════════════════════════════════════
  // MODULE: VALUE ASSEMBLY — single source of truth for consumers
  // All hooks and components access data through this object via useApp()
  // ═══════════════════════════════════════════════════════════════
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
    // Dynamic reorder

  calcReorderPoints,
    // Auth
    handleLogout: () => onLogout?.(),
    session,
    // Demo
    isDemoMode,
  };


  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
