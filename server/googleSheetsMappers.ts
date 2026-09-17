import {
  Client,
  CommissionGridItem,
  CommissionStatus,
  Order,
  Partner,
  Payment,
  Product,
  SystemConfig,
  SystemLog,
  WaveConfig,
} from "../src/types";
import { getRankProgression, isCommissionAcquiredOrderStatus } from "../src/engine/akfEngine";
import {
  normalizeHeader,
  cleanPhoneFromSheets,
  parseCleanNumber,
  parseCleanDate,
} from "./googleSheetsConfig";

export class GoogleSheetsMappers {
  private static buildColumnIndexMap(headerRow: any[] = []): Record<string, number> {
    const map: Record<string, number> = {};
    for (let i = 0; i < headerRow.length; i++) {
      const h = normalizeHeader(headerRow[i]);
      if (h) map[h] = i;
    }
    return map;
  }

  private static getCell(row: any[], colMap: Record<string, number>, colName: string): any {
    const idx = colMap[normalizeHeader(colName)];
    if (idx === undefined || idx >= row.length) return null;
    return row[idx];
  }

  /**
   * Mapping de l'onglet PARTENAIRES
   */
  public static mapPartners(rows: any[][]): Partner[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const partners: Partner[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = String(this.getCell(row, colIdx, 'ID Partenaire') || '').trim();
      if (!id) continue;

      const code = String(this.getCell(row, colIdx, 'Code Partenaire') || id).trim();
      const fullName = String(this.getCell(row, colIdx, 'Nom& Prénom') || '').trim();
      const phone = cleanPhoneFromSheets(this.getCell(row, colIdx, 'Téléphone'));
      const whatsapp = cleanPhoneFromSheets(this.getCell(row, colIdx, 'WhatsApp')) || undefined;
      const createdAt = parseCleanDate(this.getCell(row, colIdx, "Date d'intégration"));
      const rankRaw = String(this.getCell(row, colIdx, 'Grade') || 'Neo').trim();
      const rank = (['Neo', 'Ambassador', 'Excellence', 'Signature'].includes(rankRaw)
        ? rankRaw
        : 'Neo') as Partner['rank'];
      const statusRaw = String(this.getCell(row, colIdx, 'Statut') || 'Actif').trim();
      const status = statusRaw.toLowerCase().includes('inactif') ? 'Inactif' : 'Actif';

      const clientCount = parseCleanNumber(this.getCell(row, colIdx, 'Clients apportés'));
      const orderCount = parseCleanNumber(this.getCell(row, colIdx, 'COMMANDES'));
      const ca = parseCleanNumber(this.getCell(row, colIdx, 'CA Généré'));
      const totalCommission = parseCleanNumber(this.getCell(row, colIdx, 'Commission Cumulé'));
      const paidCommission = parseCleanNumber(this.getCell(row, colIdx, 'Commission Payée'));
      const balance = parseCleanNumber(this.getCell(row, colIdx, 'Solde commission'));
      const nextRankRaw = String(this.getCell(row, colIdx, 'Prochain Grade') || '').trim();
      const nextRank = (['Ambassador', 'Excellence', 'Signature'].includes(nextRankRaw)
        ? nextRankRaw
        : null) as Partner['nextRank'];

      // Canonical phone
      const phoneCanonical = phone.replace(/\D/g, '');

      partners.push({
        id,
        code,
        fullName: fullName || id,
        phone,
        phoneCanonical,
        whatsapp,
        rank,
        wave: 'Vague 1',
        status,
        createdAt,
        ca,
        clientCount,
        orderCount,
        totalCommission,
        validatedCommission: totalCommission, // Dans le tableau, solde = cumulé - payé
        paidCommission,
        balance,
        progressPct: 0,
        nextRank,
        targetCaNextRank: 0,
        targetCmdNextRank: 0,
      });
    }

    return partners;
  }

