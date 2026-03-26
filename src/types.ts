// ─── Aryes domain types ───────────────────────────────────────────────────────
// Single source of truth for all data shapes used across the app.
// All .tsx files import from here. .jsx files continue to work without imports.
//
// Naming convention:
//   - Interface names match the domain entity (Product, Supplier, Order...)
//   - Supabase column names use snake_case in DB; camelCase in app
//   - DB row types are prefixed with Db* and used only in constants.ts

// ── Auth ──────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'operador' | 'vendedor';

export interface Session {
  access_token: string;
  refresh_token: string;
  expiresAt: number;        // Unix ms — used by JWT auto-refresh
  email: string;
  role: Role;
  username?: string;
  userId?: string;
}

// ── Products ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  month: string;            // "YYYY-MM"
  consumed: number;         // units consumed that month
}

export interface Product {
  id: string;               // UUID (TEXT in DB — always a string after Priority 4)
  name: string;
  barcode?: string;
  supplierId: string;       // FK → Supplier.id
  unit: string;             // "kg", "lt", "un"…
  stock: number;
  unitCost: number;         // USD
  precioVenta: number;       // precio de venta (USD)
  minStock: number;
  dailyUsage: number;       // estimated avg units/day
  category?: string;
  brand?: string;
  history: HistoryEntry[];  // monthly consumption history
  updatedAt?:      string;   // ISO 8601
  costSource?:     string;   // 'factura F-001 · proveedor' — where unitCost came from
  costUpdatedAt?:  string;   // ISO 8601 — when unitCost was last auto-updated
}

