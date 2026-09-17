import fs from "fs";
import path from "path";
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
} from "../src/types";
import { EXPECTED_SHEETS_CONFIG } from "./googleSheetsService";
import { ISheetsRepository } from "./sheetsRepository";
import {
  INITIAL_PRODUCTS,
  INITIAL_CONFIG,
  INITIAL_PARTNERS,
  INITIAL_CLIENTS,
  INITIAL_ORDERS,
  INITIAL_PAYMENTS,
  INITIAL_LOGS,
} from "./mockSeedData";

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
    this.partners = JSON.parse(JSON.stringify(INITIAL_PARTNERS));
    this.clients = JSON.parse(JSON.stringify(INITIAL_CLIENTS));
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS));
    this.payments = JSON.parse(JSON.stringify(INITIAL_PAYMENTS));
    this.config = JSON.parse(JSON.stringify(INITIAL_CONFIG));
    this.logs = JSON.parse(JSON.stringify(INITIAL_LOGS));
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
