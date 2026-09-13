/**
 * Suite de tests pour AKF CODE AI
 * Vérifie :
 * 1. Analyse mono-fichier
 * 2. Analyse multi-fichiers
 * 3. Détection de dépendances inter-fonctions
 * 4. Détection de fonction inexistante
 * 5. Proposition de correction
 * 6. Génération de code complet
 * 7. Génération de diff réel ligne par ligne
 * 8. Refus d'inventer une colonne ou un onglet (Règle d'or Zéro Hallucination)
 * 9. Validation humaine accordée
 * 10. Rejet d'une proposition
 * 11. Journalisation dans les logs d'audit
 */

import {
  analyzeAppsScriptProject,
  computeLineDiff,
  analyzeStaticGas,
  ScriptFile,
} from '../server/aiService';
import { sheetsRepo } from '../server/sheetsRepository';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 DÉMARRAGE DE LA SUITE DE TESTS : AKF CODE AI');
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

  // --- Données de test ---
  const file1: ScriptFile = {
    name: 'Partners.gs',
    type: 'gs',
    content: `function getPartner(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PARTENAIRES");
  return sheet.getDataRange().getValues();
}

function updatePartnerCA(code, amount) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PARTENAIRES");
  var rank = calculateNewRankThreshold(code, amount);
  sheet.appendRow([code, amount, rank]);
}`,
  };

  const file2: ScriptFile = {
    name: 'Commissions.gs',
    type: 'gs',
    content: `function computeCommission(rank, amount) {
  var partner = getPartner("AKF001");
  var rate = 0.06;
  if (rank === "Ambassador") rate = 0.08;
  return amount * rate;
}`,
  };

  // 1. Analyse mono-fichier
  try {
    const res1 = await analyzeAppsScriptProject([file1], 'Auditer le fichier Partners');
    assert(
      res1.analysis.filesOverview.length === 1 && res1.analysis.filesOverview[0].name === 'Partners.gs',
      '1. Analyse mono-fichier : prise en compte du fichier unique'
    );
  } catch (err: any) {
    assert(false, '1. Analyse mono-fichier', err.message);
  }

  // 2. Analyse multi-fichiers
  try {
    const res2 = await analyzeAppsScriptProject([file1, file2], 'Auditer le projet complet');
    assert(
      res2.analysis.filesOverview.length === 2,
      '2. Analyse multi-fichiers : détection des 2 fichiers (Partners.gs et Commissions.gs)'
    );
  } catch (err: any) {
    assert(false, '2. Analyse multi-fichiers', err.message);
  }

  // 3. Détection de dépendances inter-fonctions
  try {
    const staticAudit = analyzeStaticGas([file1, file2]);
    const callsPartner = staticAudit.functionCalls.some(
      (c) => c.caller === 'computeCommission' && c.callee === 'getPartner'
    );
    assert(callsPartner, '3. Détection des dépendances : computeCommission() -> getPartner() identifié');
  } catch (err: any) {
    assert(false, '3. Détection des dépendances', err.message);
  }

  // 4. Détection d'une fonction inexistante
  try {
    const staticAudit = analyzeStaticGas([file1, file2]);
    const missing = staticAudit.missingFunctions.find((m) => m.callee === 'calculateNewRankThreshold');
    assert(
      !!missing && missing.caller === 'updatePartnerCA',
      '4. Détection d’une fonction inexistante : calculateNewRankThreshold() signalée manquante'
    );
  } catch (err: any) {
    assert(false, '4. Détection d’une fonction inexistante', err.message);
  }

  // 5. Proposition de correction ciblée
  try {
    const res = await analyzeAppsScriptProject([file1], 'Résoudre les dépendances');
    assert(
      res.proposal.title.length > 0 && res.proposal.recommendedSolution.length > 0,
      '5. Proposition de correction : solution ciblée et explications fournies'
    );
  } catch (err: any) {
    assert(false, '5. Proposition de correction', err.message);
  }

  // 6. Génération de code complet pour Apps Script
  try {
    const res = await analyzeAppsScriptProject([file1], 'Générer le code');
    const corrected = res.correctedFiles.find((c) => c.fileName === 'Partners.gs');
    assert(
      !!corrected &&
        corrected.fullCode.includes('function getPartner') &&
        corrected.fullCode.includes('function updatePartnerCA'),
      '6. Génération de code complet : fichier complet prêt à copier (non tronqué)'
    );
  } catch (err: any) {
    assert(false, '6. Génération de code complet', err.message);
  }

  // 7. Génération du diff réel ligne par ligne
  try {
    const oldCode = `function test() {\n  return 1;\n}`;
    const newCode = `function test() {\n  // secure\n  return 2;\n}`;
    const diff = computeLineDiff('test.gs', oldCode, newCode);
    const hasAdditions = diff.chunks.some((c) => c.type === 'addition');
    const hasDeletions = diff.chunks.some((c) => c.type === 'deletion');
    const hasUnchanged = diff.chunks.some((c) => c.type === 'unchanged');
    assert(
      hasAdditions && hasDeletions && hasUnchanged,
      '7. Génération du Diff réel : calcul des lignes ajoutées (+), supprimées (-) et conservées ( )'
    );
  } catch (err: any) {
    assert(false, '7. Génération du Diff réel', err.message);
  }

  // 8. Refus d'inventer une colonne ou un onglet (Règle d'or Zéro Hallucination)
  try {
    const res = await analyzeAppsScriptProject([file1], 'Analyse du schéma');
    const hasWarning = res.analysis.missingInformation.some((m) =>
      m.includes('INFORMATION MANQUANTE — VALIDATION REQUISE')
    );
    assert(
      hasWarning,
      '8. Refus d’inventer une colonne : mention explicite "INFORMATION MANQUANTE — VALIDATION REQUISE"'
    );
  } catch (err: any) {
    assert(false, '8. Refus d’inventer une colonne', err.message);
  }

  // 9. Validation humaine accordée
  try {
    const logValid = await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'AI_VALIDATION',
      description: 'AKF CODE AI : Décision humaine - VALIDATION ACCORDÉE',
      oldValue: 'Proposition: "Sécurisation Partners.gs"',
      newValue: 'STATUT: VALIDÉ PAR ADMIN - Code autorisé pour exportation',
    });
    assert(
      logValid.actionType === 'AI_VALIDATION' && logValid.newValue.includes('VALIDÉ PAR ADMIN'),
      '9. Validation humaine : enregistrement de l’approbation de l’administrateur'
    );
  } catch (err: any) {
    assert(false, '9. Validation humaine', err.message);
  }

  // 10. Rejet d'une proposition
  try {
    const logReject = await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'AI_VALIDATION',
      description: 'AKF CODE AI : Décision humaine - PROPOSITION REJETÉE',
      oldValue: 'Proposition: "Sécurisation Partners.gs"',
      newValue: 'STATUT: REJETÉ PAR ADMIN - Motif: Spécification à revoir',
    });
    assert(
      logReject.newValue.includes('REJETÉ PAR ADMIN'),
      '10. Rejet d’une proposition : refus enregistré sans modification'
    );
  } catch (err: any) {
    assert(false, '10. Rejet d’une proposition', err.message);
  }

  // 11. Journalisation complète
  try {
    const logs = await sheetsRepo.getLogs();
    const aiLogs = logs.filter((l) => l.actionType === 'AI_VALIDATION');
    assert(
      aiLogs.length >= 2,
      '11. Journalisation : traçabilité complète dans le journal d’audit AKF'
    );
  } catch (err: any) {
    assert(false, '11. Journalisation', err.message);
  }

  console.log('\n========================================================');
  console.log(`RÉSULTAT GLOBAL DES TESTS : ${passed} RÉUSSIS / ${failed} ÉCHOUÉS`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error('Erreur fatale lors des tests :', e);
  process.exit(1);
});
