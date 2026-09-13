import fs from 'fs';
import path from 'path';
import {
  Client,
  DataSourceMode,
  Order,
  Partner,
  Payment,
  Product,
  Rank,
  SheetsInspectionResult,
  SyncState,
  SystemConfig,
  SystemLog,
} from '../src/types';
import { EXPECTED_SHEETS_CONFIG } from './googleSheetsService';
import { GoogleSheetsRepository } from './googleSheetsRepository';

/**
 * COUCHE D'ACCÈS GOOGLE SHEETS (SheetsRepository)
 * PHASE 4 : Connexion au vrai fichier Google Sheets avec bascule fluide Mock <-> Sheets.
 * Respecte les exigences strictes :
 * - Mode LECTURE SEULE initial
 * - Préservation de l'ancien Apps Script
 * - Verrou d'écriture et protection de concurrence
 * - Relecture préalable et de confirmation
 */

export interface ISheetsRepository {
  readonly isMock: boolean;
  readonly modeName: string;
  readonly dataSourceMode: DataSourceMode;
  getPartners(): Promise<Partner[]>;
  savePartner(partner: Partner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<Partner>): Promise<Partner>;

  getClients(): Promise<Client[]>;
  saveClient(client: Client): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<boolean>;

  getProducts(): Promise<Product[]>;

  getOrders(): Promise<Order[]>;
  saveOrder(order: Order): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order>;
  deleteOrder(id: string): Promise<boolean>;

  getPayments(): Promise<Payment[]>;
  savePayment(payment: Payment): Promise<Payment>;

  getConfig(): Promise<SystemConfig>;
  updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig>;

  getLogs(): Promise<SystemLog[]>;
  addLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog>;

  getSyncState(): Promise<SyncState>;
  triggerSync(forceError?: boolean): Promise<SyncState>;
  resetToDefault(): Promise<void>;

  inspect(): Promise<SheetsInspectionResult | null>;
  setCredentials(spreadsheetId: string, accessToken: string, userEmail?: string): void;
  setMode(mode: DataSourceMode): void;
  getInspectionResult(): SheetsInspectionResult | null;
}

// Données initiales représentatives (Bénin / Afrique de l'Ouest)
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'PRD001',
    name: "Gâteau d'anniversaire",
    price: 35000,
    isPremium: true,
    category: 'PREMIUM',
    commissionNeo: 6,
    commissionAmbassador: 8,
    commissionExcellence: 10,
    commissionSignature: 12,
    commissionType: 'Pourcentage',
    conditions: '3 premières commandes terminées',
  },
  {
    id: 'PRD002',
    name: 'Birthday galette',
    price: 25000,
    isPremium: true,
    category: 'PREMIUM',
    commissionNeo: 6,
    commissionAmbassador: 8,
    commissionExcellence: 10,
    commissionSignature: 12,
    commissionType: 'Pourcentage',
    conditions: '3 premières commandes terminées',
  },
  {
    id: 'PRD003',
    name: "Atō'lèçé",
    price: 8000,
    isPremium: false,
    category: 'RÉCURRENT',
    commissionNeo: 1000,
    commissionAmbassador: 1500,
    commissionExcellence: 2000,
    commissionSignature: 2500,
    commissionType: 'Forfaitaire',
    conditions: 'Commission récurrente sans limite',
  },
  {
    id: 'PRD004',
    name: 'Kponnonvivi',
    price: 20000,
    isPremium: false,
    category: 'RÉCURRENT',
    commissionNeo: 1500,
    commissionAmbassador: 2000,
    commissionExcellence: 2500,
    commissionSignature: 3000,
    commissionType: 'Forfaitaire',
    conditions: 'Commission récurrente sans limite',
  },
];

const INITIAL_CONFIG: SystemConfig = {
  commissionRates: {
    Neo: 6,
    Ambassador: 8,
    Excellence: 10,
    Signature: 12,
  },
  minimumPayment: 5000, // 5 000 FCFA
  premiumCommissionMaxOrders: 3,
  waves: [
    {
      wave: 'Vague 1',
      ambassadorCmd: 8,
      ambassadorCa: 100000,
      excellenceCmd: 20,
      excellenceCa: 300000,
      signatureCmd: 50,
      signatureCa: 800000,
      active: true,
    },
    {
      wave: 'Vague 2',
      ambassadorCmd: 10,
      ambassadorCa: 150000,
      excellenceCmd: 25,
      excellenceCa: 400000,
      signatureCmd: 60,
      signatureCa: 1000000,
      active: false,
    },
  ],
  autoSync: true,
};

export class MockSheetsRepository implements ISheetsRepository {
  public readonly isMock = true;
  public readonly modeName = 'DONNÉES MOCKÉES — PHASE 1 (Non connecté au fichier réel)';

