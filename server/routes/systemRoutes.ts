import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import {
  normalizePhone,
  performDiagnostic,
  runFullRecalcul,
} from '../../src/engine/akfEngine';
import {
  analyzeAppsScriptProject,
  ScriptFile,
  getProjectFileCatalog,
  readProjectFile,
  searchProjectCode,
  analyzeCurrentProjectCode,
  AnalysisHistoryItem,
} from '../aiService';

export const systemRouter = Router();

// Registre d'audit des analyses AKF CODE AI
const aiAnalysisHistory: AnalysisHistoryItem[] = [
  {
    id: 'AI-HIST-INIT-01',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sourceMode: 'CURRENT_CODE',
    actionType: 'AUDIT',
    instruction: 'Vérification automatique de la colonne DERNIÈRE COMMANDE et de la règle d’or des commissions',
    proposalTitle: 'Audit de conformité du moteur AKF PARTNERS',
    resultSummary: 'Conformité validée : colonne DERNIÈRE COMMANDE calculée sans anomalie, règle des commissions 100% respectée.',
    affectedFiles: ['src/engine/akfEngine.ts', 'server/googleSheetsRepository.ts', 'server.ts'],
    riskLevel: 'FAIBLE',
    status: 'Validé',
    decisionNotes: 'Audit initial certifié par l’administrateur.',
  },
];

// GET /api/health
systemRouter.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    mode: sheetsRepo.dataSourceMode,
    isMock: sheetsRepo.isMock,
  });
});