  /**
   * Mapping de l'onglet Clients
   */
  public static mapClients(rows: any[][]): Client[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const clients: Client[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = String(this.getCell(row, colIdx, 'ID CLIENT') || '').trim();
      if (!id) continue;

      const fullName = String(this.getCell(row, colIdx, 'NOM CLIENT') || '').trim();
      const phone = cleanPhoneFromSheets(this.getCell(row, colIdx, 'TÉLÉPHONE'));
      const whatsapp = cleanPhoneFromSheets(this.getCell(row, colIdx, 'WHATSAPP')) || undefined;
      const partnerId = String(this.getCell(row, colIdx, 'ID PARTENAIRE') || '').trim() || null;
      const partnerCode = String(this.getCell(row, colIdx, 'CODE PARTENAIRE') || '').trim() || null;
      const typeClientRaw = String(this.getCell(row, colIdx, 'TYPE CLIENT') || '').trim();
      const clientType = typeClientRaw.toUpperCase().includes('PARTENAIRE') || partnerId
        ? 'PARTENAIRE'
        : 'DIRECT AKF';

      const createdAt = parseCleanDate(this.getCell(row, colIdx, 'DATE PREMIÈRE COMMANDE'));
      const lastOrderDate = parseCleanDate(this.getCell(row, colIdx, 'DERNIÈRE COMMANDE'));
      const phoneCanonical = phone.replace(/\D/g, '');

      clients.push({
        id,
        fullName: fullName || id,
        phone,
        phoneCanonical,
        whatsapp,
        partnerId,
        partnerCode,
        partnerName: null,
        clientType,
        orderCount: 0,
        totalCa: 0,
        lastOrderDate,
        createdAt,
      });
    }

    return clients;
  }

  /**
   * Mapping de l'onglet Commandes
   */
  public static mapOrders(rows: any[][]): Order[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const orders: Order[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = String(this.getCell(row, colIdx, 'ID COMMANDE') || '').trim();
      if (!id) continue;

      const date = parseCleanDate(this.getCell(row, colIdx, 'DATE'));
      const clientName = String(
        this.getCell(row, colIdx, 'CLIENT') ||
        this.getCell(row, colIdx, 'NOM CLIENT') ||
        this.getCell(row, colIdx, 'Nom Client') ||
        this.getCell(row, colIdx, 'Client') ||
        ''
      ).trim();
      const clientId = String(
        this.getCell(row, colIdx, 'ID CLIENT') ||
        this.getCell(row, colIdx, 'ID Client') ||
        this.getCell(row, colIdx, 'CODE CLIENT') ||
        this.getCell(row, colIdx, 'Code Client') ||
        this.getCell(row, colIdx, 'ID_CLIENT') ||
        ''
      ).trim();
      const partnerId = String(this.getCell(row, colIdx, 'ID PARTENAIRE') || '').trim() || null;
      const partnerCode = String(this.getCell(row, colIdx, 'CODE PARTENAIRE') || '').trim() || null;
      const partnerRankAtOrder = (this.getCell(row, colIdx, 'GRADE PARTENAIRE') as any) || null;
      const productName = String(this.getCell(row, colIdx, 'PRODUIT') || '').trim();
      const categoryRaw = String(
        this.getCell(row, colIdx, 'CATÉGORIE PRODUIT') ||
        this.getCell(row, colIdx, 'CATÉGORIE') ||
        ''
      ).trim().toUpperCase();
      let category: 'PREMIUM' | 'RÉCURRENT' = 'RÉCURRENT';
      if (categoryRaw === 'PREMIUM' || categoryRaw.startsWith('PREM')) {
        category = 'PREMIUM';
      } else {
        category = 'RÉCURRENT';
      }
      const quantity = Math.max(1, parseCleanNumber(this.getCell(row, colIdx, 'QUANTITÉ'), 1));
      const unitPrice = parseCleanNumber(this.getCell(row, colIdx, 'PRIX UNITAIRE'));
      const totalAmount = parseCleanNumber(this.getCell(row, colIdx, 'MONTANT COMMANDE'), unitPrice * quantity);
      const orderStatus = String(this.getCell(row, colIdx, 'STATUT COMMANDE') || 'Confirmée').trim() as any;
      const rawCommissionAmount = parseCleanNumber(this.getCell(row, colIdx, 'COMMISSION'));
      const rawCommissionStatus = String(this.getCell(row, colIdx, 'STATUT COMMISSION') || 'En attente').trim() as any;

      // RÈGLE D'OR AKF :
      // "En attente" -> 0 commission acquise
      // "Confirmée" -> 0 commission acquise
      // "Terminée" -> calcul et comptabilisation de la commission
      // "Annulée" -> 0 commission
      const isCompleted = isCommissionAcquiredOrderStatus(orderStatus);
      let commissionAmount = 0;
      let commissionStatus: CommissionStatus = 'En attente';

      if (orderStatus === 'Annulée') {
        commissionAmount = 0;
        commissionStatus = 'Annulée';
      } else if (isCompleted) {
        commissionAmount = rawCommissionAmount;
        commissionStatus = rawCommissionStatus === 'Payée' ? 'Payée' : (rawCommissionAmount > 0 ? 'Validée' : 'Non éligible');
      } else {
        // En attente ou Confirmée : 0 commission acquise
        commissionAmount = 0;
        commissionStatus = 'En attente';
      }

      const isPremium = category === 'PREMIUM';
      const premiumRankRaw = this.getCell(row, colIdx, 'RANG PREMIUM');
      const premiumRankForClient = premiumRankRaw ? parseInt(String(premiumRankRaw), 10) : null;

      orders.push({
        id,
        date,
        clientId: clientId || 'CL000',
        clientName: clientName || clientId,
        partnerId,
        partnerCode,
        partnerName: null,
        partnerRankAtOrder,
        productId: 'PRD-' + productName.slice(0, 8),
        productName: productName || 'Produit AKF',
        quantity,
        unitPrice,
        totalAmount,
        isPremium,
        premiumRankForClient,
        commissionRate: totalAmount > 0 ? commissionAmount / totalAmount : 0,
        commissionAmount,
        orderStatus,
        commissionStatus,
        createdAt: date,
      });
    }

    return orders;
  }

