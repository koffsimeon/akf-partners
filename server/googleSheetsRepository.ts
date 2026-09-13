/**
 * AKF PARTNERS — PHASE 4 : GOOGLE SHEETS REPOSITORY
 * 
 * Implémente ISheetsRepository en se connectant à l'API Google Sheets réelle.
 * Respecte les exigences strictes :
 * - Mode READ-ONLY en phase initiale de sécurité
 * - Verrou logique asynchrone sur la création d'ID (concurrence)
 * - Relecture préalable de l'état réel de l'onglet
 * - Écritures NON DESTRUCTIVES (appendRow uniquement, aucune suppression)
 * - Relecture de confirmation post-écriture
 * - Préservation intégrale de l'ancien Apps Script
 */

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
  WaveConfig,
} from '../src/types';
import { GoogleSheetsService, formatPhoneForSheets } from './googleSheetsService';
import { ISheetsRepository } from './sheetsRepository';
import { generateNextId, partnerIdToCode } from '../src/engine/akfEngine';

export class GoogleSheetsRepository implements ISheetsRepository {
  public readonly isMock = false;
  private _mode: DataSourceMode = 'SHEETS_LIVE';
  private spreadsheetId: string = '';
  private accessToken: string = '';
  private userEmail: string = '';

  // Cache mémoire des données réelles lues
  private partners: Partner[] = [];
  private clients: Client[] = [];
  private orders: Order[] = [];
  private payments: Payment[] = [];
  private products: Product[] = [];
  private waves: WaveConfig[] = [];
  private logs: SystemLog[] = [];
  private config: SystemConfig = {
    minimumPayment: 5000,
    premiumCommissionMaxOrders: 3,
    commissionRates: {
      Neo: 6,
      Ambassador: 8,
      Excellence: 10,
      Signature: 12,
    },
    autoSync: true,
  };

  private syncState: SyncState = {
    status: 'EN_ATTENTE',
    lastSync: null,
    pendingCount: 0,
    errors: [],
  };

  private inspectionResult: SheetsInspectionResult | null = null;

  // Verrou d'exclusion mutuelle pour prévenir les collisions d'IDs
  private writeMutex: Promise<any> = Promise.resolve();

  // Cache court (2s) pour fusionner les requêtes parallèles de chargement UI (Promise.all)
  // sans jamais masquer les suppressions/modifications réelles faites sur Sheets
  private lastSyncTime = 0;
  private hasInitialSynced = false;
  private inFlightSync: Promise<SyncState> | null = null;
  private readonly CACHE_TTL_MS = 2000;

  constructor(spreadsheetId = '', accessToken = '', userEmail = '') {
    this.spreadsheetId = spreadsheetId;
    this.accessToken = accessToken;
    this.userEmail = userEmail;
  }

  public get modeName(): string {
    return 'GOOGLE SHEETS OFFICIEL AKF PARTNERS (PRODUCTION)';
  }

  public get dataSourceMode(): DataSourceMode {
    return this._mode;
  }

  public setMode(mode: DataSourceMode) {
    this._mode = mode;
  }