// GET /api/search - Recherche universelle
systemRouter.get('/api/search', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) return res.json([]);

    const partners = await sheetsRepo.getPartners();
    const clients = await sheetsRepo.getClients();
    const orders = await sheetsRepo.getOrders();
    const payments = await sheetsRepo.getPayments();

    const normalizedQ = q.toLowerCase();
    const phoneNorm = normalizePhone(q).canonical;

    const results: any[] = [];

    // Reconnaissance automatique de type si format identifiable
    const isAkfId = /^akf-?\d+$/i.test(q);
    const isClientId = /^cl\d+$/i.test(q);
    const isOrderId = /^cmd\d+$/i.test(q);
    const isPaymentId = /^pay\d+$/i.test(q);

    // Partenaires
    for (const p of partners) {
      const matchCode = p.code.toLowerCase().includes(normalizedQ) || p.id.toLowerCase().includes(normalizedQ);
      const matchName = p.fullName.toLowerCase().includes(normalizedQ);
      const matchPhone = phoneNorm && p.phoneCanonical.includes(phoneNorm);

      if (matchCode || matchName || matchPhone) {
        results.push({
          type: 'PARTNER',
          id: p.id,
          entityId: p.id,
          title: `${p.code} — ${p.fullName}`,
          subtitle: `Grade: ${p.rank} | Statut: ${p.status} | Solde: ${p.balance.toLocaleString()} FCFA`,
          details: `Tél: ${p.phone} | ${p.clientCount} clients | ${p.orderCount} commandes`,
          badge: p.rank,
          badgeColor: p.rank === 'Signature' ? 'purple' : p.rank === 'Excellence' ? 'emerald' : p.rank === 'Ambassador' ? 'amber' : 'slate',
          raw: p,
        });
      }
    }

    // Clients
    for (const c of clients) {
      const matchId = c.id.toLowerCase().includes(normalizedQ);
      const matchName = c.fullName.toLowerCase().includes(normalizedQ);
      const matchPhone = phoneNorm && c.phoneCanonical.includes(phoneNorm);
      const matchPartner = c.partnerCode && c.partnerCode.toLowerCase().includes(normalizedQ);

      if (matchId || matchName || matchPhone || matchPartner) {
        results.push({
          type: 'CLIENT',
          id: c.id,
          entityId: c.id,
          title: `${c.id} — ${c.fullName}`,
          subtitle: `Type: ${c.clientType} ${c.partnerCode ? `(${c.partnerCode})` : ''}`,
          details: `Tél: ${c.phone} | ${c.orderCount} cmd(s) | CA: ${c.totalCa.toLocaleString()} FCFA`,
          badge: c.clientType,
          badgeColor: c.clientType === 'PARTENAIRE' ? 'blue' : 'slate',
          raw: c,
        });
      }
    }

    // Commandes
    for (const o of orders) {
      const matchId = o.id.toLowerCase().includes(normalizedQ);
      const matchClient = o.clientName.toLowerCase().includes(normalizedQ) || o.clientId.toLowerCase().includes(normalizedQ);
      const matchPartner = o.partnerCode && o.partnerCode.toLowerCase().includes(normalizedQ);

      if (matchId || matchClient || matchPartner) {
        results.push({
          type: 'ORDER',
          id: o.id,
          entityId: o.id,
          title: `${o.id} — ${o.productName} (x${o.quantity})`,
          subtitle: `Client: ${o.clientName} | Total: ${o.totalAmount.toLocaleString()} FCFA`,
          details: `Partenaire: ${o.partnerCode || 'Aucun'} | Commission: ${o.commissionAmount.toLocaleString()} FCFA (${o.commissionStatus})`,
          badge: o.orderStatus,
          badgeColor: o.orderStatus === 'Livrée' ? 'emerald' : 'amber',
          raw: o,
        });
      }
    }

    // Paiements
    for (const p of payments) {
      const matchId = p.id.toLowerCase().includes(normalizedQ);
      const matchPartner = p.partnerCode.toLowerCase().includes(normalizedQ) || p.partnerName.toLowerCase().includes(normalizedQ);
      const matchRef = p.reference.toLowerCase().includes(normalizedQ);

      if (matchId || matchPartner || matchRef) {
        results.push({
          type: 'PAYMENT',
          id: p.id,
          entityId: p.id,
          title: `${p.id} — ${p.amount.toLocaleString()} FCFA`,
          subtitle: `Partenaire: ${p.partnerCode} (${p.partnerName})`,
          details: `Date: ${p.date} | Mode: ${p.paymentMethod} | Réf: ${p.reference}`,
          badge: p.status,
          badgeColor: 'emerald',
          raw: p,
        });
      }
    }

    // Prioritiser par correspondance exacte d'identifiant
    if (isAkfId) {
      results.sort((a, b) => (a.type === 'PARTNER' ? -1 : 1));
    } else if (isClientId) {
      results.sort((a, b) => (a.type === 'CLIENT' ? -1 : 1));
    } else if (isOrderId) {
      results.sort((a, b) => (a.type === 'ORDER' ? -1 : 1));
    } else if (isPaymentId) {
      results.sort((a, b) => (a.type === 'PAYMENT' ? -1 : 1));
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recalculate - Recalcul global
systemRouter.post('/api/recalculate', async (_req: Request, res: Response) => {
  try {
    const partners = await sheetsRepo.getPartners();
    const clients = await sheetsRepo.getClients();
    const orders = await sheetsRepo.getOrders();
    const payments = await sheetsRepo.getPayments();
    const config = await sheetsRepo.getConfig();

    const { recalculatedPartners, recalculatedOrders, recalculatedClients, report } = runFullRecalcul(
      partners,
      clients,
      orders,
      payments,
      config
    );

    // Appliquer les données recalculées
    for (const p of recalculatedPartners) {
      await sheetsRepo.updatePartner(p.id, p);
    }
    for (const c of recalculatedClients || []) {
      await sheetsRepo.updateClient(c.id, {
        orderCount: c.orderCount,
        totalCa: c.totalCa,
        lastOrderDate: c.lastOrderDate,
      });
    }
    for (const o of recalculatedOrders) {
      await sheetsRepo.updateOrder(o.id, {
        commissionAmount: o.commissionAmount,
        commissionRate: o.commissionRate,
        commissionStatus: o.commissionStatus,
        premiumRankForClient: o.premiumRankForClient,
        partnerRankAtOrder: o.partnerRankAtOrder,
      });
    }

    await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'RECALCUL',
      description: `Exécution RECALCULER TOUT (${report.processedCount.orders} cmd, ${report.correctedCount} corrigés)`,
      oldValue: 'Données dérivées précédentes',
      newValue: `Recalcul terminé avec ${report.anomalies.length} anomalie(s)`,
    });

    const totalProcessed =
      report.processedCount.partners +
      report.processedCount.clients +
      report.processedCount.orders +
      report.processedCount.payments;

    res.json({
      message: 'Recalcul global terminé avec succès.',
      report,
      itemsProcessed: totalProcessed,
      itemsCorrected: report.correctedCount,
      anomaliesCount: report.anomalies.length,
      details: [...report.anomalies, ...report.errors],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diagnostic
systemRouter.get('/api/diagnostic', async (_req: Request, res: Response) => {
  try {
    const partners = await sheetsRepo.getPartners();
    const clients = await sheetsRepo.getClients();
    const orders = await sheetsRepo.getOrders();
    const payments = await sheetsRepo.getPayments();
    const config = await sheetsRepo.getConfig();
    const syncState = await sheetsRepo.getSyncState();

    const rawChecks = performDiagnostic(partners, clients, orders, payments, config, syncState);
    const checks = rawChecks.map((c) => {
      const status = c.status === 'ERROR' ? 'ERREUR' : c.status === 'WARNING' ? 'AVERTISSEMENT' : 'OK';
      const detailsArray = Array.isArray(c.details)
        ? c.details
        : typeof c.details === 'string' && c.details.trim().length > 0
        ? [c.details]
        : [];
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        status,
        message: typeof c.details === 'string' ? c.details : c.name,
        details: detailsArray,
        value: c.value,
      };
    });

    const hasError = checks.some((c) => c.status === 'ERREUR');
    const hasWarning = checks.some((c) => c.status === 'AVERTISSEMENT');
    const overallStatus = hasError ? 'ERREUR' : hasWarning ? 'AVERTISSEMENT' : 'OK';

    res.json({
      timestamp: new Date().toISOString(),
      overallStatus,
      checks,
      summary: {
        ok: checks.filter((c) => c.status === 'OK').length,
        warning: checks.filter((c) => c.status === 'AVERTISSEMENT').length,
        error: checks.filter((c) => c.status === 'ERREUR').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config
systemRouter.get('/api/config', async (_req: Request, res: Response) => {
  try {
    const config = await sheetsRepo.getConfig();
    const activeWave = config.waves?.find((w) => w.active) || config.waves?.[0];
    const ranks = [
      { name: 'Neo', minCa: 0, minOrders: 0, commissionRate: (config.commissionRates?.Neo ?? 6) / 100 },
      {
        name: 'Ambassador',
        minCa: activeWave?.ambassadorCa ?? 100000,
        minOrders: activeWave?.ambassadorCmd ?? 8,
        commissionRate: (config.commissionRates?.Ambassador ?? 8) / 100,
      },
      {
        name: 'Excellence',
        minCa: activeWave?.excellenceCa ?? 300000,
        minOrders: activeWave?.excellenceCmd ?? 20,
        commissionRate: (config.commissionRates?.Excellence ?? 10) / 100,
      },
      {
        name: 'Signature',
        minCa: activeWave?.signatureCa ?? 800000,
        minOrders: activeWave?.signatureCmd ?? 50,
        commissionRate: (config.commissionRates?.Signature ?? 12) / 100,
      },
    ];
    res.json({
      ...config,
      activeWave: activeWave?.wave || 'Vague 1',
      ranks,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/config
systemRouter.patch('/api/config', async (req: Request, res: Response) => {
  try {
    const updated = await sheetsRepo.updateConfig(req.body);
    await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'SYNC',
      description: 'Mise à jour de la configuration système AKF',
      oldValue: 'Configuration antérieure',
      newValue: JSON.stringify(req.body),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs
systemRouter.get('/api/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await sheetsRepo.getLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/logs
systemRouter.post('/api/logs', async (req: Request, res: Response) => {
  try {
    const { user = 'admin@akfpartners.bj', actionType = 'SYSTEM', description = '', oldValue = '', newValue = '' } = req.body;
    const log = await sheetsRepo.addLog({
      user,
      actionType,
      description,
      oldValue,
      newValue,
    });
    res.status(201).json({ message: 'Log enregistré avec succès', log });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- AKF CODE AI ENDPOINTS ---

// GET /api/ai/source-catalog
systemRouter.get('/api/ai/source-catalog', async (_req: Request, res: Response) => {
  try {
    const catalog = getProjectFileCatalog();
    res.json({
      status: 'Code actuel accessible — Lecture seule',
      sourceMode: 'CURRENT_CODE',
      filesCount: catalog.length,
      files: catalog,
      historicalGasCount: 4,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/read-file
systemRouter.get('/api/ai/read-file', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'Le paramètre "path" est obligatoire.' });
    }
    const fileData = readProjectFile(filePath);
    res.json(fileData);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/ai/search-code
systemRouter.post('/api/ai/search-code', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Le paramètre "query" est obligatoire.' });
    }
    const proofs = searchProjectCode(query);
    res.json({
      query,
      count: proofs.length,
      proofs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/analyze-current
systemRouter.post('/api/ai/analyze-current', async (req: Request, res: Response) => {
  try {
    const { instruction, actionType = 'AUDIT', context = '' } = req.body;

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return res.status(400).json({
        error: 'Veuillez renseigner une description claire pour guider l’analyse du code actuel.',
      });
    }

    const analysisResult = await analyzeCurrentProjectCode(instruction, actionType, context);

    const historyId = `AI-HIST-${Date.now()}`;
    const historyItem: AnalysisHistoryItem = {
      id: historyId,
      timestamp: new Date().toISOString(),
      sourceMode: 'CURRENT_CODE',
      actionType,
      instruction,
      proposalTitle: analysisResult.proposal?.title || 'Analyse du code source AKF',
      resultSummary: analysisResult.proposal?.problemSummary || 'Analyse terminée avec succès.',
      affectedFiles: analysisResult.impact?.affectedFiles || [],
      riskLevel: (analysisResult.impact?.riskLevel as any) || 'FAIBLE',
      status: 'Analysé',
    };
    aiAnalysisHistory.unshift(historyItem);

    await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'AI_ANALYZE_CURRENT',
      description: `AKF CODE AI : Analyse sur code actuel [${actionType}]`,
      oldValue: `Demande: "${instruction.slice(0, 100)}..."`,
      newValue: `Fichiers: ${(analysisResult.impact.affectedFiles || []).join(', ')} | Risque: ${analysisResult.impact.riskLevel} | Id: ${historyId}`,
    });

    res.json({
      ...analysisResult,
      analysisId: historyId,
    });
  } catch (err: any) {
    console.error('Erreur analyse code actuel :', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l’analyse du code source actuel.' });
  }
});

// GET /api/ai/history
systemRouter.get('/api/ai/history', (_req: Request, res: Response) => {
  res.json(aiAnalysisHistory);
});

// POST /api/ai/analyze
systemRouter.post('/api/ai/analyze', async (req: Request, res: Response) => {
  try {
    const { files, instruction, context = '' } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: 'Veuillez fournir au moins un fichier Google Apps Script (.gs) pour analyse.',
      });
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return res.status(400).json({
        error: 'Veuillez renseigner une instruction claire pour guider l’analyse.',
      });
    }

    // Appel au service IA avec garde-fous stricts
    const analysisResult = await analyzeAppsScriptProject(files, instruction, context);

    const historyId = `AI-HIST-GAS-${Date.now()}`;
    const historyItem: AnalysisHistoryItem = {
      id: historyId,
      timestamp: new Date().toISOString(),
      sourceMode: 'HISTORICAL_GAS',
      actionType: 'HISTORICAL_REF',
      instruction,
      proposalTitle: analysisResult.proposal?.title || 'Analyse Apps Script historique',
      resultSummary: analysisResult.proposal?.problemSummary || 'Audit du code .gs historique',
      affectedFiles: files.map((f: ScriptFile) => f.name),
      riskLevel: analysisResult.impact.riskLevel,
      status: 'Analysé',
    };
    aiAnalysisHistory.unshift(historyItem);

    // Traçabilité de l'analyse dans le journal d'audit
    await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'AI_ANALYZE',
      description: `AKF CODE AI : Analyse de ${files.length} fichier(s) Apps Script [${files.map((f: ScriptFile) => f.name).join(', ')}]`,
      oldValue: `Demande: "${instruction.slice(0, 100)}..."`,
      newValue: `Modèle: ${analysisResult.modelUsed} | Risque: ${analysisResult.impact.riskLevel} | Confiance: ${analysisResult.confidence.score}%`,
    });

    res.json({
      ...analysisResult,
      analysisId: historyId,
    });
  } catch (err: any) {
    console.error('Erreur API AKF CODE AI :', err);
    res.status(500).json({ error: err.message || 'Erreur lors du traitement IA.' });
  }
});

// POST /api/ai/decision
systemRouter.post('/api/ai/decision', async (req: Request, res: Response) => {
  try {
    const { decision, proposalTitle, files = [], reason = '', analysisId } = req.body;

    if (!decision || (decision !== 'VALIDATED' && decision !== 'REJECTED')) {
      return res.status(400).json({ error: 'Décision invalide. Choix possibles : VALIDATED ou REJECTED.' });
    }

    const isApproved = decision === 'VALIDATED';

    // Mise à jour de l'historique
    const targetHist = analysisId
      ? aiAnalysisHistory.find((h) => h.id === analysisId)
      : aiAnalysisHistory.find((h) => h.proposalTitle === proposalTitle || h.status === 'Analysé');

    if (targetHist) {
      targetHist.status = isApproved ? 'Validé' : 'Refusé';
      targetHist.decisionNotes = reason || (isApproved ? 'Validé manuellement par l’administrateur' : 'Refusé par l’administrateur');
    }

    // Enregistrement inaltérable de la décision humaine dans le journal d'audit
    const logEntry = await sheetsRepo.addLog({
      user: 'admin@akfpartners.bj',
      actionType: 'AI_VALIDATION',
      description: `AKF CODE AI : Décision humaine - ${isApproved ? 'VALIDATION ACCORDÉE' : 'PROPOSITION REJETÉE'}`,
      oldValue: `Proposition: "${proposalTitle || 'Révision AKF CODE AI'}" (${files.join(', ')})`,
      newValue: isApproved
        ? 'STATUT: VALIDÉ PAR ADMIN - Code autorisé pour exportation et intégration manuelle'
        : `STATUT: REJETÉ PAR ADMIN - Motif: ${reason || 'Non précisé'}`,
    });

    res.json({
      success: true,
      decision,
      timestamp: logEntry.timestamp,
      logId: logEntry.id,
      updatedStatus: isApproved ? 'Validé' : 'Refusé',
      message: isApproved
        ? 'Proposition validée par l’administrateur. Le code corrigé complet est disponible pour copie et exportation.'
        : 'Proposition rejetée par l’administrateur. Aucune modification n’est appliquée.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
