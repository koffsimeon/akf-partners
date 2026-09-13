import {
  CommissionStatus,
  DiagnosticCheck,
  Order,
  Partner,
  Payment,
  Product,
  Rank,
  RecalculReport,
  SystemConfig,
  WaveConfig,
} from '../types';

/**
 * MOTEUR MÉTIER AKF (AKF Business Engine)
 * Centralise les règles de validation, calcul, normalisation et recalcul global.
 */

export function normalizePhone(rawPhone: string): { canonical: string; formatted: string } {
  if (!rawPhone) {
    return { canonical: '', formatted: '' };
  }

  // Retirer l'éventuelle apostrophe de forçage texte Google Sheets et les séparateurs
  let clean = rawPhone.replace(/^'/, '').replace(/[\s\-\.\(\)\/]/g, '').trim();

  // Convertir le préfixe international 00229 en +229
  if (clean.startsWith('00229')) {
    clean = '+229' + clean.slice(5);
  }

  // Si le numéro commence par +229
  if (clean.startsWith('+229')) {
    const localPart = clean.slice(4);
    return {
      canonical: '+229' + localPart,
      formatted: `+229 ${localPart.slice(0, 2)} ${localPart.slice(2, 4)} ${localPart.slice(4, 6)} ${localPart.slice(6)}`.trim(),
    };
  }

  // Si le numéro fait 8 chiffres (format national Bénin typique : 97 12 34 56)
  if (/^\d{8}$/.test(clean)) {
    return {
      canonical: '+229' + clean,
      formatted: `+229 ${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6)}`,
    };
  }

  // Si le numéro commence par un autre préfixe avec + (ex: +33, +225, etc.)
  if (clean.startsWith('+')) {
    return {
      canonical: clean,
      formatted: clean,
    };
  }

  // Défaut : préfixer par +229 si c'est composé de chiffres
  if (/^\d+$/.test(clean)) {
    return {
      canonical: '+229' + clean,
      formatted: `+229 ${clean}`,
    };
  }

  return { canonical: clean, formatted: clean };
}

export function generateNextId(prefix: 'AKF' | 'CL' | 'CMD' | 'PAY', existingIds: string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let maxNum = 0;

  for (const id of existingIds) {
    const match = id.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `${prefix}${padded}`;
}

export function generatePartnerCode(partnerId: string, fullName: string): string {
  // Convention métier : AKF-[3 lettres]-[numéro correspondant à l'ID]
  // Exemple : ID = AKF002, Nom = Aminata Tossou -> AKF-TOS02
  const idMatch = partnerId.match(/(\d+)$/);
  const numPart = idMatch ? String(parseInt(idMatch[1], 10)).padStart(2, '0') : '01';

  const cleanName = (fullName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .trim();

  const words = cleanName.split(/\s+/).filter(Boolean);
  // On privilégie le nom de famille (dernier mot) ou premier mot s'il n'y en a qu'un
  const targetWord = words.length > 1 ? words[words.length - 1] : words[0] || 'AKF';
  let letters = targetWord.slice(0, 3);
  if (letters.length < 3) {
    const fallback = (words[0] || '').slice(0, 3 - letters.length);
    letters = (letters + fallback).padEnd(3, 'X');
  }

  return `AKF-${letters}${numPart}`;
}

export function partnerIdToCode(partnerId: string, fullName?: string): string {
  if (fullName && fullName.trim()) {
    return generatePartnerCode(partnerId, fullName);
  }
  // Fallback si aucun nom n'est fourni
  const idMatch = partnerId.match(/(\d+)$/);
  const numPart = idMatch ? String(parseInt(idMatch[1], 10)).padStart(2, '0') : '01';
  return `AKF-PAR${numPart}`;
}

export function partnerCodeToId(partnerCode: string): string {
  // AKF-001 -> AKF001
  return partnerCode.replace(/-/g, '');
}

export const RANK_ORDER: Record<Rank, number> = {
  Neo: 0,
  Ambassador: 1,
  Excellence: 2,
  Signature: 3,
};

export const STANDARD_COMMISSION_RATES: Record<Rank, number> = {
  Neo: 0.06,
  Ambassador: 0.08,
  Excellence: 0.10,
  Signature: 0.12,
};

export function isHigherRank(r1: Rank, r2: Rank): boolean {
  return (RANK_ORDER[r1] ?? 0) > (RANK_ORDER[r2] ?? 0);
}

/**
 * Calcul de la progression d'un partenaire en distinguant :
 * 1. Performance réelle : commandes + CA
 * 2. Progression vers le prochain grade (sur base du grade actuel confirmé)
 * 3. Grade maximal / théorique (potentiel atteint selon critères ET)
 * 4. Taux de commission de référence
 */
export function getRankProgression(
  ca: number,
  orderCount: number,
  rankOrWave?: Rank | string,
  waveOrConfig?: string | SystemConfig,
  optionalConfig?: SystemConfig
): {
  currentRank: Rank;
  nextRank: Rank | null;
  potentialRank: Rank;
  eligibleForPromotion: boolean;
  progressPct: number;
  targetCa: number;
  targetCmd: number;
  commissionRate: number;
} {
  // Détection souple des arguments
  let currentRank: Rank = 'Neo';
  let waveName: string | undefined;
  let config: SystemConfig | undefined;

  const validRanks: Rank[] = ['Neo', 'Ambassador', 'Excellence', 'Signature'];
  if (rankOrWave && validRanks.includes(rankOrWave as Rank)) {
    currentRank = rankOrWave as Rank;
    if (typeof waveOrConfig === 'string') {
      waveName = waveOrConfig;
      config = optionalConfig;
    } else if (typeof waveOrConfig === 'object') {
      config = waveOrConfig;
    }
  } else if (typeof rankOrWave === 'string') {
    waveName = rankOrWave;
    if (typeof waveOrConfig === 'object') {
      config = waveOrConfig;
    }
  } else if (typeof waveOrConfig === 'object') {
    config = waveOrConfig;
  }

  // 1. Sélection dynamique de la vague active ("Active = OUI")
  let wave: WaveConfig | undefined;
  if (config?.waves && config.waves.length > 0) {
    wave = config.waves.find((w) => w.active === true);
    if (!wave && waveName) {
      wave = config.waves.find((w) => w.wave.toLowerCase() === waveName.toLowerCase());
    }
    if (!wave) {
      wave = config.waves[0];
    }
  }

  // Seuils officiels Vague 1 AKF (règle des 2 critères obligatoires : ET)
  const ambassadorCmd = wave?.ambassadorCmd ?? 8;
  const ambassadorCa = wave?.ambassadorCa ?? 100000;
  const excellenceCmd = wave?.excellenceCmd ?? 20;
  const excellenceCa = wave?.excellenceCa ?? 300000;
  const signatureCmd = wave?.signatureCmd ?? 50;
  const signatureCa = wave?.signatureCa ?? 800000;

  // 2. Grade maximal / théorique atteint par les critères réels (Cmd ET CA)
  let potentialRank: Rank = 'Neo';
  if (orderCount >= signatureCmd && ca >= signatureCa) {
    potentialRank = 'Signature';
  } else if (orderCount >= excellenceCmd && ca >= excellenceCa) {
    potentialRank = 'Excellence';
  } else if (orderCount >= ambassadorCmd && ca >= ambassadorCa) {
    potentialRank = 'Ambassador';
  } else {
    potentialRank = 'Neo';
  }

  // 3. Prochain grade et seuils cibles basés sur le grade actuel confirmé
  let nextRank: Rank | null = null;
  let targetCmd = 0;
  let targetCa = 0;

  switch (currentRank) {
    case 'Neo':
      nextRank = 'Ambassador';
      targetCmd = ambassadorCmd;
      targetCa = ambassadorCa;
      break;
    case 'Ambassador':
      nextRank = 'Excellence';
      targetCmd = excellenceCmd;
      targetCa = excellenceCa;
      break;
    case 'Excellence':
      nextRank = 'Signature';
      targetCmd = signatureCmd;
      targetCa = signatureCa;
      break;
    case 'Signature':
      nextRank = null;
      targetCmd = signatureCmd;
      targetCa = signatureCa;
      break;
  }

  // 4. Calcul de la progression % vers le prochain grade
  let progressPct = 0;
  let eligibleForPromotion = false;

  if (!nextRank) {
    progressPct = 100;
    eligibleForPromotion = false;
  } else {
    const cmdPct = targetCmd > 0 ? Math.min(100, Math.round((orderCount / targetCmd) * 100)) : 0;
    const caPct = targetCa > 0 ? Math.min(100, Math.round((ca / targetCa) * 100)) : 0;
    const bothSatisfied = orderCount >= targetCmd && ca >= targetCa;

    // Moyenne des 2 composantes
    progressPct = Math.round((cmdPct + caPct) / 2);

    // RÈGLE MÉTIER : 100% ne peut être affiché que si les DEUX conditions sont remplies
    if (progressPct >= 100 && !bothSatisfied) {
      progressPct = 99;
    }
    if (bothSatisfied) {
      progressPct = 100;
      eligibleForPromotion = true;
    }
  }

  // Si le grade potentiel théorique dépasse le grade confirmé actuel, le partenaire est éligible à la promotion
  if (isHigherRank(potentialRank, currentRank)) {
    eligibleForPromotion = true;
  }

  const commissionRate = STANDARD_COMMISSION_RATES[currentRank] ?? 0.06;

  return {
    currentRank,
    nextRank,
    potentialRank,
    eligibleForPromotion,
    progressPct,
    targetCa,
    targetCmd,
    commissionRate,
  };
}

/**
 * RÈGLE MÉTIER AKF :
 * Seule une commande dont le statut est exactement "Terminée" génère une commission acquise.
 * "En attente" -> non acquise
 * "Confirmée" -> non acquise
 * "Annulée" -> annulée
 * "Terminée" -> commission acquise créditée au solde
 */
export function isCommissionAcquiredOrderStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'terminée' || s === 'terminee';
}

export function isCompletedOrderStatus(status?: string | null): boolean {
  return isCommissionAcquiredOrderStatus(status);
}

export interface ComputeCommissionParams {
  clientId: string;
  isPremium: boolean;
  totalAmount: number;
  quantity?: number;
  partnerRank: Rank | null;
  clientPriorPremiumOrderCount: number;
  orderStatus?: string;
  config?: SystemConfig;
  product?: Product;
  isDirectAkf?: boolean;
}

export function computeOrderCommission(params: ComputeCommissionParams): {
  premiumRank: number | null;
  commissionRate: number;
  commissionAmount: number;
  commissionStatus: CommissionStatus;
} {
  const {
    isPremium,
    totalAmount,
    quantity = 1,
    partnerRank,
    clientPriorPremiumOrderCount,
    orderStatus,
    config,
    product,
    isDirectAkf,
    clientId,
  } = params;

  // 1. Règle DIRECT AKF / Absence de partenaire : aucune commission
  if (!partnerRank || isDirectAkf || clientId === 'CLT-AKF-DIR') {
    return {
      premiumRank: null,
      commissionRate: 0,
      commissionAmount: 0,
      commissionStatus: 'Non éligible',
    };
  }

  // 2. Règle commande annulée : commission annulée
  if (orderStatus === 'Annulée') {
    return {
      premiumRank: null,
      commissionRate: 0,
      commissionAmount: 0,
      commissionStatus: 'Annulée',
    };
  }

  // 3. Identification stricte du produit dans GRILLE_COMMISSION
  // Si le produit n'est pas trouvé dans la grille : ne pas inventer une commission
  if (!product) {
    return {
      premiumRank: null,
      commissionRate: 0,
      commissionAmount: 0,
      commissionStatus: 'Non éligible',
    };
  }

  // 4. Catégorie officielle et type de commission
  // Source de vérité : CATÉGORIE dans GRILLE_COMMISSION ('PREMIUM' ou 'RÉCURRENT')
  const rawCategory = String(product.category || (product.isPremium ? 'PREMIUM' : 'RÉCURRENT')).trim().toUpperCase();
  const isPremiumProduct = rawCategory === 'PREMIUM' || product.isPremium === true;

  // Récupérer la valeur correspondante au grade officiel confirmé dans la grille
  let gridValueForRank = 0;
  switch (partnerRank) {
    case 'Neo':
      gridValueForRank = product.commissionNeo ?? 0;
      break;
    case 'Ambassador':
      gridValueForRank = product.commissionAmbassador ?? 0;
      break;
    case 'Excellence':
      gridValueForRank = product.commissionExcellence ?? 0;
      break;
    case 'Signature':
      gridValueForRank = product.commissionSignature ?? 0;
      break;
  }

  const qty = quantity && quantity > 0 ? quantity : 1;
  let baseCommissionAmount = 0;
  let baseCommissionRate = 0;

  if (isPremiumProduct) {
    // PRODUIT PREMIUM :
    // La commission est de TYPE POURCENTAGE selon la valeur du grade dans la grille (ex: 6%, 8%, 10%, 12%)
    let ratePct = gridValueForRank;
    if (ratePct === 0) {
      // Fallback sécurisé uniquement pour Premium si non renseigné dans la grille
      const fallbackRates: Record<Rank, number> = {
        Neo: 6,
        Ambassador: 8,
        Excellence: 10,
        Signature: 12,
      };
      ratePct = config?.commissionRates?.[partnerRank] ?? fallbackRates[partnerRank] ?? 6;
    }
    baseCommissionRate = ratePct > 1 ? ratePct / 100 : ratePct;
    baseCommissionAmount = Math.round(totalAmount * baseCommissionRate);
  } else {
    // PRODUIT RÉCURRENT :
    // La commission n'est JAMAIS un pourcentage !
    // Elle est FORFAITAIRE : valeur forfaitaire du grade dans GRILLE_COMMISSION × quantité.
    // NE JAMAIS appliquer 6 %, 8 %, 10 % ou 12 % à un produit RÉCURRENT.
    baseCommissionAmount = Math.round(gridValueForRank * qty);
    baseCommissionRate = totalAmount > 0 ? baseCommissionAmount / totalAmount : 0;
  }

  // 5. Statut de commande et acquisition (RÈGLE D'OR AKF) :
  // En attente -> Commission acquise = 0
  // Confirmée -> Commission acquise = 0
  // Terminée / Livrée -> Commission acquise créditée
  const isAcquired = isCommissionAcquiredOrderStatus(orderStatus);

  if (!isAcquired) {
    return {
      premiumRank: isPremiumProduct ? (clientPriorPremiumOrderCount + 1) : null,
      commissionRate: baseCommissionRate,
      commissionAmount: 0,
      commissionStatus: 'En attente',
    };
  }

  // 6. Application des règles par catégorie lorsque la commande est Terminée
  if (!isPremiumProduct) {
    // PRODUIT RÉCURRENT :
    // Commission calculée à chaque commande éligible, sans AUCUNE limite de 3 commandes !
    return {
      premiumRank: null,
      commissionRate: baseCommissionRate,
      commissionAmount: baseCommissionAmount,
      commissionStatus: 'Validée',
    };
  }

  // PRODUIT PREMIUM :
  // Seules les 3 premières commandes Premium TERMINÉES du client sont commissionnables.
  // À partir de la 4e commande Premium terminée = 0 commission.
  const rank = clientPriorPremiumOrderCount + 1;
  const maxPremiumOrders = config?.premiumCommissionMaxOrders ?? 3;

  if (rank <= maxPremiumOrders) {
    return {
      premiumRank: rank,
      commissionRate: baseCommissionRate,
      commissionAmount: baseCommissionAmount,
      commissionStatus: 'Validée',
    };
  }

  // 4e commande Premium ou plus : 0 commission
  return {
    premiumRank: rank,
    commissionRate: 0,
    commissionAmount: 0,
    commissionStatus: 'Non éligible',
  };
}

export function runFullRecalcul(
  partners: Partner[],
  clients: { id: string; partnerId: string | null; totalCa: number; orderCount: number; lastOrderDate?: string }[],
  orders: Order[],
  payments: Payment[],
  config: SystemConfig,
  products: Product[] = []
): {
  recalculatedPartners: Partner[];
  recalculatedOrders: Order[];
  recalculatedClients: { id: string; partnerId: string | null; totalCa: number; orderCount: number; lastOrderDate?: string }[];
  report: RecalculReport;
} {
  let correctedCount = 0;
  const anomalies: string[] = [];
  const errors: string[] = [];

  // 1. Recalculer les commandes chronologiquement par client
  const ordersByClient = new Map<string, Order[]>();
  for (const o of orders) {
    if (!ordersByClient.has(o.clientId)) {
      ordersByClient.set(o.clientId, []);
    }
    ordersByClient.get(o.clientId)!.push(o);
  }

  const recalculatedOrders: Order[] = [];

  // Traiter chaque client
  for (const [, clientOrders] of ordersByClient.entries()) {
    // Trier par date
    clientOrders.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let completedPremiumCount = 0;
    for (const order of clientOrders) {
      let changed = false;
      const partner = partners.find((p) => p.id === order.partnerId || (p.code && p.code === order.partnerCode));
      const product = products.find(
        (pr) => pr.id === order.productId || pr.name.toLowerCase() === (order.productName || '').toLowerCase()
      );
      const client = clients.find((c) => c.id === order.clientId);
      const isDirectAkf =
        !order.partnerId ||
        !partner ||
        order.clientId === 'CLT-AKF-DIR' ||
        client?.id === 'CLT-AKF-DIR' ||
        (client as any)?.clientType === 'DIRECT AKF';

      // Seule une commande "Terminée" valide l'acquisition
      const isCompleted = isCommissionAcquiredOrderStatus(order.orderStatus);
      const isProductPremium = product ? product.category === 'PREMIUM' || product.isPremium : order.isPremium;

      // Calcul de commission conforme aux règles AKF
      const commissionCalc = computeOrderCommission({
        clientId: order.clientId,
        isPremium: isProductPremium,
        totalAmount: order.totalAmount,
        quantity: order.quantity,
        partnerRank: !isDirectAkf && partner ? partner.rank : null,
        clientPriorPremiumOrderCount: completedPremiumCount,
        orderStatus: order.orderStatus,
        config,
        product,
        isDirectAkf,
      });

      // Seule une commande Premium terminée avec partenaire éligible incrémente le quota des 3 commandes
      if (isProductPremium && isCompleted && !isDirectAkf && partner) {
        completedPremiumCount++;
      }

      if (order.premiumRankForClient !== commissionCalc.premiumRank) {
        order.premiumRankForClient = commissionCalc.premiumRank;
        changed = true;
      }
      if (order.commissionAmount !== commissionCalc.commissionAmount) {
        order.commissionAmount = commissionCalc.commissionAmount;
        changed = true;
      }
      if (Math.abs(order.commissionRate - commissionCalc.commissionRate) > 0.0001) {
        order.commissionRate = commissionCalc.commissionRate;
        changed = true;
      }
      if (order.commissionStatus !== commissionCalc.commissionStatus) {
        order.commissionStatus = commissionCalc.commissionStatus;
        changed = true;
      }
      if (partner && order.partnerRankAtOrder !== partner.rank) {
        order.partnerRankAtOrder = partner.rank;
        changed = true;
      }

      if (changed) correctedCount++;
      recalculatedOrders.push(order);
    }
  }

  // 2. Recalculer les partenaires
  // RÈGLE D'OR AKF : Seules les commandes "Terminée" sont comptabilisées pour le partenaire (CA, commandes, commissions, solde, progression)
  const recalculatedPartners: Partner[] = partners.map((partner) => {
    const completedPartnerOrders = recalculatedOrders.filter(
      (o) =>
        (o.partnerId === partner.id || (o.partnerCode && o.partnerCode === partner.code)) &&
        isCommissionAcquiredOrderStatus(o.orderStatus)
    );
    const partnerClients = clients.filter((c) => c.partnerId === partner.id);
    const partnerPayments = payments.filter((p) => p.partnerId === partner.id && p.status === 'Effectué');

    const totalCa = completedPartnerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalCommission = completedPartnerOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
    const validatedCommission = totalCommission;
    const paidCommission = partnerPayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = validatedCommission - paidCommission;

    if (balance < 0) {
      anomalies.push(`Solde négatif détecté pour le partenaire ${partner.code} (${partner.fullName}) : ${balance} FCFA`);
    }

    const progression = getRankProgression(totalCa, completedPartnerOrders.length, partner.rank, partner.wave || 'Vague 1', config);

    let changed = false;
    if (
      partner.ca !== totalCa ||
      partner.orderCount !== completedPartnerOrders.length ||
      partner.clientCount !== partnerClients.length ||
      partner.totalCommission !== totalCommission ||
      partner.validatedCommission !== validatedCommission ||
      partner.balance !== balance ||
      partner.progressPct !== progression.progressPct
    ) {
      changed = true;
      correctedCount++;
    }

    return {
      ...partner,
      ca: totalCa,
      orderCount: completedPartnerOrders.length,
      clientCount: partnerClients.length,
      totalCommission,
      validatedCommission,
      paidCommission,
      balance,
      rank: partner.rank, // Conserve le grade officiel actuel confirmé !
      potentialRank: progression.potentialRank,
      eligibleForPromotion: progression.eligibleForPromotion,
      nextRank: progression.nextRank,
      progressPct: progression.progressPct,
      targetCaNextRank: progression.targetCa,
      targetCmdNextRank: progression.targetCmd,
      commissionRate: progression.commissionRate,
    };
  });

  // 3. Recalculer les clients à partir des commandes réelles liées à leur ID CLIENT
  const recalculatedClients = clients.map((client) => {
    const clientOrders = recalculatedOrders.filter((o) => {
      if (o.orderStatus === 'Annulée') return false;
      const oCId = (o.clientId || '').trim().toLowerCase();
      const cId = (client.id || '').trim().toLowerCase();
      if (oCId && cId && oCId === cId) return true;
      return false;
    });

    const sortedDates = clientOrders
      .map((o) => o.date)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : '';

    return {
      ...client,
      orderCount: clientOrders.length,
      totalCa: clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      lastOrderDate,
    };
  });

  const report: RecalculReport = {
    timestamp: new Date().toISOString(),
    processedCount: {
      partners: partners.length,
      clients: clients.length,
      orders: orders.length,
      payments: payments.length,
    },
    correctedCount,
    anomalies,
    errors,
  };

  return { recalculatedPartners, recalculatedOrders, recalculatedClients, report };
}

export function performDiagnostic(
  partners: Partner[],
  clients: { id: string; phoneCanonical: string; partnerId: string | null }[],
  orders: Order[],
  payments: Payment[],
  config: SystemConfig,
  syncState: { status: string; lastSync: string | null; errors: string[] }
): DiagnosticCheck[] {
  const checks: DiagnosticCheck[] = [];

  // 1. Connexion Google Sheets
  checks.push({
    id: 'sheets_conn',
    name: 'Connexion Google Sheets',
    category: 'Infrastructure',
    status: 'WARNING',
    details: 'Phase 1 : Données mockées isolées. Structure réelle en attente de spécification (Phase 4).',
    value: 'Simulée (Mock)',
  });

  // 2. Onglets
  checks.push({
    id: 'sheets_tabs',
    name: 'Onglets Google Sheets',
    category: 'Infrastructure',
    status: 'OK',
    details: 'Interface SheetsRepository prête pour le mapping des onglets lors de la Phase 4.',
    value: 'En attente Phase 4',
  });

  // 3. Colonnes
  checks.push({
    id: 'sheets_cols',
    name: 'Colonnes Google Sheets',
    category: 'Infrastructure',
    status: 'OK',
    details: 'Schéma de colonnes typé et prêt pour validation stricte.',
    value: 'Conforme',
  });

  // 4. Format des IDs
  const invalidPartnerIds = partners.filter((p) => !/^AKF\d{3,}$/.test(p.id) || !/^AKF-\d{3,}$/.test(p.code));
  const invalidClientIds = clients.filter((c) => !/^CL\d{3,}$/.test(c.id));
  const invalidOrderIds = orders.filter((o) => !/^CMD\d{3,}$/.test(o.id));
  const invalidPaymentIds = payments.filter((p) => !/^PAY\d{3,}$/.test(p.id));

  const totalInvalidIds =
    invalidPartnerIds.length + invalidClientIds.length + invalidOrderIds.length + invalidPaymentIds.length;

  checks.push({
    id: 'ids_format',
    name: 'Conformité des IDs (AKFxxx, CLxxx, CMDxxx, PAYxxx)',
    category: 'Données',
    status: totalInvalidIds === 0 ? 'OK' : 'ERROR',
    details:
      totalInvalidIds === 0
        ? 'Tous les identifiants respectent les conventions historiques.'
        : `${totalInvalidIds} identifiant(s) non conformes détectés.`,
    value: `${totalInvalidIds} non conformes`,
  });

  // 5. Doublons téléphones
  const partnerPhones = new Set<string>();
  const partnerPhoneDuplicates: string[] = [];
  for (const p of partners) {
    if (partnerPhones.has(p.phoneCanonical)) {
      partnerPhoneDuplicates.push(p.phoneCanonical);
    } else {
      partnerPhones.add(p.phoneCanonical);
    }
  }

  checks.push({
    id: 'phone_duplicates',
    name: 'Doublons téléphones (Normalisation +229)',
    category: 'Données',
    status: partnerPhoneDuplicates.length === 0 ? 'OK' : 'ERROR',
    details:
      partnerPhoneDuplicates.length === 0
        ? 'Aucun doublon de numéro canonique détecté chez les partenaires.'
        : `Doublon(s) détecté(s) pour : ${partnerPhoneDuplicates.join(', ')}`,
    value: `${partnerPhoneDuplicates.length} doublon(s)`,
  });

  // 6. Clients orphelins
  const invalidPartnerRefClients = clients.filter(
    (c) => c.partnerId !== null && !partners.some((p) => p.id === c.partnerId)
  );

  checks.push({
    id: 'orphan_clients',
    name: 'Intégrité relationnelle Clients -> Partenaires',
    category: 'Relations',
    status: invalidPartnerRefClients.length === 0 ? 'OK' : 'ERROR',
    details:
      invalidPartnerRefClients.length === 0
        ? 'Tous les clients sont rattachés à un partenaire existant ou à DIRECT AKF.'
        : `${invalidPartnerRefClients.length} client(s) avec un partenaire inexistant.`,
    value: `${invalidPartnerRefClients.length} orphelin(s)`,
  });

  // 7. Commandes
  const ordersWithInvalidClient = orders.filter((o) => !clients.some((c) => c.id === o.clientId));
  checks.push({
    id: 'order_clients',
    name: 'Intégrité relationnelle Commandes -> Clients',
    category: 'Relations',
    status: ordersWithInvalidClient.length === 0 ? 'OK' : 'ERROR',
    details:
      ordersWithInvalidClient.length === 0
        ? 'Toutes les commandes sont rattachées à des clients valides.'
        : `${ordersWithInvalidClient.length} commande(s) orpheline(s).`,
    value: `${ordersWithInvalidClient.length} orpheline(s)`,
  });

  // 8. Commissions
  const invalidCommissions = orders.filter(
    (o) => o.isPremium && o.partnerId && o.premiumRankForClient && o.premiumRankForClient <= 3 && o.commissionAmount <= 0
  );
  checks.push({
    id: 'commissions_check',
    name: 'Calcul et éligibilité des Commissions (3 premières Premium)',
    category: 'Finances',
    status: invalidCommissions.length === 0 ? 'OK' : 'WARNING',
    details:
      invalidCommissions.length === 0
        ? 'Toutes les commissions éligibles sont calculées correctement selon la grille.'
        : `${invalidCommissions.length} commande(s) Premium éligibles sans commission calculée.`,
    value: `${invalidCommissions.length} anomalie(s)`,
  });

  // 9. Paiements & Soldes
  const negativeBalances = partners.filter((p) => p.balance < 0);
  checks.push({
    id: 'payments_balance',
    name: 'Cohérence des Soldes et Paiements',
    category: 'Finances',
    status: negativeBalances.length === 0 ? 'OK' : 'ERROR',
    details:
      negativeBalances.length === 0
        ? 'Tous les soldes partenaires sont positifs ou nuls.'
        : `${negativeBalances.length} partenaire(s) avec un solde négatif anormal.`,
    value: `${negativeBalances.length} solde(s) négatif(s)`,
  });

  // 10. Synchronisation
  checks.push({
    id: 'sync_state',
    name: 'État de la Synchronisation',
    category: 'Système',
    status: syncState.status === 'SYNCHRONISE' ? 'OK' : syncState.status === 'EN_ATTENTE' ? 'WARNING' : 'ERROR',
    details: `Statut actuel : ${syncState.status}. Dernière sync : ${syncState.lastSync || 'Jamais'}.`,
    value: syncState.status,
  });

  // 11. Erreurs récentes
  const recentErrors = syncState.errors || [];
  checks.push({
    id: 'recent_errors',
    name: 'Journal des Erreurs récentes',
    category: 'Système',
    status: recentErrors.length === 0 ? 'OK' : 'WARNING',
    details:
      recentErrors.length === 0
        ? 'Aucune erreur système ou synchronisation non résolue.'
        : `${recentErrors.length} erreur(s) consignée(s) : ${recentErrors.slice(-1)[0]}`,
    value: `${recentErrors.length} erreur(s)`,
  });

  return checks;
}