  /**
   * Mapping de l'onglet PAIEMENTS
   */
  public static mapPayments(rows: any[][]): Payment[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const payments: Payment[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = String(this.getCell(row, colIdx, 'ID PAIEMENT') || '').trim();
      if (!id) continue;

      const date = parseCleanDate(this.getCell(row, colIdx, 'DATE PAIEMENT'));
      const partnerId = String(this.getCell(row, colIdx, 'ID PARTENAIRE') || '').trim();
      const partnerCode = String(this.getCell(row, colIdx, 'CODE PARTENAIRE') || partnerId).trim();
      const amount = parseCleanNumber(this.getCell(row, colIdx, 'MONTANT PAYÉ'));
      const note = String(this.getCell(row, colIdx, 'OBSERVATION') || '').trim();

      payments.push({
        id,
        partnerId,
        partnerCode,
        partnerName: partnerCode,
        date,
        amount,
        paymentMethod: 'Mobile Money (MTN / Moov)',
        reference: id,
        note,
        status: 'Effectué',
        createdAt: date,
      });
    }

    return payments;
  }

  /**
   * Mapping de l'onglet GRILLE_COMMISSION
   */
  public static mapProducts(rows: any[][]): Product[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const products: Product[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = String(this.getCell(row, colIdx, 'PRODUIT') || '').trim();
      if (!name) continue;

      const rawPrice =
        this.getCell(row, colIdx, 'PRIX DE VENTE') ??
        this.getCell(row, colIdx, 'PRIX UNITAIRE') ??
        this.getCell(row, colIdx, 'PRIX') ??
        this.getCell(row, colIdx, 'PRIX VENTE') ??
        this.getCell(row, colIdx, 'TARIF');
      const price = parseCleanNumber(rawPrice);

      const commissionNeo = parseCleanNumber(
        this.getCell(row, colIdx, 'COMMISSION NEO') ??
        this.getCell(row, colIdx, 'NEO')
      );
      const commissionAmbassador = parseCleanNumber(
        this.getCell(row, colIdx, 'COMMISSION AMBASSADOR') ??
        this.getCell(row, colIdx, 'AMBASSADOR')
      );
      const commissionExcellence = parseCleanNumber(
        this.getCell(row, colIdx, 'COMMISSION EXCELLENCE') ??
        this.getCell(row, colIdx, 'EXCELLENCE')
      );
      const commissionSignature = parseCleanNumber(
        this.getCell(row, colIdx, 'COMMISSION SIGNATURE') ??
        this.getCell(row, colIdx, 'SIGNATURE')
      );
      const rawCommissionType = String(
        this.getCell(row, colIdx, 'TYPE DE COMMISSION') ??
        this.getCell(row, colIdx, 'TYPE COMMISSION') ??
        this.getCell(row, colIdx, 'TYPE') ??
        ''
      ).trim();
      const commissionType = rawCommissionType.toLowerCase().includes('forfait') ? 'Forfaitaire' : 'Pourcentage';
      const conditions = String(
        this.getCell(row, colIdx, 'CONDITIONS/NOTES') ??
        this.getCell(row, colIdx, 'CONDITIONS') ??
        this.getCell(row, colIdx, 'NOTES') ??
        ''
      ).trim();
      const rawCategory = String(
        this.getCell(row, colIdx, 'CATÉGORIE') ??
        this.getCell(row, colIdx, 'CATEGORIE') ??
        ''
      ).trim().toUpperCase();
      let category: 'PREMIUM' | 'RÉCURRENT' = 'RÉCURRENT';
      if (rawCategory === 'PREMIUM' || rawCategory.startsWith('PREM')) {
        category = 'PREMIUM';
      } else {
        category = 'RÉCURRENT';
      }
      const isPremium = category === 'PREMIUM';

      products.push({
        id: `PRD${String(r).padStart(3, '0')}`,
        name,
        price,
        isPremium,
        category,
        commissionNeo,
        commissionAmbassador,
        commissionExcellence,
        commissionSignature,
        commissionType,
        conditions,
      });
    }

    return products;
  }

