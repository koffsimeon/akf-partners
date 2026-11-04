import {
  computeOrderCommission,
  getRankProgression,
} from '../src/engine/akfEngine';
import { Product, SystemConfig, WaveConfig } from '../src/types';

/**
 * Suite de tests automatisés : Catalogue dynamique de produits et Vagues de grades
 * Conforme au DATR AKF Partners :
 * 1. Produits dynamiques (% vs Forfaitaire unitaire)
 * 2. Produit Récurrent (quantité * commission forfaitaire)
 * 3. Vagues dynamiques (application des seuils de la vague active sans redémarrage de code)
 * 4. Détection d'éligibilité promotionnelle selon les seuils configurés
 */
async function runDynamicCatalogTests() {
  console.log('========================================================');
  console.log('🧪 DÉMARRAGE DES TESTS : CATALOGUE DYNAMIQUE & VAGUES');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ SUCCÈS : ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ ÉCHEC : ${testName}`);
      if (details) console.error(`    Détail : ${details}`);
      failed++;
    }
  }

  // 1. Produit Récurrent Forfaitaire dynamique (ex: Atō’lèçé à 150 FCFA)
  const productAtolece: Product = {
    id: 'PRD-ATOLECE',
    name: 'Atō’lèçé',
    price: 1500,
    isPremium: false,
    category: 'RÉCURRENT',
    commissionType: 'Forfaitaire',
    commissionNeo: 150,
    commissionAmbassador: 150,
    commissionExcellence: 150,
    commissionSignature: 150,
    conditions: '150 FCFA par unité commandée',
  };

  const resAtolece = computeOrderCommission({
    clientId: 'CL001',
    isPremium: false,
    totalAmount: 1500 * 35,
    quantity: 35,
    partnerRank: 'Ambassador',
    clientPriorPremiumOrderCount: 0,
    orderStatus: 'Terminée',
    product: productAtolece,
  });

  assert(
    resAtolece.commissionAmount === 5250,
    '1. Produit Récurrent : 35 unités d’Atō’lèçé à 150 FCFA donnent exactement 5 250 FCFA',
    `Reçu: ${resAtolece.commissionAmount}`
  );
  assert(
    resAtolece.commissionStatus === 'Validée',
    '2. Statut commission acquis (Validée) sur commande Terminée'
  );

  // 2. Nouveau produit Récurrent créé dynamiquement avec 200 FCFA / unité
  const productCustom: Product = {
    id: 'PRD-CUSTOM-01',
    name: 'Jus Naturel Baobab AKF',
    price: 1000,
    isPremium: false,
    category: 'RÉCURRENT',
    commissionType: 'Forfaitaire',
    commissionNeo: 200,
    commissionAmbassador: 200,
    commissionExcellence: 200,
    commissionSignature: 200,
  };

  const resCustom = computeOrderCommission({
    clientId: 'CL002',
    isPremium: false,
    totalAmount: 1000 * 12,
    quantity: 12,
    partnerRank: 'Neo',
    clientPriorPremiumOrderCount: 0,
    orderStatus: 'Terminée',
    product: productCustom,
  });

  assert(
    resCustom.commissionAmount === 2400,
    '3. Nouveau produit dynamique : 12 jus à 200 FCFA forfaitaire = 2 400 FCFA',
    `Reçu: ${resCustom.commissionAmount}`
  );

  // 3. Produit Premium : vérification du plafond des 3 premières commandes
  const productPremium: Product = {
    id: 'PRD-VIP',
    name: 'Pack Événementiel',
    price: 50000,
    isPremium: true,
    category: 'PREMIUM',
    commissionType: 'Pourcentage',
    commissionNeo: 6,
    commissionAmbassador: 8,
    commissionExcellence: 10,
    commissionSignature: 12,
  };

  const resPrem1 = computeOrderCommission({
    clientId: 'CL001',
    isPremium: true,
    totalAmount: 50000,
    partnerRank: 'Ambassador',
    clientPriorPremiumOrderCount: 0, // 1ère commande
    orderStatus: 'Terminée',
    product: productPremium,
  });
  assert(
    resPrem1.commissionAmount === 4000 && resPrem1.premiumRank === 1,
    '4. 1ère commande Premium : 8% de 50 000 = 4 000 FCFA'
  );

  const resPrem4 = computeOrderCommission({
    clientId: 'CL001',
    isPremium: true,
    totalAmount: 50000,
    partnerRank: 'Ambassador',
    clientPriorPremiumOrderCount: 3, // 4ème commande -> plafond atteint
    orderStatus: 'Terminée',
    product: productPremium,
  });
  assert(
    resPrem4.commissionAmount === 0 && resPrem4.commissionStatus === 'Non éligible',
    '5. 4ème commande Premium : plafond des 3 commandes atteint, commission = 0 FCFA'
  );

  // 4. Test des Vagues Dynamiques
  const wave1: WaveConfig = {
    wave: 'Vague 1',
    ambassadorCmd: 8,
    ambassadorCa: 100000,
    excellenceCmd: 20,
    excellenceCa: 300000,
    signatureCmd: 50,
    signatureCa: 800000,
    active: false,
  };

  const wave2: WaveConfig = {
    wave: 'Vague 2 — Spéciale 2026',
    ambassadorCmd: 10,
    ambassadorCa: 150000,
    excellenceCmd: 25,
    excellenceCa: 400000,
    signatureCmd: 60,
    signatureCa: 1000000,
    active: true, // Vague 2 déclarée Active
  };

  const dynamicConfig: SystemConfig = {
    waves: [wave1, wave2],
    minimumPayment: 5000,
    lastUpdated: new Date().toISOString(),
    version: '2.0.0',
  };

  // Un partenaire avec 9 commandes et 120 000 FCFA
  // Avec la Vague 1 : Il est éligible Ambassador (>= 8 cmd ET >= 100 000 F)
  // Avec la Vague 2 active : Il n'est PAS encore éligible car le seuil Vague 2 est 10 cmd ET 150 000 F
  const progressionV2 = getRankProgression(120000, 9, 'Neo', dynamicConfig);

  assert(
    progressionV2.targetCmd === 10,
    '6. Moteur dynamique : Seuil cible de commandes passé à 10 selon la Vague 2 active'
  );
  assert(
    progressionV2.targetCa === 150000,
    '7. Moteur dynamique : Seuil cible de C.A. passé à 150 000 FCFA selon la Vague 2 active'
  );
  assert(
    progressionV2.eligibleForPromotion === false,
    '8. Non-éligibilité correcte : 9 commandes < 10 requises dans la Vague 2'
  );

  // Si on repasse la Vague 1 active :
  wave1.active = true;
  wave2.active = false;
  const progressionV1 = getRankProgression(120000, 9, 'Neo', dynamicConfig);
  assert(
    progressionV1.eligibleForPromotion === true,
    '9. Éligibilité confirmée dès réactivation de la Vague 1 (9 cmd >= 8 et 120 000 >= 100 000)'
  );

  console.log('\n========================================================');
  console.log(`📊 RÉSULTAT : ${passed} test(s) réussi(s), ${failed} échec(s)`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runDynamicCatalogTests().catch((err) => {
  console.error('Erreur inattendue dans le test:', err);
  process.exit(1);
});
