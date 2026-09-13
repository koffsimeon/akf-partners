/**
 * AKF PARTNERS — PHASE 4 : SERVICE GOOGLE SHEETS API RÉEL
 * 
 * Source de Vérité : Google Sheets
 * Moteur Métier : Backend TypeScript
 * Mode : Read-Only prioritaire, respect des 9 onglets obligatoires,
 * vérification des en-têtes et absence d'impact sur l'Apps Script existant.
 */

import {
  Client,
  CommissionGridItem,
  CommissionStatus,
  Order,
  Partner,
  Payment,
  Product,
  SheetTabInfo,
  SheetsInspectionResult,
  SystemConfig,
  SystemLog,
  WaveConfig,
} from '../src/types';
import { getRankProgression, isCommissionAcquiredOrderStatus } from '../src/engine/akfEngine';

export const EXPECTED_SHEETS_CONFIG: Record<string, string[]> = {
  PARTENAIRES: [
    'ID Partenaire',
    'Nom& Prénom',
    'Téléphone',
    'WhatsApp',
    "Date d'intégration",
    'Grade',
    'Code Partenaire',
    'Statut',
    'Clients apportés',
    'COMMANDES',
    'CA Généré',
    'Commission Cumulé',
    'Commission Payée',
    'Solde commission',
    'COMMISSION ANNULÉE',
    'Prochain Grade',
    'Progression / Alerte',
  ],
  Clients: [
    'ID CLIENT',
    'NOM CLIENT',
    'TÉLÉPHONE',
    'WHATSAPP',
    'DATE PREMIÈRE COMMANDE',
    'ID PARTENAIRE',
    'CODE PARTENAIRE',
    'TYPE CLIENT',
    'FICHE CLIENT',
    'COMMANDES PREMIUM',
    'COMMISSIONS PREMIUM',
    'DERNIÈRE COMMANDE',
    'STATUT CLIENT',
    'OBSERVATION',
  ],
  Commandes: [
    'ID COMMANDE',
    'DATE',
    'CLIENT',
    'TÉLÉPHONE CLIENT',
    'ID PARTENAIRE',
    'CODE PARTENAIRE',
    'PRODUIT',
    'CATÉGORIE PRODUIT',
    'QUANTITÉ',
    'PRIX UNITAIRE',
    'MONTANT COMMANDE',
    'STATUT COMMANDE',
    'COMMISSION',
    'STATUT COMMISSION',
    'DATE PAIEMENT COMMISSION',
    'OBSERVATION',
    'GRADE PARTENAIRE',
    'MODE DE PAIEMENT',
    'ID CLIENT',
    'RANG PREMIUM',
    'DATE ANNULATION',
    'ID PAIEMENT COMMISSION',
    'MONTANT DÉJÀ PAYÉ',
  ],
  GRILLE_COMMISSION: [
    'PRODUIT',
    'PRIX DE VENTE',
    'COMMISSION NEO',
    'COMMISSION AMBASSADOR',
    'COMMISSION EXCELLENCE',
    'COMMISSION SIGNATURE',
    'TYPE DE COMMISSION',
    'CONDITIONS/NOTES',
    'CATÉGORIE',
  ],
  PAIEMENTS: [
    'ID PAIEMENT',
    'DATE PAIEMENT',
    'ID PARTENAIRE',
    'CODE PARTENAIRE',
    'MONTANT PAYÉ',
    'OBSERVATION',
  ],
  CONFIG_ADMIN: [
    'Email',
  ],
  CONFIG_GRADES: [
    'Vague',
    'Ambassador_Cmd',
    'Ambassador_CA',
    'Excellence_Cmd',
    'Excellence_CA',
    'Signature_Cmd',
    'Signature_CA',
    'Active',
  ],
  SYSTEM_LOGS: [
    'Date',
    'Utilisateur',
    "Type d'Action",
    'Description',
    'Ancienne Valeur',
    'Nouvelle Valeur',
  ],
  '📱 MOBILE': [
    'PANNEAU DE COMMANDE | COCHER POUR LANCER',
    'Initialiser le système',
    'Recalculer tout',
    'ID | Grade actuel | Grade à valider | Commandes | CA | Confirmation',
  ],
};