  /**
   * Mapping de l'onglet CONFIG_GRADES
   */
  public static mapGrades(rows: any[][]): WaveConfig[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const waves: WaveConfig[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const wave = String(this.getCell(row, colIdx, 'Vague') || `Vague ${r}`).trim();
      if (!wave) continue;

      // Seuils officiels AKF :
      // Ambassador : 8 commandes ET 100 000 FCFA
      // Excellence : 20 commandes ET 300 000 FCFA
      // Signature : 50 commandes ET 800 000 FCFA
      const ambassadorCmd = parseCleanNumber(this.getCell(row, colIdx, 'Ambassador_Cmd'), 8);
      const ambassadorCa = parseCleanNumber(this.getCell(row, colIdx, 'Ambassador_CA'), 100000);
      const excellenceCmd = parseCleanNumber(this.getCell(row, colIdx, 'Excellence_Cmd'), 20);
      const excellenceCa = parseCleanNumber(this.getCell(row, colIdx, 'Excellence_CA'), 300000);
      const signatureCmd = parseCleanNumber(this.getCell(row, colIdx, 'Signature_Cmd'), 50);
      const signatureCa = parseCleanNumber(this.getCell(row, colIdx, 'Signature_CA'), 800000);

      // Prise en charge dynamique de "Active = OUI" (insensible à la casse)
      const activeRaw = this.getCell(row, colIdx, 'Active');
      const activeStr = String(activeRaw || '').trim().toUpperCase();
      const active =
        activeRaw === true ||
        activeStr === 'OUI' ||
        activeStr === 'YES' ||
        activeStr === 'TRUE' ||
        activeStr === '1' ||
        activeStr === 'ACTIF' ||
        activeStr === 'ACTIVE';

      waves.push({
        wave,
        ambassadorCmd,
        ambassadorCa,
        excellenceCmd,
        excellenceCa,
        signatureCmd,
        signatureCa,
        active,
      });
    }

    return waves;
  }

  /**
   * Mapping de l'onglet SYSTEM_LOGS
   */
  public static mapLogs(rows: any[][]): SystemLog[] {
    if (rows.length < 2) return [];
    const headerRow = rows[0];
    const colIdx = this.buildColumnIndexMap(headerRow);

    const logs: SystemLog[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const date = parseCleanDate(this.getCell(row, colIdx, 'Date'));
      const user = String(this.getCell(row, colIdx, 'Utilisateur') || 'admin@akfpartners.bj').trim();
      const actionType = String(this.getCell(row, colIdx, "Type d'Action") || 'SYNC').trim() as any;
      const description = String(this.getCell(row, colIdx, 'Description') || '').trim();
      const oldValue = String(this.getCell(row, colIdx, 'Ancienne Valeur') || '').trim();
      const newValue = String(this.getCell(row, colIdx, 'Nouvelle Valeur') || '').trim();

      logs.push({
        id: `LOG${String(r).padStart(3, '0')}`,
        timestamp: date,
        user,
        actionType,
        description,
        oldValue,
        newValue,
      });
    }

    return logs;
  }
}
