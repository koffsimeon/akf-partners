import {
  Client,
  DataSourceMode,
  LogActionType,
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
import { getSupabaseClient } from './supabaseClient';
import { ISheetsRepository } from './sheetsRepository';

export class SupabaseRepository implements ISheetsRepository {
  readonly isMock = false;
  readonly modeName = 'Supabase PostgreSQL (Live)';
  readonly dataSourceMode: DataSourceMode = 'SHEETS_LIVE'; // Mode Live réel

  private get client() {
    const c = getSupabaseClient();
    if (!c) {
      throw new Error('Supabase client non initialisé. Vérifiez votre fichier .env.');
    }
    return c;
  }

  // --- PARTENAIRES ---
  async getPartners(): Promise<Partner[]> {
    const { data, error } = await this.client
      .from('partners')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw new Error(`Erreur Supabase getPartners: ${error.message}`);
    if (!data) return [];

    return data.map((row: any) => {
      const rank: Rank = row.rank || 'Neo';
      const ca = Number(row.ca) || 0;
      const orderCount = Number(row.order_count) || 0;
      const totalCommission = Number(row.total_commission) || 0;
      const validatedCommission = Number(row.validated_commission) || 0;
      const paidCommission = Number(row.paid_commission) || 0;
      const balance = Number(row.balance) || (validatedCommission - paidCommission);

      const nextRank: Rank | null =
        rank === 'Neo' ? 'Ambassador' : rank === 'Ambassador' ? 'Excellence' : rank === 'Excellence' ? 'Signature' : null;

      const targetCaNextRank =
        rank === 'Neo' ? 150000 : rank === 'Ambassador' ? 500000 : rank === 'Excellence' ? 1000000 : 0;

      const targetCmdNextRank =
        rank === 'Neo' ? 10 : rank === 'Ambassador' ? 25 : rank === 'Excellence' ? 50 : 0;

      const progressPct =
        targetCaNextRank > 0 ? Math.min(100, Math.round((ca / targetCaNextRank) * 100)) : 100;

      return {
        id: row.id,
        code: row.code,
        fullName: row.full_name,
        phone: row.phone,
        phoneCanonical: row.phone_canonical,
        whatsapp: row.whatsapp || '',
        rank,
        wave: 'Vague 1',
        status: (row.status || 'Actif') as 'Actif' | 'Inactif',
        createdAt: row.created_at || new Date().toISOString(),
        ca,
        clientCount: Number(row.client_count) || 0,
        orderCount,
        totalCommission,
        validatedCommission,
        paidCommission,
        balance,
        progressPct,
        nextRank,
        targetCaNextRank,
        targetCmdNextRank,
      };
    });
  }

  async savePartner(partner: Partner): Promise<Partner> {
    const row = {
      id: partner.id,
      code: partner.code,
      full_name: partner.fullName,
      phone: partner.phone,
      phone_canonical: partner.phoneCanonical || partner.phone.replace(/[^0-9+]/g, ''),
      whatsapp: partner.whatsapp || partner.phone,
      rank: partner.rank || 'Neo',
      status: partner.status || 'Actif',
      ca: partner.ca || 0,
      client_count: partner.clientCount || 0,
      order_count: partner.orderCount || 0,
      total_commission: partner.totalCommission || 0,
      validated_commission: partner.validatedCommission || 0,
      paid_commission: partner.paidCommission || 0,
      balance: partner.balance || 0,
      notes: partner.notes || '',
    };

    const { error } = await this.client.from('partners').insert(row);
    if (error) throw new Error(`Erreur Supabase savePartner: ${error.message}`);
    return partner;
  }

  async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner> {
    const patch: any = {};
    if (updates.fullName !== undefined) patch.full_name = updates.fullName;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.phoneCanonical !== undefined) patch.phone_canonical = updates.phoneCanonical;
    if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp;
    if (updates.rank !== undefined) patch.rank = updates.rank;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.ca !== undefined) patch.ca = updates.ca;
    if (updates.clientCount !== undefined) patch.client_count = updates.clientCount;
    if (updates.orderCount !== undefined) patch.order_count = updates.orderCount;
    if (updates.totalCommission !== undefined) patch.total_commission = updates.totalCommission;
    if (updates.validatedCommission !== undefined) patch.validated_commission = updates.validatedCommission;
    if (updates.paidCommission !== undefined) patch.paid_commission = updates.paidCommission;
    if (updates.balance !== undefined) patch.balance = updates.balance;
    if (updates.notes !== undefined) patch.notes = updates.notes;

    const { error } = await this.client.from('partners').update(patch).eq('id', id);
    if (error) throw new Error(`Erreur Supabase updatePartner: ${error.message}`);

    const partners = await this.getPartners();
    return partners.find((p) => p.id === id) || (updates as Partner);
  }

  // --- CLIENTS ---
  async getClients(): Promise<Client[]> {
    const { data, error } = await this.client
      .from('clients')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw new Error(`Erreur Supabase getClients: ${error.message}`);
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
      phoneCanonical: row.phone_canonical,
      whatsapp: row.whatsapp || '',
      city: '',
      address: '',
      notes: '',
      partnerId: row.partner_id || null,
      partnerCode: row.partner_id ? `AKF-${row.partner_id}` : null,
      partnerName: null,
      clientType: (row.type as any) || (row.partner_id ? 'PARTENAIRE' : 'DIRECT AKF'),
      orderCount: Number(row.order_count) || 0,
      totalCa: Number(row.total_spend) || 0,
      createdAt: row.created_at || new Date().toISOString(),
    }));
  }

  async saveClient(client: Client): Promise<Client> {
    const row = {
      id: client.id,
      full_name: client.fullName,
      phone: client.phone,
      phone_canonical: client.phoneCanonical || client.phone.replace(/[^0-9+]/g, ''),
      whatsapp: client.whatsapp || client.phone,
      type: client.clientType || (client.partnerId ? 'PARTENAIRE' : 'DIRECT AKF'),
      partner_id: client.partnerId || null,
      order_count: client.orderCount || 0,
      total_spend: client.totalCa || 0,
    };

    const { error } = await this.client.from('clients').insert(row);
    if (error) throw new Error(`Erreur Supabase saveClient: ${error.message}`);
    return client;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const patch: any = {};
    if (updates.fullName !== undefined) patch.full_name = updates.fullName;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.phoneCanonical !== undefined) patch.phone_canonical = updates.phoneCanonical;
    if (updates.whatsapp !== undefined) patch.whatsapp = updates.whatsapp;
    if (updates.clientType !== undefined) patch.type = updates.clientType;
    if (updates.partnerId !== undefined) patch.partner_id = updates.partnerId || null;
    if (updates.orderCount !== undefined) patch.order_count = updates.orderCount;
    if (updates.totalCa !== undefined) patch.total_spend = updates.totalCa;

    const { error } = await this.client.from('clients').update(patch).eq('id', id);
    if (error) throw new Error(`Erreur Supabase updateClient: ${error.message}`);

    const clients = await this.getClients();
    return clients.find((c) => c.id === id) || (updates as Client);
  }

  async deleteClient(id: string): Promise<boolean> {
    const { error } = await this.client.from('clients').delete().eq('id', id);
    if (error) throw new Error(`Erreur Supabase deleteClient: ${error.message}`);
    return true;
  }

  // --- COMMANDES ---
  async getOrders(): Promise<Order[]> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw new Error(`Erreur Supabase getOrders: ${error.message}`);
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      date: row.date,
      clientId: row.client_id,
      clientName: row.client_id,
      partnerId: row.partner_id || null,
      partnerCode: row.partner_id || null,
      partnerName: null,
      partnerRankAtOrder: row.rank_at_order || null,
      productId: row.product_id || '',
      productName: row.product_name,
      quantity: Number(row.quantity) || 1,
      unitPrice: Number(row.unit_price) || 0,
      totalAmount: Number(row.total_amount) || 0,
      isPremium: row.product_category === 'PREMIUM',
      premiumRankForClient: row.client_order_index ? Number(row.client_order_index) : null,
      commissionRate: Number(row.total_amount) > 0 ? Number(row.commission_amount) / Number(row.total_amount) : 0,
      commissionAmount: Number(row.commission_amount) || 0,
      orderStatus: row.order_status || 'En attente',
      commissionStatus: row.commission_status || 'En attente',
      createdAt: row.created_at || row.date || new Date().toISOString(),
    }));
  }

  async saveOrder(order: Order): Promise<Order> {
    const row = {
      id: order.id,
      date: order.date,
      client_id: order.clientId,
      partner_id: order.partnerId || null,
      product_id: order.productId || null,
      product_name: order.productName,
      product_category: order.isPremium ? 'PREMIUM' : 'RÉCURRENT',
      quantity: order.quantity,
      unit_price: order.unitPrice,
      total_amount: order.totalAmount,
      order_status: order.orderStatus,
      commission_status: order.commissionStatus,
      commission_amount: order.commissionAmount,
      rank_at_order: order.partnerRankAtOrder || null,
      client_order_index: order.premiumRankForClient || 1,
      notes: '',
    };

    const { error } = await this.client.from('orders').insert(row);
    if (error) throw new Error(`Erreur Supabase saveOrder: ${error.message}`);
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const patch: any = {};
    if (updates.orderStatus !== undefined) patch.order_status = updates.orderStatus;
    if (updates.commissionStatus !== undefined) patch.commission_status = updates.commissionStatus;
    if (updates.commissionAmount !== undefined) patch.commission_amount = updates.commissionAmount;
    if (updates.quantity !== undefined) patch.quantity = updates.quantity;
    if (updates.unitPrice !== undefined) patch.unit_price = updates.unitPrice;
    if (updates.totalAmount !== undefined) patch.total_amount = updates.totalAmount;
    if (updates.isPremium !== undefined) patch.product_category = updates.isPremium ? 'PREMIUM' : 'RÉCURRENT';
    if (updates.partnerRankAtOrder !== undefined) patch.rank_at_order = updates.partnerRankAtOrder;
    if (updates.premiumRankForClient !== undefined) patch.client_order_index = updates.premiumRankForClient;

    const { error } = await this.client.from('orders').update(patch).eq('id', id);
    if (error) throw new Error(`Erreur Supabase updateOrder: ${error.message}`);

    const orders = await this.getOrders();
    return orders.find((o) => o.id === id) || (updates as Order);
  }

  async deleteOrder(id: string): Promise<boolean> {
    const { error } = await this.client.from('orders').delete().eq('id', id);
    if (error) throw new Error(`Erreur Supabase deleteOrder: ${error.message}`);
    return true;
  }

  // --- PAIEMENTS ---
  async getPayments(): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw new Error(`Erreur Supabase getPayments: ${error.message}`);
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      partnerId: row.partner_id,
      partnerCode: row.partner_id,
      partnerName: row.partner_id,
      amount: Number(row.amount),
      date: row.date,
      paymentMethod: (row.payment_method as any) || 'Mobile Money (MTN / Moov)',
      reference: row.reference || '',
      note: row.note || '',
      status: 'Effectué' as const,
      createdAt: row.created_at || row.date || new Date().toISOString(),
    }));
  }

  async savePayment(payment: Payment): Promise<Payment> {
    const row = {
      id: payment.id,
      partner_id: payment.partnerId,
      amount: payment.amount,
      date: payment.date,
      payment_method: payment.paymentMethod || 'Mobile Money (MTN / Moov)',
      reference: payment.reference || payment.id,
      note: payment.note || '',
    };

    const { error } = await this.client.from('payments').insert(row);
    if (error) throw new Error(`Erreur Supabase savePayment: ${error.message}`);
    return payment;
  }

  // --- PRODUITS ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`Erreur Supabase getProducts: ${error.message}`);
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      commissionType: row.commission_type,
      commissionNeo: Number(row.commission_neo),
      commissionAmbassador: Number(row.commission_ambassador),
      commissionExcellence: Number(row.commission_excellence),
      commissionSignature: Number(row.commission_signature),
      conditions: row.conditions || '',
      isPremium: row.category === 'PREMIUM',
    }));
  }

  async saveProduct(product: Product): Promise<Product> {
    const row = {
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      commission_type: product.commissionType,
      commission_neo: product.commissionNeo,
      commission_ambassador: product.commissionAmbassador,
      commission_excellence: product.commissionExcellence,
      commission_signature: product.commissionSignature,
      conditions: product.conditions || '',
      is_active: true,
    };

    const { error } = await this.client.from('products').upsert(row);
    if (error) throw new Error(`Erreur Supabase saveProduct: ${error.message}`);
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const patch: any = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.commissionType !== undefined) patch.commission_type = updates.commissionType;
    if (updates.commissionNeo !== undefined) patch.commission_neo = updates.commissionNeo;
    if (updates.commissionAmbassador !== undefined) patch.commission_ambassador = updates.commissionAmbassador;
    if (updates.commissionExcellence !== undefined) patch.commission_excellence = updates.commissionExcellence;
    if (updates.commissionSignature !== undefined) patch.commission_signature = updates.commissionSignature;
    if (updates.conditions !== undefined) patch.conditions = updates.conditions;

    const { error } = await this.client.from('products').update(patch).eq('id', id);
    if (error) throw new Error(`Erreur Supabase updateProduct: ${error.message}`);

    const prods = await this.getProducts();
    return prods.find((p) => p.id === id) || (updates as Product);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const { error } = await this.client.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw new Error(`Erreur Supabase deleteProduct: ${error.message}`);
    return true;
  }

  // --- VAGUES ---
  async getWaves(): Promise<WaveConfig[]> {
    const { data: waves, error } = await this.client
      .from('waves')
      .select('*, rank_thresholds(*)')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Erreur Supabase getWaves: ${error.message}`);
    if (!waves) return [];

    return waves.map((w: any) => {
      const thresholds = w.rank_thresholds || [];
      const amb = thresholds.find((t: any) => t.rank === 'Ambassador');
      const exc = thresholds.find((t: any) => t.rank === 'Excellence');
      const sig = thresholds.find((t: any) => t.rank === 'Signature');

      return {
        wave: w.name,
        ambassadorCmd: amb ? Number(amb.min_orders) : 8,
        ambassadorCa: amb ? Number(amb.min_ca) : 100000,
        excellenceCmd: exc ? Number(exc.min_orders) : 20,
        excellenceCa: exc ? Number(exc.min_ca) : 300000,
        signatureCmd: sig ? Number(sig.min_orders) : 50,
        signatureCa: sig ? Number(sig.min_ca) : 800000,
        active: Boolean(w.is_active),
      };
    });
  }

  async saveWave(wave: WaveConfig): Promise<WaveConfig> {
    // 1. Désactiver les autres si la nouvelle est active
    if (wave.active) {
      await this.client.from('waves').update({ is_active: false }).neq('name', wave.wave);
    }

    // 2. Insérer ou mettre à jour la vague
    const { data: insertedWave, error: waveErr } = await this.client
      .from('waves')
      .upsert({ name: wave.wave, is_active: wave.active, description: `Vague ${wave.wave}` })
      .select()
      .single();

    if (waveErr) throw new Error(`Erreur Supabase saveWave: ${waveErr.message}`);

    // 3. Insérer les seuils
    const thresholds = [
      { wave_id: insertedWave.id, rank: 'Neo', min_orders: 0, min_ca: 0, default_commission_rate: 0.06 },
      { wave_id: insertedWave.id, rank: 'Ambassador', min_orders: wave.ambassadorCmd, min_ca: wave.ambassadorCa, default_commission_rate: 0.08 },
      { wave_id: insertedWave.id, rank: 'Excellence', min_orders: wave.excellenceCmd, min_ca: wave.excellenceCa, default_commission_rate: 0.10 },
      { wave_id: insertedWave.id, rank: 'Signature', min_orders: wave.signatureCmd, min_ca: wave.signatureCa, default_commission_rate: 0.12 },
    ];

    await this.client.from('rank_thresholds').upsert(thresholds, { onConflict: 'wave_id,rank' });
    return wave;
  }

  async setActiveWave(waveName: string): Promise<WaveConfig[]> {
    await this.client.from('waves').update({ is_active: false }).neq('name', waveName);
    const { error } = await this.client.from('waves').update({ is_active: true }).eq('name', waveName);
    if (error) throw new Error(`Erreur Supabase setActiveWave: ${error.message}`);
    return this.getWaves();
  }

  // --- CONFIG SYSTÈME ---
  async getConfig(): Promise<SystemConfig> {
    const waves = await this.getWaves();
    const activeWave = waves.find((w) => w.active) || waves[0];

    const ambCmd = activeWave?.ambassadorCmd ?? 8;
    const ambCa = activeWave?.ambassadorCa ?? 100000;
    const excCmd = activeWave?.excellenceCmd ?? 20;
    const excCa = activeWave?.excellenceCa ?? 300000;
    const sigCmd = activeWave?.signatureCmd ?? 50;
    const sigCa = activeWave?.signatureCa ?? 800000;

    return {
      ranks: [
        { name: 'Neo', minCa: 0, minOrders: 0, commissionRate: 0.06 },
        { name: 'Ambassador', minCa: ambCa, minOrders: ambCmd, commissionRate: 0.08 },
        { name: 'Excellence', minCa: excCa, minOrders: excCmd, commissionRate: 0.1 },
        { name: 'Signature', minCa: sigCa, minOrders: sigCmd, commissionRate: 0.12 },
      ],
      waves,
      maxPremiumOrdersForCommission: 3,
      minimumPayment: 5000,
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
    };
  }

  async updateConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    return this.getConfig();
  }

  // --- LOGS & AUDIT ---
  async getLogs(): Promise<SystemLog[]> {
    const { data } = await this.client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) return [];
    return data.map((row: any) => ({
      id: String(row.id),
      timestamp: row.created_at,
      user: row.performed_by || 'Système',
      actionType: (row.action as LogActionType) || 'SYNC',
      description: row.details?.description || row.action || '',
      oldValue: row.details?.oldValue || '',
      newValue: row.details?.newValue || '',
    }));
  }

  async addLog(log: Omit<SystemLog, 'id' | 'timestamp'>): Promise<SystemLog> {
    const row = {
      entity_type: log.actionType.split('_')[1] || 'SYSTEM',
      entity_id: null,
      action: log.actionType,
      performed_by: log.user || 'Système',
      details: {
        description: log.description,
        oldValue: log.oldValue,
        newValue: log.newValue,
      },
    };

    const { data } = await this.client.from('audit_logs').insert(row).select().single();
    return {
      id: String(data?.id || `LOG-${Date.now()}`),
      timestamp: data?.created_at || new Date().toISOString(),
      user: log.user,
      actionType: log.actionType,
      description: log.description,
      oldValue: log.oldValue,
      newValue: log.newValue,
    };
  }

  async getSyncState(): Promise<SyncState> {
    return {
      status: 'SYNCHRONISE',
      lastSync: new Date().toISOString(),
      pendingCount: 0,
      errorCount: 0,
      errors: [],
    };
  }

  async triggerSync(): Promise<SyncState> {
    return this.getSyncState();
  }

  async resetToDefault(): Promise<void> {}
  async inspect(): Promise<SheetsInspectionResult | null> { return null; }
  setCredentials(): void {}
  setMode(): void {}
  getInspectionResult(): SheetsInspectionResult | null { return null; }
}
