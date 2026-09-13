export type Rank = 'Neo' | 'Ambassador' | 'Excellence' | 'Signature';

export type ClientType = 'DIRECT AKF' | 'PARTENAIRE';

export type OrderStatus = 'En attente' | 'Confirmée' | 'Terminée' | 'Livrée' | 'Annulée';

export type CommissionStatus = 'En attente' | 'Validée' | 'Payée' | 'Non éligible' | 'Annulée';

export type ProductCategory = 'PREMIUM' | 'RÉCURRENT';

export type PaymentMethod = 'Mobile Money (MTN / Moov)' | 'Virement Bancaire' | 'Espèces' | 'Chèque';

export type PaymentStatus = 'Effectué' | 'En attente' | 'Rejeté';

export type SyncStatus = 'SYNCHRONISE' | 'EN_ATTENTE' | 'ERREUR';

export type DiagnosticStatus = 'OK' | 'WARNING' | 'ERROR';

export type LogActionType =
  | 'CREATE_PARTNER'
  | 'UPDATE_PARTNER'
  | 'CREATE_CLIENT'
  | 'UPDATE_CLIENT'
  | 'DELETE_CLIENT'
  | 'CREATE_ORDER'
  | 'UPDATE_ORDER'
  | 'DELETE_ORDER'
  | 'CREATE_PAYMENT'
  | 'UPDATE_PAYMENT'
  | 'GRADE_CHANGE'
  | 'SYNC'
  | 'RECALCUL'
  | 'ERROR'
  | 'AI_ANALYZE'
  | 'AI_VALIDATION'
  | 'AI_ANALYZE_CURRENT';

export interface Partner {
  id: string; // AKF001
  code: string; // AKF-001
  fullName: string;
  phone: string;
  phoneCanonical: string;
  whatsapp?: string;
  rank: Rank;
  wave: string; // 'Vague 1'
  status: 'Actif' | 'Inactif';
  createdAt: string;
  ca: number; // Chiffre d'affaires cumulé
  clientCount: number;
  orderCount: number;
  totalCommission: number; // Total commissions générées
  validatedCommission: number; // Commissions validées
  paidCommission: number; // Commissions déjà payées
  balance: number; // Solde disponible = validatedCommission - paidCommission
  progressPct: number; // 0 à 100 vers le prochain grade
  nextRank: Rank | null;
  targetCaNextRank: number;
  targetCmdNextRank: number;
  potentialRank?: Rank; // Grade maximal théorique atteint par les critères
  eligibleForPromotion?: boolean; // Éligibilité atteinte pour passage au grade supérieur
  commissionRate?: number; // Taux de commission de référence (ex: 0.06 pour Neo)
}

export interface Client {
  id: string; // CL001
  fullName: string;
  phone: string;
  phoneCanonical: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  notes?: string;
  partnerId: string | null; // null si DIRECT AKF
  partnerCode: string | null;
  partnerName: string | null;
  clientType: ClientType;
  orderCount: number;
  totalCa: number;
  lastOrderDate?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  isPremium: boolean;
  category: string;
  commissionNeo?: number;
  commissionAmbassador?: number;
  commissionExcellence?: number;
  commissionSignature?: number;
  commissionType?: 'Pourcentage' | 'Forfaitaire' | string;
  conditions?: string;
}

export interface Order {
  id: string; // CMD001
  date: string;
  clientId: string;
  clientName: string;
  partnerId: string | null;
  partnerCode: string | null;
  partnerName: string | null;
  partnerRankAtOrder: Rank | null;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isPremium: boolean;
  premiumRankForClient: number | null; // 1, 2, 3 ou null
  commissionRate: number; // e.g. 0.08
  commissionAmount: number;
  orderStatus: OrderStatus;
  commissionStatus: CommissionStatus;
  createdAt: string;
}

export interface Payment {
  id: string; // PAY001
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference: string;
  note?: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface WaveConfig {
  wave: string;
  ambassadorCmd: number;
  ambassadorCa: number;
  excellenceCmd: number;
  excellenceCa: number;
  signatureCmd: number;
  signatureCa: number;
  active: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  user: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

export interface DiagnosticResult {
  overallStatus: 'OK' | 'AVERTISSEMENT' | 'ERREUR';
  timestamp: string;
  checks: {
    id: string;
    name: string;
    category?: string;
    status: 'OK' | 'AVERTISSEMENT' | 'ERREUR' | 'WARNING' | 'ERROR';
    message?: string;
    details?: string | string[];
    value?: string | number;
  }[];
  summary?: {
    ok: number;
    warning: number;
    error: number;
  };
}

export interface SystemConfig {
  commissionRates?: Record<Rank, number>; // e.g. { Neo: 6, Ambassador: 8, Excellence: 10, Signature: 12 }
  ranks?: {
    name: Rank;
    minCa: number;
    minOrders: number;
    commissionRate: number;
  }[];
  minimumPayment: number; // 5000 FCFA
  premiumCommissionMaxOrders?: number; // 3
  maxPremiumOrdersForCommission?: number; // 3
  activeWave?: string;
  waves?: WaveConfig[];
  autoSync?: boolean;
  version?: string;
  lastUpdated?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  user: string;
  actionType: LogActionType;
  description: string;
  oldValue: string;
  newValue: string;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: string;
  status: DiagnosticStatus;
  details: string | string[];
  message?: string;
  value?: string | number;
}

export interface RecalculReport {
  timestamp: string;
  processedCount: {
    partners: number;
    clients: number;
    orders: number;
    payments: number;
  };
  correctedCount: number;
  anomalies: string[];
  errors: string[];
}

export interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  pendingCount: number;
  errorCount?: number;
  errors: string[];
}

export interface SearchResultItem {
  type: 'PARTNER' | 'CLIENT' | 'ORDER' | 'PAYMENT';
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  details: string;
  entityId: string;
}

// --- PHASE 4 : TYPES GOOGLE SHEETS & SOURCE DE DONNÉES ---

export type DataSourceMode = 'MOCK' | 'SHEETS_READONLY' | 'SHEETS_LIVE';

export interface SheetTabInfo {
  name: string;
  found: boolean;
  rowCount: number;
  headerValid: boolean;
  expectedHeaders: string[];
  actualHeaders: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  isSpecialStructure?: boolean;
  specialStructureNote?: string;
}

export interface SheetsInspectionResult {
  connected: boolean;
  spreadsheetId: string;
  title: string;
  spreadsheetUrl?: string;
  mode: DataSourceMode;
  userEmail?: string;
  sheetsFound: string[];
  tabs: SheetTabInfo[];
  allTabsConform: boolean;
  totalRows: number;
  lastCheck: string;
  appsScriptDetected: boolean;
  appsScriptNotes: string[];
  errors: string[];
  warnings: string[];
  summary: {
    partnersCount: number;
    clientsCount: number;
    ordersCount: number;
    paymentsCount: number;
    productsCount: number;
    wavesCount: number;
  };
}

export interface CommissionGridItem {
  product: string;
  price: number;
  neo: number;
  ambassador: number;
  excellence: number;
  signature: number;
  type: 'Pourcentage' | 'Forfaitaire';
  conditions: string;
  category: 'PREMIUM' | 'RÉCURRENT' | string;
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}