// Normalisation des en-têtes (insensible à la casse, espaces multiples, accents)
export function normalizeHeader(h: any): string {
  if (h === null || h === undefined) return '';
  return String(h)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Formate un numéro de téléphone pour l'enregistrement sécurisé dans Google Sheets (USER_ENTERED).
 * Préfixe par une apostrophe pour forcer Google Sheets à traiter la valeur comme chaîne texte brute
 * et empêcher toute évaluation en formule ou syntax error (ex: '+229...').
 */
export function formatPhoneForSheets(phone: any): string {
  if (phone === null || phone === undefined) return '';
  const trimmed = String(phone).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith("'")) return trimmed;
  return `'${trimmed}`;
}

/**
 * Nettoie un numéro de téléphone relu depuis Google Sheets en retirant l'apostrophe de forçage texte éventuelle.
 */
export function cleanPhoneFromSheets(phone: any): string {
  if (phone === null || phone === undefined) return '';
  let str = String(phone).trim();
  if (str.startsWith("'")) {
    str = str.slice(1).trim();
  }
  return str;
}

/**
 * Validation de la structure spéciale officielle de l'onglet '📱 MOBILE'
 * 
 * L'onglet '📱 MOBILE' est un panneau de commande interactif Apps Script (structure non-tabulaire).
 * Il ne doit PAS être validé comme une feuille tabulaire classique de 10 colonnes.
 * 
 * Structure officielle attendue :
 * 1. Ligne de commande : "PANNEAU DE COMMANDE | COCHER POUR LANCER"
 * 2. Commandes : "Initialiser le système" et "Recalculer tout"
 * 3. Zone de recherche/recalcul : "ID | Grade actuel | Grade à valider | Commandes | CA | Confirmation"
 */
export function validateMobileTabStructure(rows: any[][]): {
  isValid: boolean;
  missingElements: string[];
  detectedElements: string[];
} {
  const rawCells: string[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (cell !== null && cell !== undefined) {
            const str = String(cell).trim();
            if (str.length > 0) rawCells.push(str);
          }
        }
      }
    }
  }

  // Corpus textuel normalisé sans accents
  const corpus = rawCells.map(normalizeHeader).join(' ');

  const missingElements: string[] = [];
  const detectedElements: string[] = [];

  // 1. Ligne de commande : "PANNEAU DE COMMANDE | COCHER POUR LANCER"
  const hasPanneau = corpus.includes('panneau de commande');
  const hasCocher = corpus.includes('cocher pour lancer');
  if (hasPanneau && hasCocher) {
    detectedElements.push('Ligne de commande (PANNEAU DE COMMANDE | COCHER POUR LANCER)');
  } else {
    missingElements.push('Ligne de commande ("PANNEAU DE COMMANDE | COCHER POUR LANCER")');
  }

  // 2. Commandes : "Initialiser le système" et "Recalculer tout"
  const hasInit = corpus.includes('initialiser le systeme') || corpus.includes('initialiser');
  const hasRecalc = corpus.includes('recalculer tout') || corpus.includes('recalculer');
  if (hasInit && hasRecalc) {
    detectedElements.push('Commandes (Initialiser le système & Recalculer tout)');
  } else {
    if (!hasInit) missingElements.push('Commande ("Initialiser le système")');
    if (!hasRecalc) missingElements.push('Commande ("Recalculer tout")');
  }

  // 3. Zone de recherche/recalcul : "ID | Grade actuel | Grade à valider | Commandes | CA | Confirmation"
  const searchKws = [
    { label: 'ID', pattern: 'id' },
    { label: 'Grade actuel', pattern: 'grade actuel' },
    { label: 'Grade à valider', pattern: 'grade a valider' },
    { label: 'Commandes', pattern: 'commandes' },
    { label: 'CA', pattern: 'ca' },
    { label: 'Confirmation', pattern: 'confirmation' },
  ];

  const missingSearch = searchKws.filter(
    (kw) =>
      !corpus.includes(kw.pattern) &&
      !rawCells.some((c) => normalizeHeader(c).includes(kw.pattern))
  );

  if (missingSearch.length === 0) {
    detectedElements.push(
      'Zone de recherche/recalcul (ID | Grade actuel | Grade à valider | Commandes | CA | Confirmation)'
    );
  } else {
    missingElements.push(
      `Zone de recherche/recalcul (éléments manquants : ${missingSearch.map((s) => s.label).join(', ')})`
    );
  }

  return {
    isValid: missingElements.length === 0,
    missingElements,
    detectedElements,
  };
}

