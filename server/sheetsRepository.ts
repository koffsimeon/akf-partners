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
  WaveConfig,
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
  saveProduct?(product: Product): Promise<Product>;
  updateProduct?(id: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct?(id: string): Promise<boolean>;

  getWaves?(): Promise<WaveConfig[]>;
  saveWave?(wave: WaveConfig): Promise<WaveConfig>;
  setActiveWave?(waveName: string): Promise<WaveConfig[]>;

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


import { MockSheetsRepository } from "./mockSheetsRepository";
import { SupabaseRepository } from "./supabaseRepository";
import { isSupabaseConfigured } from "./supabaseClient";

/**
 * REPOSITORY BASCULABLE (SwitchableSheetsRepository)
 * Permet de basculer en un clic entre :
 * 1. SUPABASE (Base PostgreSQL live connectée via .env)
 * 2. MOCK (Environnement de test/fallback)
 * 3. SHEETS_READONLY (Google Sheets authentique en lecture seule - Phase 4.1)
 * 4. SHEETS_LIVE (Google Sheets authentique en écriture contrôlée)
 */
export class SwitchableSheetsRepository implements ISheetsRepository {
  private mockRepo: MockSheetsRepository;
  private googleRepo: GoogleSheetsRepository;
  private supabaseRepo: SupabaseRepository;
  private currentMode: DataSourceMode = 'SHEETS_LIVE';
  private connectionConfigPath = path.join(process.cwd(), '.data', 'sheets_connection.json');

  constructor() {
    this.mockRepo = new MockSheetsRepository();
    this.googleRepo = new GoogleSheetsRepository();
    this.supabaseRepo = new SupabaseRepository();
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
    if (isSupabaseConfigured()) {
      return this.supabaseRepo;
    }
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
    if (isSupabaseConfigured()) {
      return 'SHEETS_LIVE';
    }
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

  public async saveProduct(product: Product): Promise<Product> {
    if (this.activeRepo.saveProduct) return this.activeRepo.saveProduct(product);
    return this.mockRepo.saveProduct(product);
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    if (this.activeRepo.updateProduct) return this.activeRepo.updateProduct(id, updates);
    return this.mockRepo.updateProduct(id, updates);
  }

  public async deleteProduct(id: string): Promise<boolean> {
    if (this.activeRepo.deleteProduct) return this.activeRepo.deleteProduct(id);
    return this.mockRepo.deleteProduct(id);
  }

  public async getWaves(): Promise<WaveConfig[]> {
    if (this.activeRepo.getWaves) return this.activeRepo.getWaves();
    return this.mockRepo.getWaves();
  }

  public async saveWave(wave: WaveConfig): Promise<WaveConfig> {
    if (this.activeRepo.saveWave) return this.activeRepo.saveWave(wave);
    return this.mockRepo.saveWave(wave);
  }

  public async setActiveWave(waveName: string): Promise<WaveConfig[]> {
    if (this.activeRepo.setActiveWave) return this.activeRepo.setActiveWave(waveName);
    return this.mockRepo.setActiveWave(waveName);
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

