/**
 * AKF PARTNERS — CONFIGURATION DES ONGLETS & UTILITAIRES D'EN-TÊTE GOOGLE SHEETS
 */

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
 * Nettoyage et conversion numérique robuste (FCFA, espaces insécables, virgules)
 */
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

/**
 * Nettoyage et conversion de date (JJ/MM/AAAA ou ISO)
 */
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

/**
 * Validation de la structure spéciale officielle de l'onglet 'MOBILE'
 * 
 * L'onglet 'MOBILE' est un panneau de commande interactif Apps Script (structure non-tabulaire).
 */