// Raw row as returned by Supabase REST before mapping in AppContext
export interface DbProduct {
  id: number;               // integer PK
  uuid: string;             // TEXT — becomes Product.id
  name: string;
  barcode: string;
  supplier_id: string;
  unit: string;
  stock: number;
  unit_cost: number;
  min_stock: number;
  daily_usage: number;
  category: string;
  brand: string;
  history: HistoryEntry[];
  updated_at: string;
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export interface LeadTimes {
  preparation: number;      // days
  customs: number;
  freight: number;
  warehouse: number;
}

export interface Supplier {
  id: string;               // "arg" | "ecu" | "eur" | "oth" | UUID for custom
  name: string;
  flag: string;             // emoji flag
  color: string;            // hex color for UI
  times: LeadTimes;
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  currency?: string;        // "USD" | "EUR"
  paymentTerms?: string;
  paymentMethod?: string;
  minOrder?: string;
  discount?: string;
  rating?: number;          // 1-5
  active?: boolean;
  notes?: string;
}

// ── Orders (purchase orders) ──────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'delivered' | 'cancelled';

export interface Order {
  id: string;               // UUID
  productId: string;        // FK → Product.id
  productName: string;
  supplierId: string;       // FK → Supplier.id
  supplierName: string;
  qty: number;
  unit: string;
  totalCost: number;        // USD
  orderedAt: string;        // ISO 8601
  expectedArrival?: string; // ISO 8601
  status: OrderStatus;
  notes?: string;
}

// ── Movements ─────────────────────────────────────────────────────────────────

export type MovementType =
  | 'delivery'
  | 'manual_in'
  | 'manual_out'
  | 'order_placed'
  | 'scanner_in'
  | 'excel_in'
  | 'excel_out'
  | 'venta';

export interface Movement {
  id: string;               // UUID
  type: MovementType;
  productId: string;
  productName: string;
  supplierId?: string;
  supplierName?: string;
  qty: number;
  unit: string;
  stockAfter: number;
  note?: string;
  timestamp: string;        // ISO 8601
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AlertLevel = 'order_now' | 'order_soon' | 'watch' | 'ok';

export interface AlertResult {
  level: AlertLevel;
  daysToROP: number | null;
  rop: number | null;
}

export interface AlertCfgEntry {
  label: string;
  dot: string;              // hex color
  bg: string;
  bd: string;
  txt: string;
  pri: number;              // 0-3, higher = more urgent
}

export type AlertCfg = Record<AlertLevel, AlertCfgEntry>;

// ── Plans ─────────────────────────────────────────────────────────────────────

export interface PlanEntry {
  qty: number;
  month: string;            // "YYYY-MM"
  note?: string;
}

export type Plans = Record<string, PlanEntry>; // key = productId

// ── Enriched product (with derived alert data) ────────────────────────────────

export interface EnrichedProduct extends Product {
  alert: AlertResult;
  sup: Supplier | undefined;
}

// ── Email / Brand config ──────────────────────────────────────────────────────

export interface EmailCfg {
  serviceId: string;
  templateId: string;
  publicKey: string;
  toEmail: string;
  enabled: boolean;
}

export interface BrandCfg {
  name: string;
  logoUrl: string;
  color: string;
}

// ── Sync / UI state ───────────────────────────────────────────────────────────

export interface SyncToast {
  msg: string;
  type: 'error' | 'success' | 'info';
}

// ── AppContext value ───────────────────────────────────────────────────────────
// Every value returned by useApp() is typed here.
// This is the interface a top engineer reads to understand what the app can do.

// ── Ruta de reparto ──────────────────────────────────────────────────────────
export interface RutaEntrega {
  clienteId:     string;
  clienteNombre: string;
  ciudad:        string;
  telefono:      string;
  estado:        'pendiente' | 'entregado' | 'no_entregado';
  hora:          string;
  nota:          string;
  foto:          string;
}

export interface Ruta {
  id:       string;
  vehiculo: string;
  zona:     string;
  dia:      string;
  notas:    string;
  entregas: RutaEntrega[];
  creadoEn: string;
  updatedAt?: string;
}

// ── Conteo / Inventario físico ───────────────────────────────────────────────
export interface ConteoItem {
  id:           string;   // productoId
  nombre:       string;
  stockSistema: number;
  unidad:       string;
  cantFisica:   number | null;
  diferencia:   number | null;
}

export interface Conteo {
  id:           string;
  fecha:        string;
  items:        ConteoItem[];
  completado:   boolean;
  creadoEn:     string;
  finalizadoEn?: string;
}

// ── Devolucion ───────────────────────────────────────────────────────────────
export interface DevolucionItem {
  productoId:   string;
  nombre:       string;
  cantidad:     number;
  unidad:       string;
  cantDevolver: number;
  inspeccion:   'aprobado' | 'rechazado' | 'pendiente' | '';
  estado:       string;
}

export interface Devolucion {
  id:             string;
  nroDevolucion:  string;
  ventaId:        string;
  clienteNombre:  string;
  motivo:         string;
  notas:          string;
  items:          DevolucionItem[];
  estado:         string;
  fecha:          string;
  creadoEn:       string;
}

// ── Lote / Vencimiento ───────────────────────────────────────────────────────
export interface Lote {
  id:             string;
  productoId:     string;
  productoNombre: string;
  lote:           string;
  fechaVenc:      string | null;
  cantidad:       number;
  proveedor:      string;
  notas:          string;
  creadoEn:       string;
  updatedAt?:     string;
}

// ── Cliente ──────────────────────────────────────────────────────────────────
export interface Cliente {
  id:               string;
  nombre:           string;
  tipo:             string;
  rut:              string;
  telefono:         string;
  email:            string;
  emailFacturacion: string;
  contacto:         string;
  direccion:        string;
  ciudad:           string;
  condPago:         string;
  limiteCredito:    string;
  listaId:          string | null;  // FK → PriceLista.id
  lat:              number | null;   // geocoded latitude
  lng:              number | null;   // geocoded longitude
  geocodedAt:       string | null;   // ISO — when geocoding ran
  notas:            string;
  creado:           string;
}

// ── Facturación (CFE / Cobro) ─────────────────────────────────────────────────
export interface Cfe {
  id:             string;
  numero:         string;
  tipo:           string;
  moneda:         string;
  fecha:          string;
  fechaVenc:      string | null;
  clienteId:      string | null;
  clienteNombre:  string;
  clienteRut:     string;
  subtotal:       number;
  ivaTotal:       number;
  descuento:      number;
  total:          number;
  saldoPendiente: number;
  status:         string;
  items:          unknown[];
  notas:          string;
  createdAt:      string;
}

export interface Cobro {
  id:              string;
  clienteId:       string | null;
  monto:           number;
  metodo:          string;
  fecha:           string;
  fechaCheque:     string | null;
  notas:           string;
  facturasAplicar: string[];
  createdAt:       string;
}

// ── Venta ────────────────────────────────────────────────────────────────────
export interface VentaItem {
  productoId: string;
  nombre:     string;
  cantidad:   number;
  unidad:     string;
  precioUnit: number;
  costoUnit?: number;        // cost snapshot at time of sale (for margin)
  loteId?:    string;        // FK → Lote.id — traceability
  loteNro?:   string;        // snapshot of lote number at time of sale
}

export interface Venta {
  id:             string;
  nroVenta:       string;
  clienteId:      string;
  clienteNombre:  string;
  items:          VentaItem[];
  total:          number;
  descuento:      number;
  estado:         'pendiente' | 'confirmada' | 'preparada' | 'entregada' | 'cancelada';
  notas:          string;
  fechaEntrega:   string | null;
  creadoEn:       string;
  updatedAt?:     string;
}


export interface Transfer {
  id:             string;
  productoId:     string;
  productoNombre: string;
  cantidad:       number;
  origen:         string;
  destino:        string;
  notas:          string;
  fecha:          string;   // localeDateString es-UY
  creadoEn:       string;   // ISO 8601
}

export interface PriceLista {
  id:        string;          // 'A' | 'B' | 'C' | UUID
  nombre:    string;
  descuento: number;          // global % off precioVenta
  color:     string;          // hex
  activa:    boolean;
  creadoEn:  string;
  updatedAt: string;
}

export interface PriceListItem {
  id:          string;        // UUID
  listaId:     string;        // FK → PriceLista.id
  productUuid: string;        // FK → Product.id
  precio:      number;        // 0 = use global discount
  updatedAt:   string;
}
export interface PurchaseInvoiceItem {
  productoId:   string;    // FK → Product.id (optional — can be free-text)
  nombre:       string;    // product name at time of purchase
  cantidad:     number;
  unidad:       string;
  precioUnit:   number;    // unit cost in invoice currency
  subtotal:     number;    // cantidad * precioUnit
}

export type PurchaseInvoiceStatus = 'pendiente' | 'pagada' | 'pagada_parcial' | 'vencida';

export interface PurchaseInvoice {
  id:               string;
  proveedorId:      string;
  proveedorNombre:  string;
  numero:           string;      // invoice number from supplier
  fecha:            string;      // ISO date
  fechaVenc:        string|null; // payment due date
  moneda:           string;      // 'USD' | 'UYU' | 'EUR'
  subtotal:         number;
  ivaTotal:         number;
  total:            number;
  saldoPendiente:   number;
  status:           PurchaseInvoiceStatus;
  recepcionId:      string|null; // FK → recepciones (optional link)
  items:            PurchaseInvoiceItem[];
  notas:            string;
  creadoEn:         string;
}

export interface AuditLog {
  id:          string;
  timestamp:   string;   // ISO 8601 — from DB
  user:        string;   // email or username
  action:      string;   // 'venta', 'recepcion', 'movimiento', 'producto_guardado', etc.
  detail:      string;   // JSON string with action-specific data
  // Derived fields for display (computed from DB fields)
  fecha?:      string;
  usuario?:    string;
  tipo?:       string;
  descripcion?:string;
  detalle?:    string;
}

export interface AppContextValue {
  // ── Core data ──────────────────────────────────────────────────────────────
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ventas:    Venta[];
  setVentas: React.Dispatch<React.SetStateAction<Venta[]>>;
  cfes:      Cfe[];
  setCfes:   React.Dispatch<React.SetStateAction<Cfe[]>>;
  cobros:    Cobro[];
  setCobros: React.Dispatch<React.SetStateAction<Cobro[]>>;
  clientes:    Cliente[];
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  lotes:       Lote[];
  setLotes:    React.Dispatch<React.SetStateAction<Lote[]>>;
  devoluciones:    Devolucion[];
  setDevoluciones: React.Dispatch<React.SetStateAction<Devolucion[]>>;
  conteos:         Conteo[];
  setConteos:      React.Dispatch<React.SetStateAction<Conteo[]>>;
  rutas:           Ruta[];
  setRutas:        React.Dispatch<React.SetStateAction<Ruta[]>>;
  auditLogs:           AuditLog[];
  setAuditLogs:        React.Dispatch<React.SetStateAction<AuditLog[]>>;
  purchaseInvoices:    PurchaseInvoice[];
  setPurchaseInvoices: React.Dispatch<React.SetStateAction<PurchaseInvoice[]>>;
  transfers:        Transfer[];
  setTransfers:     React.Dispatch<React.SetStateAction<Transfer[]>>;
  priceListas:      PriceLista[];
  setPriceListas:   React.Dispatch<React.SetStateAction<PriceLista[]>>;
  priceListItems:   PriceListItem[];
  setPriceListItems:React.Dispatch<React.SetStateAction<PriceListItem[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  movements: Movement[];
  setMovements: React.Dispatch<React.SetStateAction<Movement[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  plans: Plans;
  setPlans: React.Dispatch<React.SetStateAction<Plans>>;
  notified: Record<string, AlertLevel>;
  setNotified: React.Dispatch<React.SetStateAction<Record<string, AlertLevel>>>;

  // ── Config ─────────────────────────────────────────────────────────────────
  emailCfg: EmailCfg;
  setEmailCfg: React.Dispatch<React.SetStateAction<EmailCfg>>;
  brandCfg: BrandCfg;
  setBrandCfg: React.Dispatch<React.SetStateAction<BrandCfg>>;

  // ── Sync state ─────────────────────────────────────────────────────────────
  dbReady: boolean;
  syncStatus: string;
  hasPendingSync: boolean;
  setHasPendingSync: React.Dispatch<React.SetStateAction<boolean>>;
  syncToast: SyncToast | null;
  setSyncToast: React.Dispatch<React.SetStateAction<SyncToast | null>>;

  // ── Derived ────────────────────────────────────────────────────────────────
  enriched: EnrichedProduct[];
  alerts: EnrichedProduct[];         // products with level !== 'ok'
  critN: number;                     // count of order_now products
  getSup: (id: string) => Supplier | undefined;

  // ── Mutations ──────────────────────────────────────────────────────────────
  addMov: (mov: Omit<Movement, 'id' | 'timestamp'>) => void;
  savePlan: (productId: string, entry: PlanEntry) => void;
  markDelivered: (orderId: string) => Promise<void>;
  confirmOrder: (order: Omit<Order, 'id' | 'orderedAt' | 'status'>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<{ ok: true } | { error: string }>;
  saveProduct: (formData: Record<string, unknown>, isEdit: boolean, id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  applyExcel: (matches: Array<{ product: Product; newStock: number }>) => Promise<void>;
  sendAlertEmail: (alertProducts: Product[], cfg: EmailCfg) => void;
  dbWriteWithRetry: <T>(fn: () => Promise<T>) => Promise<T | null>;

  // ── Auth ───────────────────────────────────────────────────────────────────
  handleLogout: () => void;
  session:      Session | null;
}