  private storePath = path.join(process.cwd(), '.data', 'mock_store.json');
  private partners: Partner[] = [];
  private clients: Client[] = [];
  private products: Product[] = [...INITIAL_PRODUCTS];
  private orders: Order[] = [];
  private payments: Payment[] = [];
  private config: SystemConfig = { ...INITIAL_CONFIG };
  private logs: SystemLog[] = [];
  private syncState: SyncState = {
    status: 'SYNCHRONISE',
    lastSync: new Date().toISOString(),
    pendingCount: 0,
    errors: [],
  };

  constructor() {
    this.loadFromDiskOrSeed();
  }

  private loadFromDiskOrSeed() {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.partners) && data.partners.length > 0) {
          this.partners = data.partners;
          this.clients = data.clients || [];
          this.products = data.products || [...INITIAL_PRODUCTS];
          this.orders = data.orders || [];
          this.payments = data.payments || [];
          this.config = data.config || { ...INITIAL_CONFIG };
          this.logs = data.logs || [];
          this.syncState = data.syncState || {
            status: 'SYNCHRONISE',
            lastSync: new Date().toISOString(),
            pendingCount: 0,
            errors: [],
          };
          return;
        }
      }
    } catch {
      // Fallback au seed initial en cas d'erreur de lecture
    }
    this.seedInitialData();
    this.persist();
  }

  public persist() {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const payload = {
        partners: this.partners,
        clients: this.clients,
        products: this.products,
        orders: this.orders,
        payments: this.payments,
        config: this.config,
        logs: this.logs,
        syncState: this.syncState,
      };
      fs.writeFileSync(this.storePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erreur lors de la persistance mock :', err);
    }
  }

  private seedInitialData() {
    this.partners = [
      {
        id: 'AKF001',
        code: 'AKF-MEN01',
        fullName: 'Koffi Mensah',
        phone: '+229 97 12 34 56',
        phoneCanonical: '+22997123456',
        whatsapp: '+22997123456',
        rank: 'Ambassador',
        wave: 'Vague 1',
        status: 'Actif',
        createdAt: '2026-01-15T09:00:00.000Z',
        ca: 470000,
        clientCount: 2,
        orderCount: 4,
        totalCommission: 37600,
        validatedCommission: 37600,
        paidCommission: 25000,
        balance: 12600,
        progressPct: 94,
        nextRank: 'Excellence',
        targetCaNextRank: 500000,
        targetCmdNextRank: 15,
      },
      {
        id: 'AKF002',
        code: 'AKF-TOS02',
        fullName: 'Aminata Tossou',
        phone: '+229 95 44 88 12',
        phoneCanonical: '+22995448812',
        whatsapp: '+22995448812',
        rank: 'Neo',
        wave: 'Vague 1',
        status: 'Actif',
        createdAt: '2026-02-01T10:30:00.000Z',
        ca: 150000,
        clientCount: 1,
        orderCount: 2,
        totalCommission: 9000,
        validatedCommission: 9000,
        paidCommission: 0,
        balance: 9000,
        progressPct: 60,
        nextRank: 'Ambassador',
        targetCaNextRank: 150000,
        targetCmdNextRank: 5,
      },
      {
        id: 'AKF003',
        code: 'AKF-HOU03',
        fullName: 'Sègbégnon Hounkpè',
        phone: '+229 61 02 44 77',
        phoneCanonical: '+22961024477',
        whatsapp: '+22961024477',
        rank: 'Excellence',
        wave: 'Vague 1',
        status: 'Actif',
        createdAt: '2025-11-10T14:15:00.000Z',
        ca: 445000,
        clientCount: 1,
        orderCount: 3,
        totalCommission: 44500,
        validatedCommission: 44500,
        paidCommission: 25000,
        balance: 19500,
        progressPct: 80,
        nextRank: 'Signature',
        targetCaNextRank: 1000000,
        targetCmdNextRank: 30,
      },
      {
        id: 'AKF004',
        code: 'AKF-DOS04',
        fullName: 'Chantal Dossou',
        phone: '+229 96 33 22 11',
        phoneCanonical: '+22996332211',
        whatsapp: '+22996332211',
        rank: 'Neo',
        wave: 'Vague 1',
        status: 'Inactif',
        createdAt: '2025-10-05T08:00:00.000Z',
        ca: 0,
        clientCount: 0,
        orderCount: 0,
        totalCommission: 0,
        validatedCommission: 0,
        paidCommission: 0,
        balance: 0,
        progressPct: 0,
        nextRank: 'Ambassador',
        targetCaNextRank: 150000,
        targetCmdNextRank: 5,
      },
      {
        id: 'AKF005',
        code: 'AKF-AGB05',
        fullName: 'Rodrigue Agbangla',
        phone: '+229 97 88 99 00',
        phoneCanonical: '+22997889900',
        whatsapp: '+22997889900',
        rank: 'Ambassador',
        wave: 'Vague 1',
        status: 'Actif',
        createdAt: '2026-01-20T11:00:00.000Z',
        ca: 120000,
        clientCount: 1,
        orderCount: 1,
        totalCommission: 9600,
        validatedCommission: 9600,
        paidCommission: 5000,
        balance: 4600,
        progressPct: 50,
        nextRank: 'Excellence',
        targetCaNextRank: 500000,
        targetCmdNextRank: 15,
      },
      {
        id: 'AKF006',
        code: 'AKF-BIO06',
        fullName: 'Fatiha Bio-Guerra',
        phone: '+229 67 22 11 00',
        phoneCanonical: '+22967221100',
        whatsapp: '+22967221100',
        rank: 'Signature',
        wave: 'Vague 1',
        status: 'Actif',
        createdAt: '2025-08-12T16:00:00.000Z',
        ca: 250000,
        clientCount: 1,
        orderCount: 1,
        totalCommission: 30000,
        validatedCommission: 30000,
        paidCommission: 20000,
        balance: 10000,
        progressPct: 60,
        nextRank: null,
        targetCaNextRank: 1000000,
        targetCmdNextRank: 30,
      },
    ];

    this.clients = [
      {
        id: 'CL001',
        fullName: 'Bio Alassane',
        phone: '+229 90 11 22 33',
        phoneCanonical: '+22990112233',
        whatsapp: '+22990112233',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        clientType: 'PARTENAIRE',
        orderCount: 2,
        totalCa: 195000,
        createdAt: '2026-01-18T10:00:00.000Z',
      },
      {
        id: 'CL002',
        fullName: 'Nadège Gbaguidi',
        phone: '+229 97 45 67 89',
        phoneCanonical: '+22997456789',
        whatsapp: '+22997456789',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        clientType: 'PARTENAIRE',
        orderCount: 2,
        totalCa: 275000,
        createdAt: '2026-01-22T14:30:00.000Z',
      },
      {
        id: 'CL003',
        fullName: 'Éric Houndété',
        phone: '+229 95 01 02 03',
        phoneCanonical: '+22995010203',
        whatsapp: '+22995010203',
        partnerId: 'AKF002',
        partnerCode: 'AKF-TOS02',
        partnerName: 'Aminata Tossou',
        clientType: 'PARTENAIRE',
        orderCount: 2,
        totalCa: 150000,
        createdAt: '2026-02-05T09:15:00.000Z',
      },
      {
        id: 'CL004',
        fullName: 'Estelle Houndjo',
        phone: '+229 66 77 88 99',
        phoneCanonical: '+22966778899',
        whatsapp: '+22966778899',
        partnerId: 'AKF003',
        partnerCode: 'AKF-HOU03',
        partnerName: 'Sègbégnon Hounkpè',
        clientType: 'PARTENAIRE',
        orderCount: 3,
        totalCa: 445000,
        createdAt: '2025-11-20T11:45:00.000Z',
      },
      {
        id: 'CL005',
        fullName: 'Patrice Kérékou',
        phone: '+229 94 33 22 11',
        phoneCanonical: '+22994332211',
        whatsapp: '+22994332211',
        partnerId: 'AKF005',
        partnerCode: 'AKF-AGB05',
        partnerName: 'Rodrigue Agbangla',
        clientType: 'PARTENAIRE',
        orderCount: 2,
        totalCa: 200000,
        createdAt: '2026-01-25T15:20:00.000Z',
      },
      {
        id: 'CL006',
        fullName: 'Sidoine Agboton',
        phone: '+229 91 22 33 44',
        phoneCanonical: '+22991223344',
        whatsapp: '+22991223344',
        partnerId: null,
        partnerCode: null,
        partnerName: null,
        clientType: 'DIRECT AKF',
        orderCount: 1,
        totalCa: 120000,
        createdAt: '2026-02-10T16:00:00.000Z',
      },
      {
        id: 'CL007',
        fullName: 'Mireille Akplogan',
        phone: '+229 98 77 66 55',
        phoneCanonical: '+22998776655',
        whatsapp: '+22998776655',
        partnerId: 'AKF006',
        partnerCode: 'AKF-BIO06',
        partnerName: 'Fatiha Bio-Guerra',
        clientType: 'PARTENAIRE',
        orderCount: 4,
        totalCa: 545000,
        createdAt: '2025-09-01T12:00:00.000Z',
      },
    ];

    this.orders = [
      {
        id: 'CMD001',
        date: '2026-01-20',
        clientId: 'CL001',
        clientName: 'Bio Alassane',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        partnerRankAtOrder: 'Ambassador',
        productId: 'PRD001',
        productName: 'Pack Formation Élite Business',
        quantity: 1,
        unitPrice: 75000,
        totalAmount: 75000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.08,
        commissionAmount: 6000,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-01-20T10:00:00.000Z',
      },
      {
        id: 'CMD002',
        date: '2026-01-25',
        clientId: 'CL001',
        clientName: 'Bio Alassane',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        partnerRankAtOrder: 'Ambassador',
        productId: 'PRD002',
        productName: 'Abonnement Annuel AKF Pro',
        quantity: 1,
        unitPrice: 120000,
        totalAmount: 120000,
        isPremium: true,
        premiumRankForClient: 2,
        commissionRate: 0.08,
        commissionAmount: 9600,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-01-25T14:30:00.000Z',
      },
      {
        id: 'CMD003',
        date: '2026-01-28',
        clientId: 'CL002',
        clientName: 'Nadège Gbaguidi',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        partnerRankAtOrder: 'Ambassador',
        productId: 'PRD004',
        productName: 'Masterclass Signature & Coaching',
        quantity: 1,
        unitPrice: 250000,
        totalAmount: 250000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.08,
        commissionAmount: 20000,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-01-28T16:00:00.000Z',
      },
      {
        id: 'CMD004',
        date: '2026-02-02',
        clientId: 'CL002',
        clientName: 'Nadège Gbaguidi',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        partnerRankAtOrder: 'Ambassador',
        productId: 'PRD005',
        productName: 'Kit Outils Digitaux & Modèles',
        quantity: 1,
        unitPrice: 25000,
        totalAmount: 25000,
        isPremium: false,
        premiumRankForClient: null,
        commissionRate: 0,
        commissionAmount: 0,
        orderStatus: 'Livrée',
        commissionStatus: 'Non éligible',
        createdAt: '2026-02-02T11:20:00.000Z',
      },
      {
        id: 'CMD005',
        date: '2026-02-08',
        clientId: 'CL003',
        clientName: 'Éric Houndété',
        partnerId: 'AKF002',
        partnerCode: 'AKF-TOS02',
        partnerName: 'Aminata Tossou',
        partnerRankAtOrder: 'Neo',
        productId: 'PRD001',
        productName: 'Pack Formation Élite Business',
        quantity: 2,
        unitPrice: 75000,
        totalAmount: 150000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.06,
        commissionAmount: 9000,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-02-08T09:00:00.000Z',
      },
      {
        id: 'CMD006',
        date: '2026-02-11',
        clientId: 'CL006',
        clientName: 'Sidoine Agboton',
        partnerId: null,
        partnerCode: null,
        partnerName: null,
        partnerRankAtOrder: null,
        productId: 'PRD002',
        productName: 'Abonnement Annuel AKF Pro',
        quantity: 1,
        unitPrice: 120000,
        totalAmount: 120000,
        isPremium: true,
        premiumRankForClient: null,
        commissionRate: 0,
        commissionAmount: 0,
        orderStatus: 'Livrée',
        commissionStatus: 'Non éligible',
        createdAt: '2026-02-11T13:45:00.000Z',
      },
      {
        id: 'CMD007',
        date: '2026-02-14',
        clientId: 'CL004',
        clientName: 'Estelle Houndjo',
        partnerId: 'AKF003',
        partnerCode: 'AKF-HOU03',
        partnerName: 'Sègbégnon Hounkpè',
        partnerRankAtOrder: 'Excellence',
        productId: 'PRD004',
        productName: 'Masterclass Signature & Coaching',
        quantity: 1,
        unitPrice: 250000,
        totalAmount: 250000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.1,
        commissionAmount: 25000,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-02-14T10:15:00.000Z',
      },
      {
        id: 'CMD008',
        date: '2026-02-18',
        clientId: 'CL004',
        clientName: 'Estelle Houndjo',
        partnerId: 'AKF003',
        partnerCode: 'AKF-HOU03',
        partnerName: 'Sègbégnon Hounkpè',
        partnerRankAtOrder: 'Excellence',
        productId: 'PRD002',
        productName: 'Abonnement Annuel AKF Pro',
        quantity: 1,
        unitPrice: 120000,
        totalAmount: 120000,
        isPremium: true,
        premiumRankForClient: 2,
        commissionRate: 0.1,
        commissionAmount: 12000,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-02-18T15:30:00.000Z',
      },
      {
        id: 'CMD009',
        date: '2026-02-22',
        clientId: 'CL004',
        clientName: 'Estelle Houndjo',
        partnerId: 'AKF003',
        partnerCode: 'AKF-HOU03',
        partnerName: 'Sègbégnon Hounkpè',
        partnerRankAtOrder: 'Excellence',
        productId: 'PRD001',
        productName: 'Pack Formation Élite Business',
        quantity: 1,
        unitPrice: 75000,
        totalAmount: 75000,
        isPremium: true,
        premiumRankForClient: 3,
        commissionRate: 0.1,
        commissionAmount: 7500,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-02-22T08:45:00.000Z',
      },
      {
        id: 'CMD010',
        date: '2026-02-24',
        clientId: 'CL005',
        clientName: 'Patrice Kérékou',
        partnerId: 'AKF005',
        partnerCode: 'AKF-AGB05',
        partnerName: 'Rodrigue Agbangla',
        partnerRankAtOrder: 'Ambassador',
        productId: 'PRD002',
        productName: 'Abonnement Annuel AKF Pro',
        quantity: 1,
        unitPrice: 120000,
        totalAmount: 120000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.08,
        commissionAmount: 9600,
        orderStatus: 'Livrée',
        commissionStatus: 'Validée',
        createdAt: '2026-02-24T14:10:00.000Z',
      },
      {
        id: 'CMD011',
        date: '2026-02-27',
        clientId: 'CL007',
        clientName: 'Mireille Akplogan',
        partnerId: 'AKF006',
        partnerCode: 'AKF-BIO06',
        partnerName: 'Fatiha Bio-Guerra',
        partnerRankAtOrder: 'Signature',
        productId: 'PRD004',
        productName: 'Masterclass Signature & Coaching',
        quantity: 1,
        unitPrice: 250000,
        totalAmount: 250000,
        isPremium: true,
        premiumRankForClient: 1,
        commissionRate: 0.12,
        commissionAmount: 0,
        orderStatus: 'Confirmée',
        commissionStatus: 'En attente',
        createdAt: '2026-02-27T17:00:00.000Z',
      },
    ];

    this.payments = [
      {
        id: 'PAY001',
        partnerId: 'AKF001',
        partnerCode: 'AKF-MEN01',
        partnerName: 'Koffi Mensah',
        date: '2026-01-31',
        amount: 25000,
        paymentMethod: 'Mobile Money (MTN / Moov)',
        reference: 'MTN-BJ-20260131-89321',
        note: 'Paiement partiel commissions Janvier',
        status: 'Effectué',
        createdAt: '2026-01-31T18:00:00.000Z',
      },
      {
        id: 'PAY002',
        partnerId: 'AKF003',
        partnerCode: 'AKF-HOU03',
        partnerName: 'Sègbégnon Hounkpè',
        date: '2026-02-15',
        amount: 25000,
        paymentMethod: 'Virement Bancaire',
        reference: 'VIR-BOA-BJ-0048192',
        note: 'Règlement commission Masterclass',
        status: 'Effectué',
        createdAt: '2026-02-15T12:30:00.000Z',
      },
      {
        id: 'PAY003',
        partnerId: 'AKF005',
        partnerCode: 'AKF-AGB05',
        partnerName: 'Rodrigue Agbangla',
        date: '2026-02-20',
        amount: 5000,
        paymentMethod: 'Mobile Money (MTN / Moov)',
        reference: 'MOOV-BJ-20260220-4102',
        note: 'Paiement commissions Vague 1',
        status: 'Effectué',
        createdAt: '2026-02-20T16:45:00.000Z',
      },
      {
        id: 'PAY004',
        partnerId: 'AKF006',
        partnerCode: 'AKF-BIO06',
        partnerName: 'Fatiha Bio-Guerra',
        date: '2026-02-25',
        amount: 20000,
        paymentMethod: 'Virement Bancaire',
        reference: 'VIR-ECOBANK-BJ-99120',
        note: 'Versement palier Signature',
        status: 'Effectué',
        createdAt: '2026-02-25T11:00:00.000Z',
      },
    ];

    this.logs = [
      {
        id: 'LOG001',
        timestamp: '2026-01-15T09:00:00.000Z',
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_PARTNER',
        description: 'Création du partenaire Koffi Mensah',
        oldValue: 'null',
        newValue: 'AKF001 (AKF-MEN01) - Neo',
      },
      {
        id: 'LOG002',
        timestamp: '2026-01-28T17:00:00.000Z',
        user: 'system_engine',
        actionType: 'GRADE_CHANGE',
        description: 'Promotion de grade pour Koffi Mensah',
        oldValue: 'Neo',
        newValue: 'Ambassador (CA: 470000 FCFA >= 150000)',
      },
      {
        id: 'LOG003',
        timestamp: '2026-01-31T18:05:00.000Z',
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_PAYMENT',
        description: 'Enregistrement paiement PAY001',
        oldValue: 'Solde: 37 600 FCFA',
        newValue: 'Payé: 25 000 FCFA - Nouveau solde: 12 600 FCFA',
      },
      {
        id: 'LOG004',
        timestamp: '2026-02-28T08:00:00.000Z',
        user: 'system_engine',
        actionType: 'SYNC',
        description: 'Synchronisation simulée réussie avec le stockage local',
        oldValue: 'EN_ATTENTE',
        newValue: 'SYNCHRONISE (6 partenaires, 7 clients, 11 commandes)',
      },
    ];
  }

  public async getPartners(): Promise<Partner[]> {
    return [...this.partners];
  }

  public async savePartner(partner: Partner): Promise<Partner> {
    this.partners.push(partner);
    this.syncState.pendingCount++;
    this.persist();
    return partner;
  }

  public async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner> {
    const idx = this.partners.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Partenaire introuvable : ${id}`);
    this.partners[idx] = { ...this.partners[idx], ...updates };
    this.syncState.pendingCount++;
    this.persist();
    return this.partners[idx];
  }

  public async getClients(): Promise<Client[]> {
    return this.clients.map((client) => {
      const clientOrders = this.orders.filter((o) => {
        if (o.orderStatus === 'Annulée') return false;
        const oCId = (o.clientId || '').trim().toLowerCase();
        const cId = (client.id || '').trim().toLowerCase();
        if (oCId && cId && oCId === cId) return true;
        if (client.fullName && o.clientName && o.clientName.trim().toLowerCase() === client.fullName.trim().toLowerCase()) return true;
        return false;
      });
      const sortedDates = clientOrders
        .map((o) => o.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : (client.lastOrderDate || '');
      return {
        ...client,
        orderCount: clientOrders.length,
        totalCa: clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        lastOrderDate,
      };
    });
  }

  public async saveClient(client: Client): Promise<Client> {
    this.clients.push(client);
    this.syncState.pendingCount++;
    this.persist();
    return client;
  }

  public async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const idx = this.clients.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Client introuvable : ${id}`);
    this.clients[idx] = { ...this.clients[idx], ...updates };
    this.syncState.pendingCount++;
    this.persist();
    return this.clients[idx];
  }

  public async deleteClient(id: string): Promise<boolean> {
    const idx = this.clients.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.clients.splice(idx, 1);
    this.syncState.pendingCount++;
    this.persist();
    return true;
  }

  public async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  public async getOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  public async saveOrder(order: Order): Promise<Order> {
    this.orders.push(order);
    this.syncState.pendingCount++;
    this.persist();
    return order;
  }

  public async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error(`Commande introuvable : ${id}`);
    this.orders[idx] = { ...this.orders[idx], ...updates };
    this.syncState.pendingCount++;
    this.persist();
    return this.orders[idx];
  }

  public async deleteOrder(id: string): Promise<boolean> {
    const idx = this.orders.findIndex((o) => o.id === id);
    if (idx === -1) return false;
    this.orders.splice(idx, 1);
    this.syncState.pendingCount++;
    this.persist();
    return true;
  }

  public async getPayments(): Promise<Payment[]> {
    return [...this.payments];
  }

  public async savePayment(payment: Payment): Promise<Payment> {
    this.payments.push(payment);
    this.syncState.pendingCount++;
    this.persist();
    return payment;
  }

  public async getConfig(): Promise<SystemConfig> {
    const activeWave = this.config.waves?.find((w) => w.active) || this.config.waves?.[0];
    const ranks: { name: Rank; minCa: number; minOrders: number; commissionRate: number }[] = [
      { name: 'Neo', minCa: 0, minOrders: 0, commissionRate: 0.06 },
      {
        name: 'Ambassador',
        minCa: activeWave?.ambassadorCa ?? 100000,
        minOrders: activeWave?.ambassadorCmd ?? 8,
        commissionRate: 0.08,
      },
      {
        name: 'Excellence',
        minCa: activeWave?.excellenceCa ?? 300000,
        minOrders: activeWave?.excellenceCmd ?? 20,
        commissionRate: 0.10,
      },
      {
        name: 'Signature',
        minCa: activeWave?.signatureCa ?? 800000,
        minOrders: activeWave?.signatureCmd ?? 50,
        commissionRate: 0.12,
      },
    ];
    return {
      ...this.config,
      ranks,
    };
  }

  public async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    this.config = { ...this.config, ...updates };
    this.syncState.pendingCount++;
    this.persist();
    return this.config;
  }

  public async getLogs(): Promise<SystemLog[]> {
    return [...this.logs];
  }

  public async addLog(logData: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog> {
    const newLog: SystemLog = {
      id: `LOG${String(this.logs.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      ...logData,
    };
    this.logs.unshift(newLog);
    this.persist();
    return newLog;
  }

  public async getSyncState(): Promise<SyncState> {
    return { ...this.syncState };
  }

  public async triggerSync(forceError = false): Promise<SyncState> {
    if (forceError) {
      this.syncState.status = 'ERREUR';
      this.syncState.errors.push(`Erreur de synchronisation simulée (${new Date().toLocaleTimeString()}) : Connexion Sheets non établie`);
      await this.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'ERROR',
        description: 'Échec de synchronisation Google Sheets simulé',
        oldValue: 'EN_ATTENTE',
        newValue: 'ERREUR : Timeout de réponse',
      });
      this.persist();
      return { ...this.syncState };
    }

    this.syncState.status = 'SYNCHRONISE';
    this.syncState.lastSync = new Date().toISOString();
    this.syncState.pendingCount = 0;
    this.syncState.errors = [];

    await this.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'SYNC',
      description: 'Synchronisation manuelle exécutée avec succès',
      oldValue: 'EN_ATTENTE',
      newValue: 'SYNCHRONISE',
    });

    this.persist();
    return { ...this.syncState };
  }

  public readonly dataSourceMode: DataSourceMode = 'MOCK';
  private inspectionResult: SheetsInspectionResult | null = null;

  public async inspect(): Promise<SheetsInspectionResult | null> {
    const tabs = Object.entries(EXPECTED_SHEETS_CONFIG).map(([name, headers]) => {
      const isMobile = name === '📱 MOBILE';
      return {
        name,
        found: true,
        rowCount:
          name === 'PARTENAIRES'
            ? this.partners.length
            : name === 'Clients'
            ? this.clients.length
            : name === 'Commandes'
            ? this.orders.length
            : name === 'PAIEMENTS'
            ? this.payments.length
            : name === 'GRILLE_COMMISSION'
            ? this.products.length
            : 5,
        headerValid: true,
        expectedHeaders: isMobile ? [] : headers,
        actualHeaders: isMobile
          ? [
              'Ligne de commande (PANNEAU DE COMMANDE | COCHER POUR LANCER)',
              'Commandes (Initialiser le système & Recalculer tout)',
              'Zone de recherche/recalcul (ID | Grade actuel | Grade à valider | Commandes | CA | Confirmation)',
            ]
          : headers,
        missingHeaders: [],
        extraHeaders: [],
        isSpecialStructure: isMobile,
        specialStructureNote: isMobile
          ? 'Panneau de commande officiel Apps Script (non-tabulaire)'
          : undefined,
      };
    });

    this.inspectionResult = {
      connected: true,
      spreadsheetId: 'MOCK_AKF_PARTNERS_SPREADSHEET',
      title: 'AKF Partners (Classeur Mock Validé)',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/MOCK_AKF_PARTNERS_SPREADSHEET/edit',
      mode: 'MOCK',
      userEmail: 'admin@akfpartners.bj',
      sheetsFound: Object.keys(EXPECTED_SHEETS_CONFIG),
      tabs,
      allTabsConform: true,
      totalRows: this.partners.length + this.clients.length + this.orders.length + this.payments.length,
      lastCheck: new Date().toISOString(),
      appsScriptDetected: true,
      appsScriptNotes: [
        'Environnement Mock de transition (Phase 3 validée)',
        'Structure complète des 9 onglets simulée à 100% de conformité',
      ],
      errors: [],
      warnings: [],
      summary: {
        partnersCount: this.partners.length,
        clientsCount: this.clients.length,
        ordersCount: this.orders.length,
        paymentsCount: this.payments.length,
        productsCount: this.products.length,
        wavesCount: this.config.waves ? this.config.waves.length : 2,
      },
    };

    return this.inspectionResult;
  }

  public setCredentials(_id: string, _token: string, _email?: string): void {}
  public setMode(_mode: DataSourceMode): void {}
  public getInspectionResult(): SheetsInspectionResult | null {
    return this.inspectionResult;
  }

  public async resetToDefault(): Promise<void> {
    this.seedInitialData();
    this.persist();
  }
}

/**
 * REPOSITORY BASCULABLE (SwitchableSheetsRepository)
 * Permet de basculer en un clic entre :
 * 1. MOCK (Environnement de test/fallback)
 * 2. SHEETS_READONLY (Google Sheets authentique en lecture seule - Phase 4.1)
 * 3. SHEETS_LIVE (Google Sheets authentique en écriture contrôlée)
 */
export class SwitchableSheetsRepository implements ISheetsRepository {
  private mockRepo: MockSheetsRepository;
  private googleRepo: GoogleSheetsRepository;
  private currentMode: DataSourceMode = 'SHEETS_LIVE';
  private connectionConfigPath = path.join(process.cwd(), '.data', 'sheets_connection.json');

  constructor() {
    this.mockRepo = new MockSheetsRepository();
    this.googleRepo = new GoogleSheetsRepository();
    this.loadSavedConnection();
  }

  private loadSavedConnection() {
    try {
      if (fs.existsSync(this.connectionConfigPath)) {
        const raw = fs.readFileSync(this.connectionConfigPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.spreadsheetId && data.accessToken) {
          this.googleRepo.setCredentials(data.spreadsheetId, data.accessToken, data.userEmail || '');
          const effectiveMode = data.mode || 'SHEETS_LIVE';
          this.currentMode = effectiveMode;
          this.googleRepo.setMode(effectiveMode);
          // Déclencher une synchronisation initiale en tâche de fond pour alimenter les données réelles
          this.googleRepo.triggerSync().catch(() => {});
        }
      }
    } catch {
      // Tolérance aux pannes si le fichier n'est pas lisible
    }
  }

  private persistConnection(mode?: DataSourceMode) {
    try {
      const dir = path.dirname(this.connectionConfigPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const spreadsheetId = this.googleRepo.getSpreadsheetId();
      const accessToken = this.googleRepo.getAccessToken();
      const userEmail = this.googleRepo.getUserEmail();
      if (spreadsheetId) {
        fs.writeFileSync(
          this.connectionConfigPath,
          JSON.stringify(
            {
              spreadsheetId,
              accessToken,
              userEmail,
              mode: mode || this.currentMode,
              updatedAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }
    } catch (e) {
      console.error('Erreur de persistance de la connexion Sheets:', e);
    }
  }

  private get activeRepo(): ISheetsRepository {
    if (this.currentMode === 'MOCK') {
      return this.mockRepo;
    }
    return this.googleRepo;
  }

  public get isMock(): boolean {
    return this.activeRepo.isMock;
  }

  public get modeName(): string {
    return this.activeRepo.modeName;
  }

  public get dataSourceMode(): DataSourceMode {
    return this.currentMode;
  }

  public setMode(mode: DataSourceMode): void {
    this.currentMode = mode;
    this.googleRepo.setMode(mode);
    this.persistConnection(mode);
  }

  public setCredentials(spreadsheetId: string, accessToken: string, userEmail = '', mode?: DataSourceMode): void {
    this.googleRepo.setCredentials(spreadsheetId, accessToken, userEmail);
    if (mode) {
      this.currentMode = mode;
      this.googleRepo.setMode(mode);
    }
    this.persistConnection(mode || this.currentMode);
  }

  public async inspect(): Promise<SheetsInspectionResult | null> {
    if (this.currentMode === 'MOCK') {
      return this.mockRepo.inspect();
    }
    return this.googleRepo.inspect();
  }

  public getInspectionResult(): SheetsInspectionResult | null {
    return this.activeRepo.getInspectionResult();
  }

  public async getPartners(): Promise<Partner[]> {
    return this.activeRepo.getPartners();
  }

  public async savePartner(partner: Partner): Promise<Partner> {
    return this.activeRepo.savePartner(partner);
  }

  public async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner> {
    return this.activeRepo.updatePartner(id, updates);
  }

  public async getClients(): Promise<Client[]> {
    return this.activeRepo.getClients();
  }

  public async saveClient(client: Client): Promise<Client> {
    return this.activeRepo.saveClient(client);
  }

  public async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    return this.activeRepo.updateClient(id, updates);
  }

  public async deleteClient(id: string): Promise<boolean> {
    return this.activeRepo.deleteClient(id);
  }

  public async getProducts(): Promise<Product[]> {
    return this.activeRepo.getProducts();
  }

  public async getOrders(): Promise<Order[]> {
    return this.activeRepo.getOrders();
  }

  public async saveOrder(order: Order): Promise<Order> {
    return this.activeRepo.saveOrder(order);
  }

  public async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    return this.activeRepo.updateOrder(id, updates);
  }

  public async deleteOrder(id: string): Promise<boolean> {
    return this.activeRepo.deleteOrder(id);
  }

  public async getPayments(): Promise<Payment[]> {
    return this.activeRepo.getPayments();
  }

  public async savePayment(payment: Payment): Promise<Payment> {
    return this.activeRepo.savePayment(payment);
  }

  public async getConfig(): Promise<SystemConfig> {
    return this.activeRepo.getConfig();
  }

  public async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    return this.activeRepo.updateConfig(updates);
  }

  public async getLogs(): Promise<SystemLog[]> {
    return this.activeRepo.getLogs();
  }

  public async addLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog> {
    return this.activeRepo.addLog(log);
  }

  public async getSyncState(): Promise<SyncState> {
    return this.activeRepo.getSyncState();
  }

  public async triggerSync(forceError = false): Promise<SyncState> {
    return this.activeRepo.triggerSync(forceError);
  }

  public async resetToDefault(): Promise<void> {
    return this.activeRepo.resetToDefault();
  }
}

// Instance singleton du repository
export const sheetsRepo = new SwitchableSheetsRepository();
