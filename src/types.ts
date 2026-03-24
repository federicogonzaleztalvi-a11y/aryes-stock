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
  minStock: number;
  dailyUsage: number;       // estimated avg units/day
  category?: string;
  brand?: string;
  history: HistoryEntry[];  // monthly consumption history
  updatedAt?: string;       // ISO 8601
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

// ── Venta ────────────────────────────────────────────────────────────────────
export interface VentaItem {
  productoId: string;
  nombre:     string;
  cantidad:   number;
  unidad:     string;
  precioUnit: number;
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

export interface AppContextValue {
  // ── Core data ──────────────────────────────────────────────────────────────
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ventas:    Venta[];
  setVentas: React.Dispatch<React.SetStateAction<Venta[]>>;
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
}