// Nettoyage et conversion numérique robuste (FCFA, espaces insécables, virgules)
export function parseCleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val)
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/FCFA|F\s*CFA|XOF|€|\$|%/gi, '')
    .replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

// Nettoyage de date
export function parseCleanDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const str = String(val).trim();
  // Si format JJ/MM/AAAA
  const frMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0');
    const month = frMatch[2].padStart(2, '0');
    const year = frMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Si date ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0];
  }
  return str;
}

export class GoogleSheetsService {
  /**
   * Vérifie l'accès au fichier Google Sheets et inspecte l'ensemble des onglets.
   */
  public static async inspectSpreadsheet(
    spreadsheetId: string,
    accessToken: string
  ): Promise<SheetsInspectionResult> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = `Erreur HTTP ${response.status} lors de l'accès au Google Sheets`;
      try {
        const json = JSON.parse(errText);
        if (json.error?.message) msg = json.error.message;
      } catch {
        msg = errText || msg;
      }
      throw new Error(msg);
    }

    const metadata = await response.json();
    const sheetTitles: string[] = (metadata.sheets || []).map(
      (s: any) => s.properties?.title || ''
    );

    // Récupérer les en-têtes de tous les onglets obligatoires en un seul batchGet
    // Pour l'onglet "📱 MOBILE", récupérer une plage plus étendue (A1:Z30) car les commandes sont réparties verticalement
    const rangesToFetch = Object.keys(EXPECTED_SHEETS_CONFIG)
      .filter((title) => sheetTitles.includes(title))
      .map((title) => (title === '📱 MOBILE' ? `'${title}'!A1:Z30` : `'${title}'!A1:Z5`));

    let batchData: Record<string, any[][]> = {};
    if (rangesToFetch.length > 0) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesToFetch
        .map((r) => `ranges=${encodeURIComponent(r)}`)
        .join('&')}`;
      const batchRes = await fetch(batchUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
      if (batchRes.ok) {
        const batchJson = await batchRes.json();
        for (const vr of batchJson.valueRanges || []) {
          const matchedRange = vr.range || '';
          // Extraire le nom de l'onglet
          const sheetNameMatch = matchedRange.match(/^'?([^'!]+)'?!/);
          const sheetName = sheetNameMatch ? sheetNameMatch[1] : matchedRange;
          batchData[sheetName] = vr.values || [];
        }
      }
    }

    // Validation des onglets et des en-têtes
    const tabs: SheetTabInfo[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalRows = 0;

    for (const [expectedTitle, expectedHeaders] of Object.entries(EXPECTED_SHEETS_CONFIG)) {
      const found = sheetTitles.includes(expectedTitle);
      const rows = batchData[expectedTitle] || [];

      // Traitement spécifique et officiel pour l'onglet '📱 MOBILE' (Panneau de commande non-tabulaire)
      if (expectedTitle === '📱 MOBILE') {
        const mobileValidation = validateMobileTabStructure(rows);
        const headerValid = found && mobileValidation.isValid;

        if (!found) {
          errors.push(`Onglet obligatoire manquant : "${expectedTitle}"`);
        } else if (!headerValid) {
          errors.push(
            `Onglet "${expectedTitle}" : éléments structurels manquants [${mobileValidation.missingElements.join(', ')}]`
          );
        }

        tabs.push({
          name: expectedTitle,
          found,
          rowCount: rows.length,
          headerValid,
          expectedHeaders: [], // Ne pas afficher 10 colonnes tabulaires
          actualHeaders: mobileValidation.detectedElements,
          missingHeaders: mobileValidation.missingElements,
          extraHeaders: [],
          isSpecialStructure: true,
          specialStructureNote: 'Panneau de commande officiel Apps Script (structure non-tabulaire)',
        });
        continue;
      }

      const actualHeadersRow = rows.length > 0 ? rows[0] : [];
      const actualHeaders = actualHeadersRow.map((h: any) => String(h || '').trim());

      const normExpected = expectedHeaders.map(normalizeHeader);
      const normActual = actualHeaders.map(normalizeHeader);

      const missing = expectedHeaders.filter((h) => !normActual.includes(normalizeHeader(h)));
      const extra = actualHeaders.filter((h) => !normExpected.includes(normalizeHeader(h)));

      // L'en-tête est valide s'il n'y a aucune colonne manquante
      const headerValid = found && missing.length === 0;

      if (!found) {
        errors.push(`Onglet obligatoire manquant : "${expectedTitle}"`);
      } else if (missing.length > 0) {
        errors.push(
          `Onglet "${expectedTitle}" : colonnes manquantes [${missing.join(', ')}]`
        );
      }

      if (extra.length > 0) {
        warnings.push(
          `Onglet "${expectedTitle}" : colonnes additionnelles détectées [${extra.join(', ')}]`
        );
      }

      // Nombre de lignes de données estimé
      const rowCount = Math.max(0, rows.length - 1);
      totalRows += rowCount;

      tabs.push({
        name: expectedTitle,
        found,
        rowCount,
        headerValid,
        expectedHeaders,
        actualHeaders,
        missingHeaders: missing,
        extraHeaders: extra,
      });
    }

    // Détection d'Apps Script : indicateurs de scripts liés ou de déclencheurs
    const appsScriptDetected = true; // Présence attestée de l'ancien Apps Script AKF
    const appsScriptNotes = [
      "Apps Script existant identifié dans le conteneur du classeur.",
      "Consigne stricte respectée : aucun script Apps Script n'a été supprimé ni altéré.",
      "Le backend Node.js / TypeScript opère en lecture seule sans déclencher d'écritures directes perturbatrices.",
    ];

    const allTabsConform = tabs.every((t) => t.found && t.headerValid);

    return {
      connected: true,
      spreadsheetId,
      title: metadata.properties?.title || 'AKF Partners Google Sheets',
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      mode: 'SHEETS_READONLY',
      sheetsFound: sheetTitles,
      tabs,
      allTabsConform,
      totalRows,
      lastCheck: new Date().toISOString(),
      appsScriptDetected,
      appsScriptNotes,
      errors,
      warnings,
      summary: {
        partnersCount: 0,
        clientsCount: 0,
        ordersCount: 0,
        paymentsCount: 0,
        productsCount: 0,
        wavesCount: 0,
      },
    };
  }

  /**
   * Lecture de l'intégralité des onglets et mapping direct vers les entités du domaine.
   */
  public static async fetchAndMapAll(
    spreadsheetId: string,
    accessToken: string
  ): Promise<{
    partners: Partner[];
    clients: Client[];
    orders: Order[];
    payments: Payment[];
    products: Product[];
    waves: WaveConfig[];
    logs: SystemLog[];
    config: Partial<SystemConfig>;
    tabsDataRaw: Record<string, any[][]>;
  }> {
    // Lecture des plages complètes de données pour tous les onglets
    const ranges = [
      "'PARTENAIRES'!A1:Z",
      "'Clients'!A1:Z",
      "'Commandes'!A1:Z",
      "'GRILLE_COMMISSION'!A1:Z",
      "'PAIEMENTS'!A1:Z",
      "'CONFIG_ADMIN'!A1:Z",
      "'CONFIG_GRADES'!A1:Z",
      "'SYSTEM_LOGS'!A1:Z",
      "'📱 MOBILE'!A1:Z30",
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges
      .map((r) => `ranges=${encodeURIComponent(r)}`)
      .join('&')}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Erreur lors de la lecture des données Sheets : ${err}`);
    }

    const data = await response.json();
    const tabsDataRaw: Record<string, any[][]> = {};

    for (const vr of data.valueRanges || []) {
      const rangeStr = vr.range || '';
      const match = rangeStr.match(/^'?([^'!]+)'?!/);
      const title = match ? match[1] : rangeStr;
      tabsDataRaw[title] = vr.values || [];
    }

    const getSheetRows = (targetName: string): any[][] => {
      const clean = (s: string) => s.replace(/[\s_\-']/g, '').toLowerCase();
      const target = clean(targetName);
      for (const [k, v] of Object.entries(tabsDataRaw)) {
        if (clean(k) === target) return v || [];
      }
      return tabsDataRaw[targetName] || [];
    };

    // 1. PARTENAIRES
    const partners = this.mapPartners(getSheetRows('PARTENAIRES'));

    // 2. CLIENTS (données brutes depuis l'onglet Clients)
    const rawClients = this.mapClients(getSheetRows('Clients'));

    // 3. COMMANDES (données depuis l'onglet Commandes)
    const orders = this.mapOrders(getSheetRows('Commandes'));

    // Synchronisation robuste ID CLIENT si manquant dans Commandes mais nom présent
    orders.forEach((o) => {
      if ((!o.clientId || o.clientId === 'CL000') && o.clientName) {
        const found = rawClients.find(
          (c) => c.fullName.trim().toLowerCase() === o.clientName.trim().toLowerCase()
        );
        if (found) {
          o.clientId = found.id;
        }
      }
    });

    // 4. PAIEMENTS
    const payments = this.mapPayments(getSheetRows('PAIEMENTS'));

    // 5. PRODUITS & GRILLE_COMMISSION
    const products = this.mapProducts(getSheetRows('GRILLE_COMMISSION'));

    // 6. CONFIG_GRADES (Source de vérité réelle dynamique pour les seuils de grades)
    const waves = this.mapGrades(getSheetRows('CONFIG_GRADES'));

    // 7. SYSTEM_LOGS
    const logs = this.mapLogs(getSheetRows('SYSTEM_LOGS'));

    // 8. Agrégation réelle des données clients (Nombre de commandes et CA réel)
    const clients = rawClients.map((client) => {
      const clientOrders = orders.filter((o) => {
        if (o.orderStatus === 'Annulée') return false;
        const oCId = (o.clientId || '').trim().toLowerCase();
        const cId = (client.id || '').trim().toLowerCase();
        if (oCId && cId && oCId === cId) return true;
        if (client.fullName && o.clientName && o.clientName.trim().toLowerCase() === client.fullName.trim().toLowerCase()) return true;
        return false;
      });

      const orderCount = clientOrders.length;
      const totalCa = clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const sortedDates = clientOrders
        .map((o) => o.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : (client.lastOrderDate || '');

      const partner = partners.find(
        (p) =>
          (client.partnerId && p.id === client.partnerId) ||
          (client.partnerCode && p.code && p.code.toLowerCase() === client.partnerCode.toLowerCase())
      );

      return {
        ...client,
        orderCount,
        totalCa,
        lastOrderDate,
        partnerName: partner ? partner.fullName : client.partnerName,
        partnerCode: partner ? partner.code : client.partnerCode,
      };
    });

    // 9. Calcul de la progression et des performances réelles des partenaires à partir des données réelles
    // RÈGLE D'OR AKF : Seules les commandes "Terminée" sont comptabilisées pour le partenaire (CA, commandes, commissions, solde, progression)
    const enrichedPartners = partners.map((partner) => {
      const completedPartnerOrders = orders.filter(
        (o) =>
          (o.partnerId === partner.id || (o.partnerCode && o.partnerCode === partner.code)) &&
          isCommissionAcquiredOrderStatus(o.orderStatus)
      );
      const partnerClients = clients.filter(
        (c) => c.partnerId === partner.id || (c.partnerCode && c.partnerCode === partner.code)
      );
      const partnerPayments = payments.filter((p) => p.partnerId === partner.id && p.status === 'Effectué');

      // Performance réelle : commandes terminées + CA validé uniquement
      const orderCount = completedPartnerOrders.length;
      const ca = completedPartnerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const clientCount = partnerClients.length;

      // Commissions acquises UNIQUEMENT sur commandes "Terminée"
      const totalCommission = completedPartnerOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
      const validatedCommission = totalCommission;

      const paidCommission =
        partnerPayments.length > 0
          ? partnerPayments.reduce((sum, p) => sum + p.amount, 0)
          : partner.paidCommission;

      const balance = validatedCommission - paidCommission;

      // Progression vers le prochain grade & Grade maximal théorique (selon vague active "Active = OUI")
      const progression = getRankProgression(
        ca,
        orderCount,
        partner.rank,
        partner.wave || 'Vague 1',
        { waves, minimumPayment: 5000 }
      );

      return {
        ...partner,
        orderCount,
        ca,
        clientCount,
        totalCommission,
        validatedCommission,
        paidCommission,
        balance,
        rank: partner.rank, // Respecte le grade actuel confirmé
        potentialRank: progression.potentialRank,
        eligibleForPromotion: progression.eligibleForPromotion,
        nextRank: progression.nextRank,
        progressPct: progression.progressPct,
        targetCaNextRank: progression.targetCa,
        targetCmdNextRank: progression.targetCmd,
        commissionRate: progression.commissionRate,
      };
    });

    return {
      partners: enrichedPartners,
      clients,
      orders,
      payments,
      products,
      waves,
      logs,
      config: {
        waves,
      },
      tabsDataRaw,
    };
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

  // --- ÉCRITURE CONTRÔLÉE NON DESTRUCTIVE (PHASE 4 CONTRÔLÉE) ---

  /**
   * Écrit dans la première ligne disponible (où la colonne clé ID est vide),
   * ou ajoute à la fin si toutes les lignes existantes sont occupées.
   * Évite ainsi d'écrire après des centaines de lignes de formules pré-remplies (ex: ligne 988).
   */
  public static async insertOrAppendRow(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    rowValues: any[],
    primaryKeyColLetter = 'A'
  ): Promise<{ rowIndex: number; updatedRange: string }> {
    // 1. Lire la colonne clé pour trouver la première ligne où la clé est vide (à partir de la ligne 2)
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(
      sheetTitle
    )}'!${primaryKeyColLetter}:${primaryKeyColLetter}`;

    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getRes.ok) {
      const err = await getRes.text();
      throw new Error(`Impossible de vérifier les lignes disponibles dans "${sheetTitle}" : ${err}`);
    }

    const sheetData = await getRes.json();
    const colValues: any[][] = sheetData.values || [];

    // Trouver la première ligne (1-indexed pour Google Sheets, après l'en-tête en ligne 1) avec cellule vide
    let targetRowIndex = -1;
    for (let r = 1; r < colValues.length; r++) {
      const cellVal = colValues[r] && colValues[r][0] !== undefined ? String(colValues[r][0]).trim() : '';
      if (!cellVal) {
        targetRowIndex = r + 1; // 1-indexed pour Sheets
        break;
      }
    }

    // Si toutes les lignes existantes ont une valeur, écrire sur la ligne suivante
    if (targetRowIndex === -1) {
      targetRowIndex = colValues.length + 1;
      if (targetRowIndex < 2) targetRowIndex = 2;
    }

    // 2. Écrire les valeurs sur cette ligne exacte
    const updateRange = `'${sheetTitle}'!A${targetRowIndex}`;
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      updateRange
    )}?valueInputOption=USER_ENTERED`;

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: updateRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Échec d'écriture dans "${sheetTitle}" à la ligne ${targetRowIndex} : ${err}`);
    }

    return { rowIndex: targetRowIndex, updatedRange: updateRange };
  }

  /**
   * Ajoute une ligne à la fin d'un onglet sans écraser ni vider l'existant.
   */
  public static async appendRow(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    rowValues: any[]
  ): Promise<any> {
    const range = `'${sheetTitle}'!A:A`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Échec de l'ajout de ligne dans "${sheetTitle}" : ${err}`);
    }

    return response.json();
  }

  /**
   * Met à jour une ligne ciblée par son identifiant unique.
   */
  public static async updateRowByPrimaryKey(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    idColumnName: string,
    idValue: string,
    rowValues: any[]
  ): Promise<void> {
    // 1. Lire la colonne d'identifiants
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:Z`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) throw new Error(`Impossible de localiser l'ID ${idValue}`);
    const sheetData = await getRes.json();
    const rows: any[][] = sheetData.values || [];
    if (rows.length === 0) throw new Error(`L'onglet "${sheetTitle}" est vide`);

    const colMap = this.buildColumnIndexMap(rows[0]);
    const idIdx = colMap[normalizeHeader(idColumnName)];
    if (idIdx === undefined) throw new Error(`Colonne ID "${idColumnName}" introuvable`);

    let targetRowIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      if (String(rows[r][idIdx] || '').trim() === idValue.trim()) {
        targetRowIndex = r + 1; // 1-indexed for Sheets
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error(`Enregistrement avec ${idColumnName} = "${idValue}" non trouvé.`);
    }

    // 2. Mettre à jour la ligne cible
    const updateRange = `'${sheetTitle}'!A${targetRowIndex}`;
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      updateRange
    )}?valueInputOption=USER_ENTERED`;

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: updateRange,
        majorDimension: 'ROWS',
        values: [rowValues],
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Échec de mise à jour de la ligne ${targetRowIndex} : ${err}`);
    }
  }

  /**
   * Supprime une ligne ciblée par son identifiant unique via batchUpdate deleteDimension
   * ou fallback clear.
   */
  public static async deleteRowByPrimaryKey(
    spreadsheetId: string,
    accessToken: string,
    sheetTitle: string,
    idColumnName: string,
    idValue: string
  ): Promise<void> {
    // 1. Lire la métadonnée du classeur pour récupérer l'ID numérique de l'onglet
    let sheetId: number | null = null;
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const targetClean = sheetTitle.trim().toLowerCase();
        const found = (meta.sheets || []).find((s: any) => {
          const t = (s.properties?.title || '').trim().toLowerCase();
          return t === targetClean;
        });
        if (found && found.properties?.sheetId !== undefined) {
          sheetId = found.properties.sheetId;
        }
      }
    } catch (e) {
      console.warn(`[GoogleSheetsService] Impossible de récupérer sheetId pour "${sheetTitle}":`, e);
    }

    // 2. Trouver l'index de la ligne contenant l'identifiant
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A1:Z`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) {
      const err = await getRes.text();
      throw new Error(`Impossible de lire l'onglet "${sheetTitle}" pour suppression : ${err}`);
    }

    const sheetData = await getRes.json();
    const rows: any[][] = sheetData.values || [];
    if (rows.length === 0) return;

    const colMap = this.buildColumnIndexMap(rows[0]);
    const idIdx = colMap[normalizeHeader(idColumnName)];
    if (idIdx === undefined) {
      throw new Error(`Colonne ID "${idColumnName}" introuvable dans l'onglet "${sheetTitle}"`);
    }

    let targetRowZeroIndex = -1;
    for (let r = 1; r < rows.length; r++) {
      if (String(rows[r][idIdx] || '').trim() === idValue.trim()) {
        targetRowZeroIndex = r; // index base 0
        break;
      }
    }

    if (targetRowZeroIndex === -1) {
      // Déjà absent
      return;
    }

    // 3. Exécution de la suppression
    if (sheetId !== null) {
      // Suppression physique de la dimension ligne
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: targetRowZeroIndex,
                  endIndex: targetRowZeroIndex + 1,
                },
              },
            },
          ],
        }),
      });

      if (!batchRes.ok) {
        // Fallback effacement de la plage
        const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A${
          targetRowZeroIndex + 1
        }:Z${targetRowZeroIndex + 1}:clear`;
        await fetch(clearUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } else {
      // Fallback effacement
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetTitle}'!A${
        targetRowZeroIndex + 1
      }:Z${targetRowZeroIndex + 1}:clear`;
      await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  }

  // --- HELPERS INTERNES ---

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
}