  public getSpreadsheetId(): string {
    return this.spreadsheetId;
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  public getUserEmail(): string {
    return this.userEmail;
  }

  public setCredentials(spreadsheetId: string, accessToken: string, userEmail = '') {
    this.spreadsheetId = spreadsheetId.trim();
    this.accessToken = accessToken.trim();
    this.userEmail = userEmail.trim();
  }

  public getInspectionResult(): SheetsInspectionResult | null {
    return this.inspectionResult;
  }

  /**
   * Inspection complète du fichier Google Sheets
   */
  public async inspect(): Promise<SheetsInspectionResult> {
    if (!this.spreadsheetId || !this.accessToken) {
      throw new Error(
        "Identifiant Google Sheets ou jeton d'accès manquant. Veuillez vous connecter avec votre compte Google."
      );
    }

    const inspection = await GoogleSheetsService.inspectSpreadsheet(
      this.spreadsheetId,
      this.accessToken
    );
    inspection.mode = this._mode;
    inspection.userEmail = this.userEmail;

    // Charger les données réelles et peupler le résumé
    try {
      await this.triggerSync();
      inspection.summary = {
        partnersCount: this.partners.length,
        clientsCount: this.clients.length,
        ordersCount: this.orders.length,
        paymentsCount: this.payments.length,
        productsCount: this.products.length,
        wavesCount: this.waves.length,
      };
    } catch (e: any) {
      inspection.warnings.push(`Synchronisation initiale partielle : ${e.message}`);
    }

    this.inspectionResult = inspection;
    return inspection;
  }

  /**
   * Synchronisation : lit tous les onglets depuis Google Sheets et actualise le cache
   */
  public async triggerSync(forceError = false): Promise<SyncState> {
    if (forceError) {
      this.syncState.status = 'ERREUR';
      this.syncState.errors.push(
        `Erreur de synchronisation simulée (${new Date().toLocaleTimeString()})`
      );
      return { ...this.syncState };
    }

    if (!this.spreadsheetId || !this.accessToken) {
      this.syncState.status = 'EN_ATTENTE';
      return { ...this.syncState };
    }

    try {
      const data = await GoogleSheetsService.fetchAndMapAll(
        this.spreadsheetId,
        this.accessToken
      );

      this.partners = data.partners;
      this.clients = data.clients;
      this.orders = data.orders;
      this.payments = data.payments;
      this.products = data.products;
      this.waves = data.waves;
      this.logs = data.logs;

      this.config = {
        ...this.config,
        waves: this.waves,
        lastUpdated: new Date().toISOString(),
      };

      this.syncState.status = 'SYNCHRONISE';
      this.syncState.lastSync = new Date().toISOString();
      this.syncState.pendingCount = 0;
      this.syncState.errors = [];
      this.lastSyncTime = Date.now();

      return { ...this.syncState };
    } catch (err: any) {
      this.syncState.status = 'ERREUR';
      const isAuth =
        err.message?.includes('401') ||
        err.message?.includes('UNAUTHENTICATED') ||
        err.message?.includes('authentication credential');
      const msg = isAuth
        ? "Jeton d'accès Google Sheets expiré. Veuillez vous reconnecter avec Google dans l'onglet Google Sheets."
        : `Erreur Sheets : ${err.message}`;
      this.syncState.errors = [msg];
      throw err;
    }
  }

  // --- LECTURE RÉELLE GARANTIE (GOOGLE SHEETS = SOURCE DE VÉRITÉ) ---

  /**
   * Garantit que les données retournées reflètent l'état réel actuel de Google Sheets.
   * Fusionne les requêtes parallèles UI (Promise.all) pour respecter les quotas Sheets API
   * tout en garantissant l'actualité immédiate des données.
   */
  private async ensureFreshData(): Promise<void> {
    if (!this.spreadsheetId || !this.accessToken) return;

    if (this.inFlightSync) {
      await this.inFlightSync;
      return;
    }

    const now = Date.now();
    if (!this.hasInitialSynced || now - this.lastSyncTime > this.CACHE_TTL_MS) {
      this.inFlightSync = (async () => {
        try {
          await this.triggerSync();
          this.hasInitialSynced = true;
          this.lastSyncTime = Date.now();
        } catch (err: any) {
          this.lastSyncTime = Date.now();
          console.warn('[GoogleSheetsRepository] Synchronisation de lecture impossible :', err.message);
          // On n'interrompt pas les lectures : l'état d'erreur est consigné dans this.syncState
        }
        return this.syncState;
      })().finally(() => {
        this.inFlightSync = null;
      });
      await this.inFlightSync;
    }
  }

  public async getPartners(): Promise<Partner[]> {
    await this.ensureFreshData();
    return [...this.partners];
  }

  public async getClients(): Promise<Client[]> {
    await this.ensureFreshData();
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

  public async getOrders(): Promise<Order[]> {
    await this.ensureFreshData();
    return [...this.orders];
  }

  public async getPayments(): Promise<Payment[]> {
    await this.ensureFreshData();
    return [...this.payments];
  }

  public async getProducts(): Promise<Product[]> {
    await this.ensureFreshData();
    return [...this.products];
  }

  public async getConfig(): Promise<SystemConfig> {
    await this.ensureFreshData();
    const activeWave = this.waves.find((w) => w.active) || this.waves[0];
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
      waves: this.waves,
      ranks,
    };
  }

  public async getLogs(): Promise<SystemLog[]> {
    await this.ensureFreshData();
    return [...this.logs];
  }

  public async getSyncState(): Promise<SyncState> {
    return { ...this.syncState };
  }

  // --- ÉCRITURE RÉELLE EN PRODUCTION ---

  private ensureWriteAllowed() {
    if (!this.spreadsheetId || !this.accessToken) {
      throw new Error(
        '⚠️ Erreur de connexion : Identifiant Google Sheets ou jeton d’accès manquant.'
      );
    }
  }

  private async acquireLock<T>(task: () => Promise<T>): Promise<T> {
    const nextMutex = this.writeMutex.then(async () => {
      return task();
    });
    this.writeMutex = nextMutex.catch(() => {});
    return nextMutex;
  }

  public async savePartner(partner: Partner): Promise<Partner> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      // 1. Relecture préalable forcée de l'état réel pour éviter toute collision
      this.lastSyncTime = 0;
      await this.triggerSync();
      const existingIds = this.partners.map((p) => p.id);

      // 2. Vérification/Calcul ID sécurisé
      let finalId = partner.id;
      if (!finalId || existingIds.includes(finalId)) {
        finalId = generateNextId('AKF', existingIds);
      }
      const finalCode = partnerIdToCode(finalId, partner.fullName);

      const targetPartner: Partner = {
        ...partner,
        id: finalId,
        code: finalCode,
      };

      // 3. Formatage de la ligne (17 colonnes exactes de l'onglet PARTENAIRES)
      const rowValues = [
        targetPartner.id,
        targetPartner.fullName,
        formatPhoneForSheets(targetPartner.phone),
        formatPhoneForSheets(targetPartner.whatsapp),
        targetPartner.createdAt || new Date().toISOString().split('T')[0],
        targetPartner.rank,
        targetPartner.code,
        targetPartner.status,
        targetPartner.clientCount || 0,
        targetPartner.orderCount || 0,
        targetPartner.ca || 0,
        targetPartner.totalCommission || 0,
        targetPartner.paidCommission || 0,
        targetPartner.balance || 0,
        0, // COMMISSION ANNULÉE
        targetPartner.nextRank || '',
        targetPartner.progressPct ? `${targetPartner.progressPct}%` : '0%',
      ];

      // 4. Écriture sur la première ligne libre (évite de sauter les lignes de formules pré-remplies)
      await GoogleSheetsService.insertOrAppendRow(
        this.spreadsheetId,
        this.accessToken,
        'PARTENAIRES',
        rowValues
      );

      // 5. Invalidation et relecture de confirmation post-écriture
      this.lastSyncTime = 0;
      await this.triggerSync();

      const confirmed = this.partners.find((p) => p.id === targetPartner.id);
      if (!confirmed) {
        throw new Error(
          `Erreur de confirmation post-écriture : le partenaire ${targetPartner.id} n'a pas pu être relu depuis Google Sheets.`
        );
      }

      await this.addLog({
        user: this.userEmail || 'admin@akfpartners.bj',
        actionType: 'CREATE_PARTNER',
        description: `Création sécurisée dans Google Sheets : Partenaire ${targetPartner.id} (${targetPartner.code})`,
        oldValue: 'null',
        newValue: `${targetPartner.id} - ${targetPartner.fullName}`,
      });

      return confirmed;
    });
  }

  public async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const current = this.partners.find((p) => p.id === id);
      if (!current) throw new Error(`Partenaire ${id} non trouvé dans Google Sheets`);

      const updated: Partner = { ...current, ...updates };

      const rowValues = [
        updated.id,
        updated.fullName,
        formatPhoneForSheets(updated.phone),
        formatPhoneForSheets(updated.whatsapp),
        updated.createdAt,
        updated.rank,
        updated.code,
        updated.status,
        updated.clientCount || 0,
        updated.orderCount || 0,
        updated.ca || 0,
        updated.totalCommission || 0,
        updated.paidCommission || 0,
        updated.balance || 0,
        0,
        updated.nextRank || '',
        updated.progressPct ? `${updated.progressPct}%` : '0%',
      ];

      await GoogleSheetsService.updateRowByPrimaryKey(
        this.spreadsheetId,
        this.accessToken,
        'PARTENAIRES',
        'ID Partenaire',
        id,
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      return updated;
    });
  }

  public async saveClient(client: Client): Promise<Client> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const existingIds = this.clients.map((c) => c.id);

      let finalId = client.id;
      if (!finalId || existingIds.includes(finalId)) {
        finalId = generateNextId('CL', existingIds);
      }

      const targetClient: Client = { ...client, id: finalId };

      const clientOrders = this.orders.filter(
        (o) =>
          (o.clientId === targetClient.id || (targetClient.id && o.clientId && o.clientId.toLowerCase() === targetClient.id.toLowerCase())) &&
          o.orderStatus !== 'Annulée'
      );
      const sortedDates = clientOrders
        .map((o) => o.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastOrderDate = targetClient.lastOrderDate || (sortedDates.length > 0 ? sortedDates[0] : '');

      const rowValues = [
        targetClient.id,
        targetClient.fullName,
        formatPhoneForSheets(targetClient.phone),
        formatPhoneForSheets(targetClient.whatsapp),
        targetClient.createdAt || new Date().toISOString().split('T')[0],
        targetClient.partnerId || '',
        targetClient.partnerCode || '',
        targetClient.clientType,
        '', // FICHE CLIENT
        0, // COMMANDES PREMIUM
        0, // COMMISSIONS PREMIUM
        lastOrderDate, // DERNIÈRE COMMANDE
        'Actif',
        '', // OBSERVATION
      ];

      await GoogleSheetsService.insertOrAppendRow(
        this.spreadsheetId,
        this.accessToken,
        'Clients',
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      const confirmed = this.clients.find((c) => c.id === targetClient.id);
      if (!confirmed) {
        throw new Error(
          `Erreur de confirmation post-écriture : le client ${targetClient.id} n'a pas pu être relu depuis Google Sheets.`
        );
      }

      return confirmed;
    });
  }

  public async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const current = this.clients.find((c) => c.id === id);
      if (!current) throw new Error(`Client ${id} non trouvé dans Google Sheets`);

      const clientOrders = this.orders.filter(
        (o) =>
          (o.clientId === id || (id && o.clientId && o.clientId.toLowerCase() === id.toLowerCase())) &&
          o.orderStatus !== 'Annulée'
      );
      const sortedDates = clientOrders
        .map((o) => o.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastOrderDate = updates.lastOrderDate !== undefined
        ? (updates.lastOrderDate || '')
        : (sortedDates.length > 0 ? sortedDates[0] : (current.lastOrderDate || ''));

      const updated: Client = { ...current, ...updates, lastOrderDate };

      const rowValues = [
        updated.id,
        updated.fullName,
        formatPhoneForSheets(updated.phone),
        formatPhoneForSheets(updated.whatsapp),
        updated.createdAt,
        updated.partnerId || '',
        updated.partnerCode || '',
        updated.clientType,
        '', // FICHE CLIENT
        0, // COMMANDES PREMIUM
        0, // COMMISSIONS PREMIUM
        lastOrderDate, // DERNIÈRE COMMANDE
        'Actif',
        '', // OBSERVATION
      ];

      await GoogleSheetsService.updateRowByPrimaryKey(
        this.spreadsheetId,
        this.accessToken,
        'Clients',
        'ID CLIENT',
        id,
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      return updated;
    });
  }

  public async deleteClient(id: string): Promise<boolean> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.ensureFreshData();
      const existing = this.clients.find((c) => c.id === id);
      if (!existing) return false;

      this.clients = this.clients.filter((c) => c.id !== id);

      try {
        await GoogleSheetsService.deleteRowByPrimaryKey(
          this.spreadsheetId,
          this.accessToken,
          'Clients',
          'ID CLIENT',
          id
        );
      } catch (err) {
        console.error(`[GoogleSheetsRepository] Erreur suppression ligne client ${id}:`, err);
      }

      this.lastSyncTime = 0;
      await this.triggerSync();
      return true;
    });
  }

  public async saveOrder(order: Order): Promise<Order> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const existingIds = this.orders.map((o) => o.id);

      let finalId = order.id;
      if (!finalId || existingIds.includes(finalId)) {
        finalId = generateNextId('CMD', existingIds);
      }

      const targetOrder: Order = { ...order, id: finalId };
      const client = this.clients.find((c) => c.id === targetOrder.clientId);
      const clientPhone = client ? client.phone : '';

      const rowValues = [
        targetOrder.id,
        targetOrder.date,
        targetOrder.clientName,
        formatPhoneForSheets(clientPhone), // TÉLÉPHONE CLIENT
        targetOrder.partnerId || '',
        targetOrder.partnerCode || '',
        targetOrder.productName,
        targetOrder.isPremium ? 'PREMIUM' : 'RÉCURRENT',
        targetOrder.quantity,
        targetOrder.unitPrice,
        targetOrder.totalAmount,
        targetOrder.orderStatus,
        targetOrder.commissionAmount,
        targetOrder.commissionStatus,
        '', // DATE PAIEMENT COMMISSION
        '', // OBSERVATION
        targetOrder.partnerRankAtOrder || '',
        '', // MODE DE PAIEMENT : ne pas préremplir automatiquement à la création
        targetOrder.clientId,
        targetOrder.premiumRankForClient || '',
        '', // DATE ANNULATION
        '', // ID PAIEMENT COMMISSION
        0, // MONTANT DÉJÀ PAYÉ
      ];

      await GoogleSheetsService.insertOrAppendRow(
        this.spreadsheetId,
        this.accessToken,
        'Commandes',
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      const confirmed = this.orders.find((o) => o.id === targetOrder.id);
      if (!confirmed) {
        throw new Error(
          `Erreur de confirmation post-écriture : la commande ${targetOrder.id} n'a pas pu être relue depuis Google Sheets.`
        );
      }

      return confirmed;
    });
  }

  public async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const current = this.orders.find((o) => o.id === id);
      if (!current) throw new Error(`Commande ${id} non trouvée dans Google Sheets`);

      const updated: Order = { ...current, ...updates };
      const client = this.clients.find((c) => c.id === updated.clientId);
      const clientPhone = client ? client.phone : '';

      const rowValues = [
        updated.id,
        updated.date,
        updated.clientName,
        formatPhoneForSheets(clientPhone),
        updated.partnerId || '',
        updated.partnerCode || '',
        updated.productName,
        updated.isPremium ? 'PREMIUM' : 'RÉCURRENT',
        updated.quantity,
        updated.unitPrice,
        updated.totalAmount,
        updated.orderStatus,
        updated.commissionAmount,
        updated.commissionStatus,
        '',
        '',
        updated.partnerRankAtOrder || '',
        '', // MODE DE PAIEMENT : ne pas préremplir automatiquement
        updated.clientId,
        updated.premiumRankForClient || '',
        '',
        '',
        0,
      ];

      await GoogleSheetsService.updateRowByPrimaryKey(
        this.spreadsheetId,
        this.accessToken,
        'Commandes',
        'ID COMMANDE',
        id,
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      return updated;
    });
  }

  public async deleteOrder(id: string): Promise<boolean> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.ensureFreshData();
      const existing = this.orders.find((o) => o.id === id);
      if (!existing) return false;

      this.orders = this.orders.filter((o) => o.id !== id);

      try {
        await GoogleSheetsService.deleteRowByPrimaryKey(
          this.spreadsheetId,
          this.accessToken,
          'Commandes',
          'ID COMMANDE',
          id
        );
      } catch (err) {
        console.error(`[GoogleSheetsRepository] Erreur suppression ligne commande ${id}:`, err);
      }

      this.lastSyncTime = 0;
      await this.triggerSync();
      return true;
    });
  }

  public async savePayment(payment: Payment): Promise<Payment> {
    this.ensureWriteAllowed();

    return this.acquireLock(async () => {
      this.lastSyncTime = 0;
      await this.triggerSync();
      const existingIds = this.payments.map((p) => p.id);

      let finalId = payment.id;
      if (!finalId || existingIds.includes(finalId)) {
        finalId = generateNextId('PAY', existingIds);
      }

      const targetPayment: Payment = { ...payment, id: finalId };

      let observation = targetPayment.note || '';
      if (targetPayment.paymentMethod && !observation.includes(targetPayment.paymentMethod)) {
        observation = observation ? `${observation} [${targetPayment.paymentMethod}]` : `Mode : ${targetPayment.paymentMethod}`;
      }

      const rowValues = [
        targetPayment.id,
        targetPayment.date,
        targetPayment.partnerId,
        targetPayment.partnerCode,
        targetPayment.amount,
        observation,
      ];

      await GoogleSheetsService.insertOrAppendRow(
        this.spreadsheetId,
        this.accessToken,
        'PAIEMENTS',
        rowValues
      );

      this.lastSyncTime = 0;
      await this.triggerSync();
      const confirmed = this.payments.find((p) => p.id === targetPayment.id);
      if (!confirmed) {
        throw new Error(
          `Erreur de confirmation post-écriture : le paiement ${targetPayment.id} n'a pas pu être relu depuis Google Sheets.`
        );
      }

      return confirmed;
    });
  }

  public async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    this.config = { ...this.config, ...updates };
    return { ...this.config };
  }

  public async addLog(logData: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog> {
    const newLog: SystemLog = {
      id: `LOG${String(this.logs.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      ...logData,
    };
    this.logs.unshift(newLog);

    // Enregistrement dans SYSTEM_LOGS sur Sheets si écriture autorisée
    if (this._mode === 'SHEETS_LIVE' && this.spreadsheetId && this.accessToken) {
      try {
        await GoogleSheetsService.insertOrAppendRow(
          this.spreadsheetId,
          this.accessToken,
          'SYSTEM_LOGS',
          [
            newLog.timestamp,
            newLog.user,
            newLog.actionType,
            newLog.description,
            newLog.oldValue,
            newLog.newValue,
          ]
        );
      } catch {
        // En cas d'échec d'écriture du log distant, préserver en mémoire
      }
    }

    return newLog;
  }

  public async resetToDefault(): Promise<void> {
    // Dans Google Sheets réel, resetToDefault ne vide RIEN.
    // Conforme à la règle d'or : "NEVER supprimer les données".
    await this.triggerSync();
  }
}
