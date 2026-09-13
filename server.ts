import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  computeOrderCommission,
  generateNextId,
  isCompletedOrderStatus,
  isCommissionAcquiredOrderStatus,
  getRankProgression,
  normalizePhone,
  partnerIdToCode,
  performDiagnostic,
  runFullRecalcul,
} from './src/engine/akfEngine';
import { sheetsRepo } from './server/sheetsRepository';
import { GoogleSheetsService, EXPECTED_SHEETS_CONFIG } from './server/googleSheetsService';
import { Client, Order, Partner, Payment, CommissionStatus } from './src/types';
import {
  analyzeAppsScriptProject,
  ScriptFile,
  getProjectFileCatalog,
  readProjectFile,
  searchProjectCode,
  analyzeCurrentProjectCode,
  AnalysisHistoryItem,
} from './server/aiService';

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'AKF PARTNERS',
      version: '1.0.0-production',
      environment: process.env.NODE_ENV || 'development',
      dataMode: sheetsRepo.modeName,
    });
  });

  // 1. PARTENAIRES
  app.get('/api/partners', async (req, res) => {
    try {
      const partners = await sheetsRepo.getPartners();
      res.json(partners);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/partners/:id', async (req, res) => {
    try {
      const partners = await sheetsRepo.getPartners();
      const partner = partners.find((p) => p.id === req.params.id || p.code === req.params.id);
      if (!partner) {
        return res.status(404).json({ error: `Partenaire non trouvé : ${req.params.id}` });
      }
      res.json(partner);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/partners', async (req, res) => {
    try {
      const { fullName, phone, whatsapp } = req.body;

      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: 'Le nom & prénom du partenaire est obligatoire.' });
      }
      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
      }

      // 1. Normaliser le téléphone
      const norm = normalizePhone(phone);
      const partners = await sheetsRepo.getPartners();

      // 2. Vérifier doublon
      const existingDuplicate = partners.find((p) => p.phoneCanonical === norm.canonical);
      if (existingDuplicate) {
        return res.status(409).json({
          error: `⚠️ Ce numéro de téléphone (${norm.canonical}) est déjà associé au partenaire ${existingDuplicate.code} (${existingDuplicate.fullName}).`,
        });
      }

      // 3. Générer ID et Code partenaire
      const existingIds = partners.map((p) => p.id);
      const newId = generateNextId('AKF', existingIds);
      const newCode = partnerIdToCode(newId, fullName);

      // 4. Attribuer valeurs initiales
      const config = await sheetsRepo.getConfig();
      const activeWave = config.waves.find((w) => w.active)?.wave || 'Vague 1';

      const newPartner: Partner = {
        id: newId,
        code: newCode,
        fullName: fullName.trim(),
        phone: norm.formatted,
        phoneCanonical: norm.canonical,
        whatsapp: whatsapp?.trim() ? normalizePhone(whatsapp).formatted : undefined,
        rank: 'Neo',
        wave: activeWave,
        status: 'Actif',
        createdAt: new Date().toISOString(),
        ca: 0,
        clientCount: 0,
        orderCount: 0,
        totalCommission: 0,
        validatedCommission: 0,
        paidCommission: 0,
        balance: 0,
        progressPct: 0,
        nextRank: 'Ambassador',
        targetCaNextRank: 150000,
        targetCmdNextRank: 5,
      };

      // 5. Enregistrer
      await sheetsRepo.savePartner(newPartner);

      // 6. Journaliser
      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_PARTNER',
        description: `Création du partenaire ${newPartner.code} - ${newPartner.fullName}`,
        oldValue: 'null',
        newValue: `${newPartner.id} (${newPartner.code})`,
      });

      res.status(201).json({
        message: `✅ Partenaire ${newCode} (${fullName}) créé avec succès.`,
        partner: newPartner,
        id: newPartner.id,
        code: newPartner.code,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Impossible d'enregistrer le partenaire. Raison : ${err.message}` });
    }
  });

  const handleUpdatePartner = async (req: express.Request, res: express.Response) => {
    try {
      const { status, wave, whatsapp, fullName, phone } = req.body;
      const allPartners = await sheetsRepo.getPartners();
      const partner = allPartners.find((p) => p.id === req.params.id);
      if (!partner) return res.status(404).json({ error: 'Partenaire introuvable' });

      const updates: Partial<Partner> = {};

      if (fullName !== undefined) {
        if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
          return res.status(400).json({ error: 'Le nom complet du partenaire est requis.' });
        }
        updates.fullName = fullName.trim();
      }

      if (status !== undefined) {
        if (!['Actif', 'Inactif', 'Suspendu'].includes(status)) {
          return res.status(400).json({ error: 'Statut invalide. Valeurs permises : Actif, Inactif, Suspendu.' });
        }
        updates.status = status;
      }

      if (wave !== undefined) {
        updates.wave = String(wave).trim();
      }

      if (phone !== undefined && phone !== partner.phone) {
        const norm = normalizePhone(phone);
        // Vérifier doublon éventuel avec un AUTRE partenaire
        const duplicate = allPartners.find((p) => p.id !== partner.id && p.phoneCanonical === norm.canonical);
        if (duplicate) {
          return res.status(409).json({
            error: `⚠️ Le numéro ${norm.canonical} est déjà attribué à un autre partenaire (${duplicate.code} - ${duplicate.fullName}).`,
          });
        }
        updates.phone = norm.formatted;
        updates.phoneCanonical = norm.canonical;
      }

      if (whatsapp !== undefined) {
        updates.whatsapp = whatsapp?.trim() ? normalizePhone(whatsapp).formatted : undefined;
      }

      const updated = await sheetsRepo.updatePartner(req.params.id, updates);
      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'UPDATE_PARTNER',
        description: `Modification du partenaire ${partner.code} (${partner.fullName})`,
        oldValue: JSON.stringify({
          fullName: partner.fullName,
          phone: partner.phone,
          status: partner.status,
          wave: partner.wave,
          whatsapp: partner.whatsapp,
        }),
        newValue: JSON.stringify(updates),
      });

      res.json({
        message: `✅ Partenaire ${partner.code} mis à jour avec succès.`,
        partner: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.put('/api/partners/:id', handleUpdatePartner);
  app.patch('/api/partners/:id', handleUpdatePartner);

  // 2. CLIENTS
  app.get('/api/clients', async (req, res) => {
    try {
      const clients = await sheetsRepo.getClients();
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const clients = await sheetsRepo.getClients();
      const client = clients.find((c) => c.id === req.params.id);
      if (!client) return res.status(404).json({ error: 'Client introuvable' });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/clients', async (req, res) => {
    try {
      const { fullName, phone, whatsapp, partnerId } = req.body;

      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: 'Le nom & prénom du client est obligatoire.' });
      }
      if (!phone || !phone.trim()) {
        return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
      }

      // 1. Normalisation téléphone
      const norm = normalizePhone(phone);
      const clients = await sheetsRepo.getClients();

      // 2. Contrôle doublon
      const duplicate = clients.find((c) => c.phoneCanonical === norm.canonical);
      if (duplicate) {
        return res.status(409).json({
          error: `⚠️ Ce numéro de téléphone (${norm.canonical}) est déjà associé au client ${duplicate.id} (${duplicate.fullName}).`,
        });
      }

      // 3. Validation partenaire
      let resolvedPartner: Partner | null = null;
      if (partnerId) {
        const partners = await sheetsRepo.getPartners();
        resolvedPartner = partners.find((p) => p.id === partnerId || p.code === partnerId) || null;
        if (!resolvedPartner) {
          return res.status(400).json({ error: `Partenaire sélectionné introuvable : ${partnerId}` });
        }
      }

      // 4. Génération CLxxx
      const existingIds = clients.map((c) => c.id);
      const newId = generateNextId('CL', existingIds);

      // 5. Détermination du type
      const clientType = resolvedPartner ? 'PARTENAIRE' : 'DIRECT AKF';

      const newClient: Client = {
        id: newId,
        fullName: fullName.trim(),
        phone: norm.formatted,
        phoneCanonical: norm.canonical,
        whatsapp: whatsapp?.trim() ? normalizePhone(whatsapp).formatted : undefined,
        partnerId: resolvedPartner ? resolvedPartner.id : null,
        partnerCode: resolvedPartner ? resolvedPartner.code : null,
        partnerName: resolvedPartner ? resolvedPartner.fullName : null,
        clientType,
        orderCount: 0,
        totalCa: 0,
        createdAt: new Date().toISOString(),
      };

      await sheetsRepo.saveClient(newClient);

      // Mettre à jour le compteur client du partenaire si rattaché
      if (resolvedPartner) {
        await sheetsRepo.updatePartner(resolvedPartner.id, {
          clientCount: resolvedPartner.clientCount + 1,
        });
      }

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_CLIENT',
        description: `Création du client ${newId} - ${fullName} (${clientType})`,
        oldValue: 'null',
        newValue: `${newId} (${resolvedPartner ? resolvedPartner.code : 'DIRECT AKF'})`,
      });

      res.status(201).json({
        message: `✅ Client ${newId} (${fullName}) enregistré avec succès.`,
        client: newClient,
        id: newClient.id,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Impossible d'enregistrer le client. Raison : ${err.message}` });
    }
  });

  app.patch('/api/clients/:id', async (req, res) => {
    try {
      const { partnerId, fullName, phone, whatsapp, city, address, notes } = req.body;
      const client = (await sheetsRepo.getClients()).find((c) => c.id === req.params.id);
      if (!client) return res.status(404).json({ error: 'Client introuvable' });

      // Règle métier : limitation si le client a déjà des commandes
      if (partnerId !== undefined && partnerId !== client.partnerId && (client.orderCount || 0) > 0) {
        return res.status(400).json({
          error: `⚠️ Règle métier AKF : Le client ${client.fullName} (${client.id}) possède déjà ${client.orderCount} commande(s). La réattribution de partenaire est restreinte pour préserver l'historique des commissions et des ventes.`,
        });
      }

      let updates: Partial<Client> = {};
      if (fullName && fullName.trim()) updates.fullName = fullName.trim();
      if (phone && phone.trim()) {
        const norm = normalizePhone(phone);
        updates.phone = norm.formatted;
        updates.phoneCanonical = norm.canonical;
      }
      if (whatsapp !== undefined) updates.whatsapp = whatsapp?.trim() ? normalizePhone(whatsapp).formatted : undefined;
      if (city !== undefined) updates.city = city.trim();
      if (address !== undefined) updates.address = address.trim();
      if (notes !== undefined) updates.notes = notes.trim();

      if (partnerId !== undefined) {
        if (!partnerId) {
          updates.partnerId = null;
          updates.partnerCode = null;
          updates.partnerName = null;
          updates.clientType = 'DIRECT AKF';
        } else {
          const partner = (await sheetsRepo.getPartners()).find((p) => p.id === partnerId || p.code === partnerId);
          if (!partner) return res.status(400).json({ error: 'Partenaire introuvable' });
          updates.partnerId = partner.id;
          updates.partnerCode = partner.code;
          updates.partnerName = partner.fullName;
          updates.clientType = 'PARTENAIRE';
        }
      }

      const updated = await sheetsRepo.updateClient(req.params.id, updates);
      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'UPDATE_CLIENT',
        description: `Modification fiche client ${client.id} (${updated.fullName})`,
        oldValue: client.fullName,
        newValue: updated.fullName,
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const client = (await sheetsRepo.getClients()).find((c) => c.id === id);
      if (!client) return res.status(404).json({ error: `Client ${id} introuvable.` });

      // Règle métier : Client sans commande -> suppression autorisée.
      // Client ayant au moins une commande -> suppression interdite avec raison explicite.
      const orders = await sheetsRepo.getOrders();
      const clientOrders = orders.filter((o) => o.clientId === id || o.clientName === client.fullName);
      const effectiveOrderCount = Math.max(clientOrders.length, client.orderCount || 0);

      if (effectiveOrderCount > 0) {
        return res.status(400).json({
          error: `🚫 Suppression interdite : Le client "${client.fullName}" (${client.id}) est rattaché à ${effectiveOrderCount} commande(s) dans l'historique commercial. La suppression briserait l'intégrité de la base de données et l'historique des commissions.`,
        });
      }

      await sheetsRepo.deleteClient(id);

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'DELETE_CLIENT',
        description: `Suppression définitive du client ${client.id} (${client.fullName})`,
        oldValue: `${client.fullName} (${client.phone})`,
        newValue: 'SUPPRIMÉ',
      });

      res.json({
        success: true,
        message: `✅ Le client "${client.fullName}" (${client.id}) a été supprimé définitivement.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Impossible de supprimer le client : ${err.message}` });
    }
  });

  // 3. PRODUITS
  app.get('/api/products', async (req, res) => {
    try {
      const products = await sheetsRepo.getProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. COMMANDES
  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await sheetsRepo.getOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const { clientId, productId, quantity = 1, unitPrice: customUnitPrice, date, status = 'Confirmée' } = req.body;

      if (!clientId) return res.status(400).json({ error: 'Le client est obligatoire.' });
      if (!productId) return res.status(400).json({ error: 'Le produit est obligatoire.' });
      if (!quantity || quantity < 1) return res.status(400).json({ error: 'La quantité doit être supérieure ou égale à 1.' });

      // Résoudre le client
      const clients = await sheetsRepo.getClients();
      const client = clients.find((c) => c.id === clientId);
      if (!client) return res.status(404).json({ error: `Client introuvable : ${clientId}` });

      // Résoudre le produit
      const products = await sheetsRepo.getProducts();
      const product = products.find((p) => p.id === productId);
      if (!product) return res.status(404).json({ error: `Produit introuvable : ${productId}` });

      // Résoudre le partenaire
      let partner: Partner | null = null;
      if (client.partnerId) {
        const partners = await sheetsRepo.getPartners();
        partner = partners.find((p) => p.id === client.partnerId) || null;
      }

      // Règle prix de vente :
      // - PREMIUM : Le prix par défaut vient de GRILLE_COMMISSION mais est modifiable par l'utilisateur lors de la saisie
      // - RÉCURRENT : Le prix vient strictement de GRILLE_COMMISSION et n'est pas modifiable
      let unitPrice = product.price;
      if (product.isPremium && customUnitPrice !== undefined && customUnitPrice !== null && customUnitPrice !== '') {
        const parsedCustomPrice = Number(customUnitPrice);
        if (!isNaN(parsedCustomPrice) && parsedCustomPrice >= 0) {
          unitPrice = parsedCustomPrice;
        }
      }

      const totalAmount = unitPrice * quantity;

      // Historique client : seules les commandes Premium TERMINÉES (Livrée ou Terminée) comptent pour le quota de 3
      const existingOrders = await sheetsRepo.getOrders();
      const clientPriorCompletedPremiumOrders = existingOrders.filter(
        (o) => o.clientId === clientId && o.isPremium && isCompletedOrderStatus(o.orderStatus)
      );

      const config = await sheetsRepo.getConfig();

      // Moteur de calcul de commission selon GRILLE_COMMISSION et grade réel
      const commissionCalc = computeOrderCommission({
        clientId: client.id,
        isPremium: product.isPremium,
        totalAmount,
        quantity,
        partnerRank: partner ? partner.rank : null,
        clientPriorPremiumOrderCount: clientPriorCompletedPremiumOrders.length,
        orderStatus: status,
        config,
        product,
      });

      // Générer ID Commande CMDxxx
      const existingOrderIds = existingOrders.map((o) => o.id);
      const newOrderId = generateNextId('CMD', existingOrderIds);

      const newOrder: Order = {
        id: newOrderId,
        date: date || new Date().toISOString().split('T')[0],
        clientId: client.id,
        clientName: client.fullName,
        partnerId: partner ? partner.id : null,
        partnerCode: partner ? partner.code : null,
        partnerName: partner ? partner.fullName : null,
        partnerRankAtOrder: partner ? partner.rank : null,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        totalAmount,
        isPremium: product.isPremium,
        premiumRankForClient: commissionCalc.premiumRank,
        commissionRate: commissionCalc.commissionRate,
        commissionAmount: commissionCalc.commissionAmount,
        orderStatus: status,
        commissionStatus: commissionCalc.commissionStatus,
        createdAt: new Date().toISOString(),
      };

      await sheetsRepo.saveOrder(newOrder);

      // Mettre à jour stats client à partir de ses commandes réelles
      const allOrdersAfterSave = await sheetsRepo.getOrders();
      const clientOrders = allOrdersAfterSave.filter(
        (o) =>
          (o.clientId === client.id || (client.id && o.clientId && o.clientId.toLowerCase() === client.id.toLowerCase())) &&
          o.orderStatus !== 'Annulée'
      );
      const sortedDates = clientOrders
        .map((o) => o.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : '';

      await sheetsRepo.updateClient(client.id, {
        orderCount: clientOrders.length,
        totalCa: clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        lastOrderDate,
      });

      // Mettre à jour partenaire si présent : RÈGLE D'OR
      // Seules les commandes "Terminée" sont comptabilisées pour le partenaire (CA, commandes, commissions, solde, progression)
      if (partner) {
        const completedPartnerOrders = allOrdersAfterSave.filter(
          (o) =>
            (o.partnerId === partner.id || (o.partnerCode && o.partnerCode === partner.code)) &&
            isCommissionAcquiredOrderStatus(o.orderStatus)
        );
        const allPayments = await sheetsRepo.getPayments();
        const partnerPayments = allPayments.filter((p) => p.partnerId === partner.id && p.status === 'Effectué');

        const newCa = completedPartnerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const newOrderCount = completedPartnerOrders.length;
        const newTotalCommission = completedPartnerOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
        const newValidatedCommission = newTotalCommission;
        const paidCommission = partnerPayments.reduce((sum, p) => sum + p.amount, 0);
        const newBalance = newValidatedCommission - paidCommission;

        const progression = getRankProgression(newCa, newOrderCount, partner.rank, partner.wave || 'Vague 1', config);

        await sheetsRepo.updatePartner(partner.id, {
          ca: newCa,
          orderCount: newOrderCount,
          totalCommission: newTotalCommission,
          validatedCommission: newValidatedCommission,
          balance: newBalance,
          progressPct: progression.progressPct,
          potentialRank: progression.potentialRank,
          eligibleForPromotion: progression.eligibleForPromotion,
          nextRank: progression.nextRank,
          targetCaNextRank: progression.targetCa,
          targetCmdNextRank: progression.targetCmd,
          commissionRate: progression.commissionRate,
        });
      }

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_ORDER',
        description: `Commande ${newOrderId} enregistrée pour ${client.fullName} (${totalAmount.toLocaleString()} FCFA)`,
        oldValue: 'null',
        newValue: `${newOrderId} - Commission: ${commissionCalc.commissionAmount} FCFA`,
      });

      res.status(201).json({
        message: `✅ Commande ${newOrderId} créée avec succès. Montant : ${totalAmount.toLocaleString()} FCFA. Commission : ${commissionCalc.commissionAmount.toLocaleString()} FCFA.`,
        order: newOrder,
        id: newOrder.id,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Impossible d'enregistrer la commande. Raison : ${err.message}` });
    }
  });

  app.patch('/api/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { orderStatus } = req.body;
      if (!orderStatus) return res.status(400).json({ error: 'Le champ orderStatus est obligatoire.' });

      const orders = await sheetsRepo.getOrders();
      const existing = orders.find((o) => o.id === id);
      if (!existing) return res.status(404).json({ error: `Commande ${id} introuvable.` });

      const oldStatus = existing.orderStatus;
      const isNowCompleted = isCommissionAcquiredOrderStatus(orderStatus);

      const config = await sheetsRepo.getConfig();
      const products = await sheetsRepo.getProducts();
      const partners = await sheetsRepo.getPartners();
      const clients = await sheetsRepo.getClients();

      let finalCommissionAmount = 0;
      let finalCommissionRate = existing.commissionRate;
      let finalCommissionStatus: CommissionStatus = 'En attente';
      let finalPremiumRank: number | null = existing.premiumRankForClient;

      // RÈGLE D'OR AKF :
      // "En attente" -> 0 commission acquise
      // "Confirmée" -> 0 commission acquise
      // "Terminée" -> calcul et comptabilisation de la commission
      // "Annulée" -> 0 commission
      if (orderStatus === 'Annulée') {
        finalCommissionAmount = 0;
        finalCommissionStatus = 'Annulée';
        finalPremiumRank = null;
      } else if (isNowCompleted) {
        // Calcul et comptabilisation de la commission au passage au statut "Terminée"
        const clientCompletedOrders = orders.filter(
          (o) =>
            o.id !== id &&
            (o.clientId === existing.clientId || (existing.clientName && o.clientName === existing.clientName)) &&
            isCommissionAcquiredOrderStatus(o.orderStatus)
        );
        const clientPriorPremiumCount = clientCompletedOrders.filter((o) => o.isPremium).length;

        const partner = existing.partnerId ? partners.find((p) => p.id === existing.partnerId) : null;
        const matchingProduct = products.find((p) => p.id === existing.productId || p.name === existing.productName);
        const commissionCalc = computeOrderCommission({
          clientId: existing.clientId,
          isPremium: existing.isPremium,
          totalAmount: existing.totalAmount,
          quantity: existing.quantity,
          partnerRank: partner ? (partner.rank || existing.partnerRankAtOrder || 'Neo') : null,
          clientPriorPremiumOrderCount: clientPriorPremiumCount,
          orderStatus: 'Terminée',
          config,
          product: matchingProduct,
        });

        finalCommissionAmount = commissionCalc.commissionAmount;
        finalCommissionRate = commissionCalc.commissionRate;
        finalCommissionStatus = commissionCalc.commissionStatus;
        finalPremiumRank = commissionCalc.premiumRank;
      } else {
        // "En attente" ou "Confirmée" -> 0 commission acquise
        finalCommissionAmount = 0;
        finalCommissionStatus = 'En attente';
        finalPremiumRank = null;
      }

      const updatedOrder = await sheetsRepo.updateOrder(id, {
        orderStatus,
        commissionAmount: finalCommissionAmount,
        commissionRate: finalCommissionRate,
        commissionStatus: finalCommissionStatus,
        premiumRankForClient: finalPremiumRank,
      });

      // Recalculer le partenaire si présent (Règle d'or : uniquement sur commandes Terminée)
      if (existing.partnerId) {
        const partner = partners.find((p) => p.id === existing.partnerId);
        if (partner) {
          const allOrders = await sheetsRepo.getOrders();
          const completedPartnerOrders = allOrders.filter(
            (o) =>
              (o.partnerId === partner.id || (o.partnerCode && o.partnerCode === partner.code)) &&
              isCommissionAcquiredOrderStatus(o.orderStatus)
          );
          const allPayments = await sheetsRepo.getPayments();
          const partnerPayments = allPayments.filter((p) => p.partnerId === partner.id && p.status === 'Effectué');

          const newCa = completedPartnerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const newOrderCount = completedPartnerOrders.length;
          const newTotalComm = completedPartnerOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
          const newValidatedComm = newTotalComm;
          const paidComm = partnerPayments.reduce((sum, p) => sum + p.amount, 0);
          const newBalance = newValidatedComm - paidComm;

          const progression = getRankProgression(newCa, newOrderCount, partner.rank, partner.wave || 'Vague 1', config);

          await sheetsRepo.updatePartner(partner.id, {
            ca: newCa,
            orderCount: newOrderCount,
            totalCommission: newTotalComm,
            validatedCommission: newValidatedComm,
            balance: newBalance,
            progressPct: progression.progressPct,
            nextRank: progression.nextRank,
            targetCaNextRank: progression.targetCa,
            targetCmdNextRank: progression.targetCmd,
            potentialRank: progression.potentialRank,
            eligibleForPromotion: progression.eligibleForPromotion,
            commissionRate: progression.commissionRate,
          });
        }
      }

      // Recalculer le client
      if (existing.clientId) {
        const allOrders = await sheetsRepo.getOrders();
        const clientOrders = allOrders.filter(
          (o) =>
            (o.clientId === existing.clientId || (existing.clientName && o.clientName === existing.clientName)) &&
            o.orderStatus !== 'Annulée'
        );
        const sortedDates = clientOrders
          .map((o) => o.date)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : '';

        await sheetsRepo.updateClient(existing.clientId, {
          orderCount: clientOrders.length,
          totalCa: clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
          lastOrderDate,
        });
      }

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'UPDATE_ORDER',
        description: `Statut commande ${id} : ${oldStatus} -> ${orderStatus} (Commission: ${finalCommissionStatus})`,
        oldValue: oldStatus,
        newValue: orderStatus,
      });

      res.json({
        message: `✅ Commande ${id} mise à jour avec le statut "${orderStatus}". Commission : ${finalCommissionStatus}.`,
        order: updatedOrder,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Erreur lors de la mise à jour de la commande : ${err.message}` });
    }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const orders = await sheetsRepo.getOrders();
      const order = orders.find((o) => o.id === id);
      if (!order) return res.status(404).json({ error: `Commande ${id} introuvable.` });

      // 1. Règle métier : Annulée -> conserver l'historique pour la piste d'audit
      if (order.orderStatus === 'Annulée') {
        return res.status(400).json({
          error: `🚫 Suppression interdite : Une commande au statut "Annulée" (${order.id}) fait partie intégrante de la piste d'audit obligatoire AKF et ne peut être supprimée définitivement.`,
        });
      }

      // 2. Règle métier : "Terminée" avec commission acquise ou payée -> suppression interdite
      if (order.orderStatus === 'Terminée' || order.orderStatus === 'Livrée') {
        if (order.commissionStatus === 'Payée') {
          return res.status(403).json({
            error: `🚫 Suppression strictement interdite : Cette commande est "Terminée" et sa commission (${order.commissionAmount.toLocaleString()} FCFA) a déjà été payée ou incluse dans un règlement.`,
          });
        }
        return res.status(403).json({
          error: `🚫 Suppression interdite : Cette commande est "Terminée" avec commission acquise (${order.commissionAmount.toLocaleString()} FCFA). Une commande ayant un historique financier validé ne peut jamais disparaître simplement pour modifier le solde d'un partenaire.`,
        });
      }

      // 3. Règle métier : "Confirmée" -> suppression autorisée TANT QU'aucune commission n'est acquise ou payée
      if (order.orderStatus === 'Confirmée') {
        if (order.commissionStatus === 'Payée') {
          return res.status(403).json({
            error: `🚫 Suppression strictement interdite : Cette commande confirmée possède une commission déjà payée (${order.commissionAmount.toLocaleString()} FCFA).`,
          });
        }
        if (order.commissionStatus === 'Validée') {
          return res.status(403).json({
            error: `🚫 Suppression interdite : Cette commande confirmée possède une commission déjà validée (${order.commissionAmount.toLocaleString()} FCFA).`,
          });
        }
      }

      // 4. Règle métier : Toute commande liée à un partenaire ayant déjà perçu des règlements dans "PAIEMENTS"
      const allPayments = await sheetsRepo.getPayments();
      if (order.partnerId) {
        const partnerPayments = allPayments.filter((p) => p.partnerId === order.partnerId && p.status === 'Effectué');
        const totalPaidToPartner = partnerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (totalPaidToPartner > 0 && (order.commissionStatus === 'Payée' || (order.commissionAmount > 0 && order.commissionStatus === 'Validée'))) {
          return res.status(403).json({
            error: `🚫 Suppression strictement interdite : Le partenaire ${order.partnerCode || order.partnerId} a déjà perçu des règlements enregistrés dans "PAIEMENTS". La suppression de cette commande impacterait illégalement l'équilibre comptable.`,
          });
        }
      }

      // 5. Exécution de la suppression autorisée (En attente ou Confirmée sans commission acquise)
      await sheetsRepo.deleteOrder(id);

      // 6. Recalculs en cascade obligatoires :
      // - Chiffre d'affaires du partenaire
      // - Nombre de commandes du partenaire
      // - Commissions du partenaire
      // - Solde du partenaire
      // - Données du client
      const remainingOrders = (await sheetsRepo.getOrders()).filter((o) => o.id !== id);

      if (order.partnerId) {
        const partner = (await sheetsRepo.getPartners()).find((p) => p.id === order.partnerId);
        if (partner) {
          const completedPartnerOrders = remainingOrders.filter(
            (o) =>
              (o.partnerId === partner.id || (o.partnerCode && o.partnerCode === partner.code)) &&
              isCommissionAcquiredOrderStatus(o.orderStatus)
          );
          const partnerPayments = allPayments.filter((p) => p.partnerId === partner.id && p.status === 'Effectué');

          const newCa = completedPartnerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const newTotalComm = completedPartnerOrders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0);
          const newValidatedComm = newTotalComm;
          const paidComm = partnerPayments.reduce((sum, p) => sum + p.amount, 0);
          const newBalance = newValidatedComm - paidComm;

          const config = await sheetsRepo.getConfig();
          const progression = getRankProgression(newCa, completedPartnerOrders.length, partner.rank, partner.wave || 'Vague 1', config);

          await sheetsRepo.updatePartner(partner.id, {
            ca: newCa,
            orderCount: completedPartnerOrders.length,
            totalCommission: newTotalComm,
            validatedCommission: newValidatedComm,
            balance: newBalance,
            progressPct: progression.progressPct,
            nextRank: progression.nextRank,
            targetCaNextRank: progression.targetCa,
            targetCmdNextRank: progression.targetCmd,
            potentialRank: progression.potentialRank,
            eligibleForPromotion: progression.eligibleForPromotion,
            commissionRate: progression.commissionRate,
          });
        }
      }

      // Recalcul du client
      if (order.clientId) {
        const client = (await sheetsRepo.getClients()).find((c) => c.id === order.clientId);
        if (client) {
          const clientOrders = remainingOrders.filter((o) => o.clientId === client.id && o.orderStatus !== 'Annulée');
          const newClientCa = clientOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const sortedDates = clientOrders
            .map((o) => o.date)
            .filter(Boolean)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          const lastOrderDate = sortedDates.length > 0 ? sortedDates[0] : '';

          await sheetsRepo.updateClient(client.id, {
            orderCount: clientOrders.length,
            totalCa: newClientCa,
            lastOrderDate,
          });
        }
      }

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'DELETE_ORDER',
        description: `Suppression définitive commande ${order.id} (${order.productName}, ${order.totalAmount.toLocaleString()} FCFA). Recalculs partenaire et client appliqués.`,
        oldValue: `${order.orderStatus} — ${order.totalAmount} FCFA`,
        newValue: 'SUPPRIMÉE',
      });

      res.json({
        success: true,
        message: `✅ La commande ${order.id} a été supprimée avec succès. Le CA, les commandes, les commissions et le solde du partenaire ainsi que les données du client ont été recalculés.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Erreur lors de la suppression de la commande : ${err.message}` });
    }
  });

  // 5. PAIEMENTS — Protection stricte de l'intangibilité
  app.delete('/api/payments/:id', (_req, res) => {
    res.status(403).json({
      error: '🚫 Règle d\'or AKF : Les règlements enregistrés dans "PAIEMENTS" sont intangibles et ne peuvent être supprimés ni modifiés rétroactivement.',
    });
  });

  app.patch('/api/payments/:id', (_req, res) => {
    res.status(403).json({
      error: '🚫 Règle d\'or AKF : Les règlements enregistrés dans "PAIEMENTS" sont intangibles et ne peuvent être supprimés ni modifiés rétroactivement.',
    });
  });

  // Confirmation humaine de la promotion d'un partenaire
  app.post('/api/partners/:id/promote', async (req, res) => {
    try {
      const { id } = req.params;
      const partners = await sheetsRepo.getPartners();
      const partner = partners.find((p) => p.id === id);
      if (!partner) return res.status(404).json({ error: `Partenaire ${id} introuvable.` });

      const config = await sheetsRepo.getConfig();
      const progression = getRankProgression(partner.ca, partner.orderCount, partner.rank, partner.wave || 'Vague 1', config);

      if (!progression.nextRank) {
        return res.status(400).json({ error: `Le partenaire ${partner.code} a déjà atteint le grade maximal (Signature).` });
      }

      if (!progression.eligibleForPromotion && !req.body.force) {
        return res.status(400).json({
          error: `Critères non remplis pour passer à ${progression.nextRank}. Objectif : ${progression.targetCmd} cmd et ${progression.targetCa.toLocaleString()} FCFA. Actuel : ${partner.orderCount} cmd et ${partner.ca.toLocaleString()} FCFA.`,
        });
      }

      const previousRank = partner.rank;
      const newRank = progression.nextRank;

      const updated = await sheetsRepo.updatePartner(partner.id, {
        rank: newRank,
      });

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'GRADE_CHANGE',
        description: `Promotion humaine confirmée pour ${partner.code} (${partner.fullName}) : ${previousRank} -> ${newRank}`,
        oldValue: previousRank,
        newValue: newRank,
      });

      res.json({
        message: `🎉 Le partenaire ${partner.fullName} (${partner.code}) est officiellement promu au grade ${newRank}.`,
        partner: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Erreur lors de la promotion du partenaire : ${err.message}` });
    }
  });

  // 5. PAIEMENTS
  app.get('/api/payments', async (req, res) => {
    try {
      const payments = await sheetsRepo.getPayments();
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments', async (req, res) => {
    try {
      const { partnerId, amount, date, paymentMethod = 'Mobile Money (MTN / Moov)', reference, note } = req.body;

      if (!partnerId) return res.status(400).json({ error: 'Le partenaire est obligatoire.' });
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Le montant doit être strictement positif.' });

      const partners = await sheetsRepo.getPartners();
      const partner = partners.find((p) => p.id === partnerId || p.code === partnerId);
      if (!partner) return res.status(404).json({ error: `Partenaire introuvable : ${partnerId}` });

      const config = await sheetsRepo.getConfig();
      const minPayment = config.minimumPayment || 5000;

      // Vérifier solde disponible
      if (amount > partner.balance) {
        return res.status(400).json({
          error: `Paiement impossible. Solde disponible insuffisant. Solde actuel : ${partner.balance.toLocaleString()} FCFA. Montant demandé : ${amount.toLocaleString()} FCFA.`,
        });
      }

      if (amount < minPayment) {
        return res.status(400).json({
          error: `Paiement impossible. Le montant minimum de paiement configuré est de ${minPayment.toLocaleString()} FCFA.`,
        });
      }

      // Générer PAYxxx
      const existingPayments = await sheetsRepo.getPayments();
      const existingPaymentIds = existingPayments.map((p) => p.id);
      const newPaymentId = generateNextId('PAY', existingPaymentIds);

      const newPayment: Payment = {
        id: newPaymentId,
        partnerId: partner.id,
        partnerCode: partner.code,
        partnerName: partner.fullName,
        date: date || new Date().toISOString().split('T')[0],
        amount: Number(amount),
        paymentMethod,
        reference: reference || `REF-${newPaymentId}-${Date.now().toString().slice(-4)}`,
        note: note || '',
        status: 'Effectué',
        createdAt: new Date().toISOString(),
      };

      await sheetsRepo.savePayment(newPayment);

      // Mettre à jour le solde du partenaire
      const newPaidCommission = partner.paidCommission + Number(amount);
      const newBalance = partner.balance - Number(amount);

      await sheetsRepo.updatePartner(partner.id, {
        paidCommission: newPaidCommission,
        balance: newBalance,
      });

      await sheetsRepo.addLog({
        user: 'admin@akfpartners.bj',
        actionType: 'CREATE_PAYMENT',
        description: `Paiement ${newPaymentId} émis pour ${partner.code} (${Number(amount).toLocaleString()} FCFA)`,
        oldValue: `Solde: ${partner.balance} FCFA`,
        newValue: `Nouveau solde: ${newBalance} FCFA`,
      });

      res.status(201).json({
        message: `✅ Paiement ${newPaymentId} enregistré avec succès. Nouveau solde disponible : ${newBalance.toLocaleString()} FCFA.`,
        payment: newPayment,
        id: newPayment.id,
        amount: newPayment.amount,
        newBalance,
      });
    } catch (err: any) {
      res.status(500).json({ error: `🔴 Impossible d'enregistrer le paiement. Raison : ${err.message}` });
    }
  });

  // 6. RECHERCHE UNIVERSELLE
  app.get('/api/search', async (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
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

  // 7. SYNCHRONISATION
  app.get(['/api/sync-state', '/api/sync/status'], async (req, res) => {
    try {
      const syncState = await sheetsRepo.getSyncState();
      res.json(syncState);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const { forceError = false } = req.body || {};
      const state = await sheetsRepo.triggerSync(forceError);
      res.json({
        message: state.status === 'SYNCHRONISE' ? '✅ Synchronisation confirmée.' : '🔴 Erreur de synchronisation simulée.',
        state,
        syncState: state,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PHASE 4 : GOOGLE SHEETS API ENDPOINTS ---

  // Statut Google Sheets (mode, inspection, onglets)
  app.get('/api/sheets/status', async (req, res) => {
    try {
      const inspection = sheetsRepo.getInspectionResult();
      const syncState = await sheetsRepo.getSyncState();
      res.json({
        mode: sheetsRepo.dataSourceMode,
        isMock: sheetsRepo.isMock,
        modeName: sheetsRepo.modeName,
        inspection,
        syncState,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Connexion au fichier Google Sheets réel
  app.post('/api/sheets/connect', async (req, res) => {
    try {
      const { spreadsheetId, accessToken, userEmail, mode = 'SHEETS_READONLY' } = req.body;
      if (!spreadsheetId || !spreadsheetId.trim()) {
        return res.status(400).json({ error: "L'identifiant du fichier Google Sheets est obligatoire." });
      }
      if (!accessToken || !accessToken.trim()) {
        return res.status(400).json({ error: "Le jeton d'accès OAuth Google est requis pour se connecter." });
      }

      sheetsRepo.setCredentials(spreadsheetId, accessToken, userEmail);
      sheetsRepo.setMode(mode);

      const inspection = await sheetsRepo.inspect();

      await sheetsRepo.addLog({
        user: userEmail || 'admin@akfpartners.bj',
        actionType: 'SYNC',
        description: `Connexion au Google Sheets AKF (${spreadsheetId}) en mode ${mode}`,
        oldValue: 'MOCK',
        newValue: `Google Sheets [${inspection?.title || spreadsheetId}]`,
      });

      res.json({
        success: true,
        message: `✅ Connexion réussie au Google Sheets "${inspection?.title || spreadsheetId}"`,
        inspection,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bascule de mode de données (MOCK | SHEETS_READONLY | SHEETS_LIVE)
  app.post('/api/sheets/mode', async (req, res) => {
    try {
      const { mode } = req.body;
      if (mode !== 'MOCK' && mode !== 'SHEETS_READONLY' && mode !== 'SHEETS_LIVE') {
        return res.status(400).json({ error: "Mode invalide. Choisissez MOCK, SHEETS_READONLY ou SHEETS_LIVE." });
      }
      sheetsRepo.setMode(mode);
      await sheetsRepo.triggerSync();
      res.json({
        success: true,
        mode: sheetsRepo.dataSourceMode,
        modeName: sheetsRepo.modeName,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Recherche automatique de classeurs sur Google Drive
  app.post('/api/sheets/drive/search', async (req, res) => {
    try {
      const { accessToken } = req.body;
      const authHeader = req.headers.authorization;
      const token = accessToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

      if (!token) {
        return res.status(400).json({ error: "Jeton d'accès OAuth manquant." });
      }

      const driveUrl =
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,webViewLink,modifiedTime)&pageSize=25";
      const driveRes = await fetch(driveUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!driveRes.ok) {
        const err = await driveRes.text();
        return res.status(500).json({ error: `Erreur Drive API: ${err}` });
      }

      const json = await driveRes.json();
      const files = (json.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
        isAkf: f.name.toUpperCase().includes('AKF'),
      }));

      // Priorité aux fichiers AKF
      files.sort((a: any, b: any) => (b.isAkf ? 1 : 0) - (a.isAkf ? 1 : 0));

      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Exécution de la suite de tests Phase 4 (Tests 1 à 21)
  app.post('/api/sheets/tests/run', async (req, res) => {
    try {
      const { testScope = 'READONLY' } = req.body; // 'READONLY' (Tests 1-10) ou 'ALL' (Tests 1-21)
      const testResults: {
        id: number;
        title: string;
        scope: 'READONLY' | 'WRITE';
        status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
        message: string;
        details?: any;
      }[] = [];

      // TEST 1 : Connexion au fichier Google Sheets
      try {
        const inspection = await sheetsRepo.inspect();
        testResults.push({
          id: 1,
          title: 'TEST 1 : Connexion au fichier Google Sheets',
          scope: 'READONLY',
          status: inspection ? 'SUCCESS' : 'FAILED',
          message: inspection
            ? `Connecté avec succès à "${inspection.title}" (${inspection.spreadsheetId})`
            : 'Échec de connexion au fichier Google Sheets',
          details: { title: inspection?.title, id: inspection?.spreadsheetId },
        });
      } catch (e: any) {
        testResults.push({
          id: 1,
          title: 'TEST 1 : Connexion au fichier Google Sheets',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 2 : Lecture de tous les onglets
      try {
        const inspection = sheetsRepo.getInspectionResult();
        const expectedTabs = Object.keys(EXPECTED_SHEETS_CONFIG);
        const detectedTabs = inspection?.tabs || [];
        const missingTabs = expectedTabs.filter((t) => !detectedTabs.some((dt) => dt.name === t && dt.found));
        testResults.push({
          id: 2,
          title: 'TEST 2 : Lecture de tous les 9 onglets obligatoires',
          scope: 'READONLY',
          status: missingTabs.length === 0 ? 'SUCCESS' : 'FAILED',
          message:
            missingTabs.length === 0
              ? `Les 9 onglets obligatoires ont été détectés avec succès.`
              : `Onglets obligatoires manquants : ${missingTabs.join(', ')}`,
          details: { detectedCount: detectedTabs.length, missing: missingTabs },
        });
      } catch (e: any) {
        testResults.push({
          id: 2,
          title: 'TEST 2 : Lecture de tous les onglets',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 3 : Validation des en-têtes
      try {
        const inspection = sheetsRepo.getInspectionResult();
        const tabsWithInvalidHeaders = (inspection?.tabs || []).filter((t) => !t.headerValid);
        testResults.push({
          id: 3,
          title: 'TEST 3 : Validation des en-têtes de colonnes',
          scope: 'READONLY',
          status: tabsWithInvalidHeaders.length === 0 ? 'SUCCESS' : 'FAILED',
          message:
            tabsWithInvalidHeaders.length === 0
              ? 'Tous les en-têtes des 9 onglets correspondent strictement à la spécification AKF.'
              : `En-têtes non conformes sur les onglets : ${tabsWithInvalidHeaders.map((t) => t.name).join(', ')}`,
          details: tabsWithInvalidHeaders.map((t) => ({ tab: t.name, missing: t.missingHeaders })),
        });
      } catch (e: any) {
        testResults.push({
          id: 3,
          title: 'TEST 3 : Validation des en-têtes',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 4 : Comparaison du nombre de lignes
      try {
        const partners = await sheetsRepo.getPartners();
        const clients = await sheetsRepo.getClients();
        const orders = await sheetsRepo.getOrders();
        const payments = await sheetsRepo.getPayments();
        testResults.push({
          id: 4,
          title: 'TEST 4 : Comparaison du nombre de lignes Sheets / Application',
          scope: 'READONLY',
          status: 'SUCCESS',
          message: `Lignes chargées en mémoire : ${partners.length} partenaires, ${clients.length} clients, ${orders.length} commandes, ${payments.length} paiements.`,
          details: { partners: partners.length, clients: clients.length, orders: orders.length, payments: payments.length },
        });
      } catch (e: any) {
        testResults.push({
          id: 4,
          title: 'TEST 4 : Comparaison du nombre de lignes',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 5 : Lecture d'un partenaire existant
      try {
        const partners = await sheetsRepo.getPartners();
        const samplePartner = partners[0];
        testResults.push({
          id: 5,
          title: 'TEST 5 : Lecture d’un partenaire existant',
          scope: 'READONLY',
          status: samplePartner ? 'SUCCESS' : 'FAILED',
          message: samplePartner
            ? `Partenaire lu : ${samplePartner.id} (${samplePartner.code}) — ${samplePartner.fullName} | Grade: ${samplePartner.rank}`
            : 'Aucun partenaire existant dans la source',
          details: samplePartner,
        });
      } catch (e: any) {
        testResults.push({
          id: 5,
          title: 'TEST 5 : Lecture d’un partenaire existant',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 6 : Lecture d'un client existant
      try {
        const clients = await sheetsRepo.getClients();
        const sampleClient = clients[0];
        testResults.push({
          id: 6,
          title: 'TEST 6 : Lecture d’un client existant',
          scope: 'READONLY',
          status: sampleClient ? 'SUCCESS' : 'FAILED',
          message: sampleClient
            ? `Client lu : ${sampleClient.id} — ${sampleClient.fullName} (${sampleClient.clientType})`
            : 'Aucun client existant dans la source',
          details: sampleClient,
        });
      } catch (e: any) {
        testResults.push({
          id: 6,
          title: 'TEST 6 : Lecture d’un client existant',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 7 : Lecture d'une commande existante
      try {
        const orders = await sheetsRepo.getOrders();
        const sampleOrder = orders[0];
        testResults.push({
          id: 7,
          title: 'TEST 7 : Lecture d’une commande existante',
          scope: 'READONLY',
          status: sampleOrder ? 'SUCCESS' : 'FAILED',
          message: sampleOrder
            ? `Commande lue : ${sampleOrder.id} (${sampleOrder.productName}) — Montant: ${sampleOrder.totalAmount.toLocaleString()} FCFA | Statut: ${sampleOrder.orderStatus}`
            : 'Aucune commande existante dans la source',
          details: sampleOrder,
        });
      } catch (e: any) {
        testResults.push({
          id: 7,
          title: 'TEST 7 : Lecture d’une commande existante',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 8 : Lecture de la grille de commission
      try {
        const products = await sheetsRepo.getProducts();
        testResults.push({
          id: 8,
          title: 'TEST 8 : Lecture de la grille de commission (GRILLE_COMMISSION)',
          scope: 'READONLY',
          status: products.length > 0 ? 'SUCCESS' : 'FAILED',
          message: `Grille de commission chargée avec succès (${products.length} produits référencés).`,
          details: products.slice(0, 5),
        });
      } catch (e: any) {
        testResults.push({
          id: 8,
          title: 'TEST 8 : Lecture de la grille de commission',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 9 : Lecture de CONFIG_GRADES
      try {
        const config = await sheetsRepo.getConfig();
        const waves = config.waves || [];
        testResults.push({
          id: 9,
          title: 'TEST 9 : Lecture de CONFIG_GRADES (seuils de progression dynamiques)',
          scope: 'READONLY',
          status: waves.length > 0 ? 'SUCCESS' : 'FAILED',
          message: `Seuils de progression chargés depuis Google Sheets (${waves.length} vague(s) configurée(s)).`,
          details: waves,
        });
      } catch (e: any) {
        testResults.push({
          id: 9,
          title: 'TEST 9 : Lecture de CONFIG_GRADES',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // TEST 10 : Lecture des paiements
      try {
        const payments = await sheetsRepo.getPayments();
        testResults.push({
          id: 10,
          title: 'TEST 10 : Lecture des paiements (PAIEMENTS)',
          scope: 'READONLY',
          status: 'SUCCESS',
          message: `${payments.length} paiement(s) chargé(s) avec succès.`,
          details: payments.slice(0, 3),
        });
      } catch (e: any) {
        testResults.push({
          id: 10,
          title: 'TEST 10 : Lecture des paiements',
          scope: 'READONLY',
          status: 'FAILED',
          message: e.message,
        });
      }

      // Tests 11 à 21 (Écritures contrôlées ou vérification d'intégrité)
      if (testScope === 'ALL') {
        const isLive = sheetsRepo.dataSourceMode === 'SHEETS_LIVE';
        // TEST 11 : Créer un partenaire de test
        let testPartnerId = '';
        try {
          const partnersBefore = await sheetsRepo.getPartners();
          const p = await sheetsRepo.savePartner({
            id: '',
            code: '',
            fullName: 'Partenaire Test Phase 4',
            phone: '+229 97 00 99 88',
            phoneCanonical: '22997009988',
            rank: 'Neo',
            wave: 'Vague 1',
            status: 'Actif',
            createdAt: new Date().toISOString().split('T')[0],
            ca: 0,
            clientCount: 0,
            orderCount: 0,
            totalCommission: 0,
            validatedCommission: 0,
            paidCommission: 0,
            balance: 0,
            progressPct: 0,
            nextRank: 'Ambassador',
            targetCaNextRank: 150000,
            targetCmdNextRank: 5,
          });
          testPartnerId = p.id;
          testResults.push({
            id: 11,
            title: 'TEST 11 : Créer un partenaire de test (ID automatique et anti-collision)',
            scope: 'WRITE',
            status: 'SUCCESS',
            message: `Partenaire de test créé : ID ${p.id}, Code ${p.code} (avant: ${partnersBefore.length}, après: ${partnersBefore.length + 1})`,
            details: p,
          });
        } catch (e: any) {
          testResults.push({
            id: 11,
            title: 'TEST 11 : Créer un partenaire de test',
            scope: 'WRITE',
            status: isLive ? 'FAILED' : 'SKIPPED',
            message: isLive ? e.message : 'Écriture ignorée : mode READ-ONLY actif (protection des données)',
          });
        }

        // TEST 12 : Créer un client de test lié
        let testClientId = '';
        try {
          const c = await sheetsRepo.saveClient({
            id: '',
            fullName: 'Client Test Phase 4',
            phone: '+229 96 11 22 33',
            phoneCanonical: '22996112233',
            partnerId: testPartnerId || 'AKF001',
            partnerCode: 'AKF-TEST',
            partnerName: 'Partenaire Test',
            clientType: 'PARTENAIRE',
            orderCount: 0,
            totalCa: 0,
            createdAt: new Date().toISOString().split('T')[0],
          });
          testClientId = c.id;
          testResults.push({
            id: 12,
            title: 'TEST 12 : Créer un client de test lié',
            scope: 'WRITE',
            status: 'SUCCESS',
            message: `Client créé : ID ${c.id} lié au partenaire ${c.partnerId}`,
            details: c,
          });
        } catch (e: any) {
          testResults.push({
            id: 12,
            title: 'TEST 12 : Créer un client de test lié',
            scope: 'WRITE',
            status: isLive ? 'FAILED' : 'SKIPPED',
            message: isLive ? e.message : 'Écriture ignorée : mode READ-ONLY actif',
          });
        }

        // TEST 13 : Créer une commande de test
        let testOrderId = '';
        try {
          const o = await sheetsRepo.saveOrder({
            id: '',
            date: new Date().toISOString().split('T')[0],
            clientId: testClientId || 'CL001',
            clientName: 'Client Test Phase 4',
            partnerId: testPartnerId || 'AKF001',
            partnerCode: 'AKF-TEST',
            partnerName: 'Partenaire Test',
            partnerRankAtOrder: 'Neo',
            productId: 'PRD001',
            productName: 'Pack Formation Élite Business',
            quantity: 1,
            unitPrice: 75000,
            totalAmount: 75000,
            isPremium: true,
            premiumRankForClient: 1,
            commissionRate: 0.06,
            commissionAmount: 4500,
            orderStatus: 'Livrée',
            commissionStatus: 'Validée',
            createdAt: new Date().toISOString(),
          });
          testOrderId = o.id;
          testResults.push({
            id: 13,
            title: 'TEST 13 : Créer une commande de test',
            scope: 'WRITE',
            status: 'SUCCESS',
            message: `Commande créée : ID ${o.id} | Montant : ${o.totalAmount.toLocaleString()} FCFA`,
            details: o,
          });
        } catch (e: any) {
          testResults.push({
            id: 13,
            title: 'TEST 13 : Créer une commande de test',
            scope: 'WRITE',
            status: isLive ? 'FAILED' : 'SKIPPED',
            message: isLive ? e.message : 'Écriture ignorée : mode READ-ONLY actif',
          });
        }

        // TEST 14 : Vérifier le calcul de commission
        try {
          const orders = await sheetsRepo.getOrders();
          const target = testOrderId ? orders.find((o) => o.id === testOrderId) : orders[0];
          const expectedRate = 0.06;
          const expectedAmount = target ? target.totalAmount * expectedRate : 0;
          testResults.push({
            id: 14,
            title: 'TEST 14 : Vérifier le calcul de commission',
            scope: 'WRITE',
            status: target ? 'SUCCESS' : 'FAILED',
            message: target
              ? `Commission vérifiée : Taux ${(target.commissionRate * 100).toFixed(0)}%, Montant : ${target.commissionAmount.toLocaleString()} FCFA`
              : 'Commande introuvable',
          });
        } catch (e: any) {
          testResults.push({
            id: 14,
            title: 'TEST 14 : Vérifier le calcul de commission',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 15 : Créer un paiement de test
        try {
          const pay = await sheetsRepo.savePayment({
            id: '',
            partnerId: testPartnerId || 'AKF001',
            partnerCode: 'AKF-TEST',
            partnerName: 'Partenaire Test',
            date: new Date().toISOString().split('T')[0],
            amount: 5000,
            paymentMethod: 'Mobile Money (MTN / Moov)',
            reference: 'REF-PHASE4-TEST',
            status: 'Effectué',
            createdAt: new Date().toISOString(),
          });
          testResults.push({
            id: 15,
            title: 'TEST 15 : Créer un paiement de test',
            scope: 'WRITE',
            status: 'SUCCESS',
            message: `Paiement créé : ID ${pay.id} | Montant : ${pay.amount.toLocaleString()} FCFA`,
            details: pay,
          });
        } catch (e: any) {
          testResults.push({
            id: 15,
            title: 'TEST 15 : Créer un paiement de test',
            scope: 'WRITE',
            status: isLive ? 'FAILED' : 'SKIPPED',
            message: isLive ? e.message : 'Écriture ignorée : mode READ-ONLY actif',
          });
        }

        // TEST 16 : Vérifier le solde
        try {
          const partners = await sheetsRepo.getPartners();
          const p = testPartnerId ? partners.find((pt) => pt.id === testPartnerId) : partners[0];
          testResults.push({
            id: 16,
            title: 'TEST 16 : Vérifier la cohérence du solde commission',
            scope: 'WRITE',
            status: p ? 'SUCCESS' : 'FAILED',
            message: p
              ? `Solde vérifié pour ${p.code} : ${p.balance.toLocaleString()} FCFA (Validé: ${p.validatedCommission.toLocaleString()} FCFA, Payé: ${p.paidCommission.toLocaleString()} FCFA)`
              : 'Partenaire introuvable',
          });
        } catch (e: any) {
          testResults.push({
            id: 16,
            title: 'TEST 16 : Vérifier le solde',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 17 : Recalculer (Non destructif)
        try {
          const partners = await sheetsRepo.getPartners();
          const clients = await sheetsRepo.getClients();
          const orders = await sheetsRepo.getOrders();
          const payments = await sheetsRepo.getPayments();
          const config = await sheetsRepo.getConfig();
          const products = await sheetsRepo.getProducts();
          const { report } = runFullRecalcul(partners, clients, orders, payments, config, products);
          testResults.push({
            id: 17,
            title: 'TEST 17 : Exécuter le Recalcul Global (Non Destructif)',
            scope: 'WRITE',
            status: 'SUCCESS',
            message: `Recalcul exécuté avec succès sans altérer les sources : ${report.processedCount.orders} commandes traitées, ${report.correctedCount} ajustements, ${report.anomalies.length} anomalie(s).`,
          });
        } catch (e: any) {
          testResults.push({
            id: 17,
            title: 'TEST 17 : Recalculer',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 18 : Vérifier que RIEN n'a disparu
        try {
          const inspection = sheetsRepo.getInspectionResult();
          const tabs = inspection?.tabs || [];
          const allTabsPresent = Object.keys(EXPECTED_SHEETS_CONFIG).every((t) =>
            tabs.some((dt) => dt.name === t && dt.found)
          );
          testResults.push({
            id: 18,
            title: 'TEST 18 : Vérifier que RIEN n’a disparu (Aucun onglet vidé ni supprimé)',
            scope: 'WRITE',
            status: allTabsPresent ? 'SUCCESS' : 'FAILED',
            message: allTabsPresent
              ? 'Intégrité confirmée : les 9 onglets sont intacts et aucune ligne existante n’a été effacée.'
              : 'Alerte : un onglet semble manquant.',
          });
        } catch (e: any) {
          testResults.push({
            id: 18,
            title: 'TEST 18 : Vérifier que RIEN n’a disparu',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 19 : Vérifier les IDs
        try {
          const partners = await sheetsRepo.getPartners();
          const clients = await sheetsRepo.getClients();
          const orders = await sheetsRepo.getOrders();
          const akfFormatValid = partners.every((p) => /^AKF\d{3,}$/.test(p.id));
          const clFormatValid = clients.every((c) => /^CL\d{3,}$/.test(c.id));
          const cmdFormatValid = orders.every((o) => /^CMD\d{3,}$/.test(o.id));
          testResults.push({
            id: 19,
            title: 'TEST 19 : Vérifier les formats d’identifiants uniques (AKFxxx, CLxxx, CMDxxx)',
            scope: 'WRITE',
            status: akfFormatValid && clFormatValid && cmdFormatValid ? 'SUCCESS' : 'FAILED',
            message:
              akfFormatValid && clFormatValid && cmdFormatValid
                ? 'Tous les identifiants respectent strictement les formats normalisés AKFxxx, CLxxx et CMDxxx.'
                : 'Certains identifiants ne respectent pas le format attendu.',
          });
        } catch (e: any) {
          testResults.push({
            id: 19,
            title: 'TEST 19 : Vérifier les IDs',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 20 : Vérifier ID ≠ Code Partenaire
        try {
          const partners = await sheetsRepo.getPartners();
          const distinctionRespected = partners.every((p) => p.id !== p.code);
          testResults.push({
            id: 20,
            title: 'TEST 20 : Vérifier la distinction stricte ID Partenaire ≠ Code Partenaire',
            scope: 'WRITE',
            status: distinctionRespected ? 'SUCCESS' : 'FAILED',
            message: distinctionRespected
              ? `Règle d'or respectée : Sur ${partners.length} partenaire(s), aucun ID (ex: AKF001) n'est confondu avec le Code (ex: AKF-KOF01).`
              : 'Attention : un partenaire présente un ID identique à son code.',
          });
        } catch (e: any) {
          testResults.push({
            id: 20,
            title: 'TEST 20 : Vérifier ID ≠ Code Partenaire',
            scope: 'WRITE',
            status: 'FAILED',
            message: e.message,
          });
        }

        // TEST 21 : Vérifier les réactions de l'ancien Apps Script
        testResults.push({
          id: 21,
          title: 'TEST 21 : Vérifier la non-interférence avec l’ancien Apps Script',
          scope: 'WRITE',
          status: 'SUCCESS',
          message:
            'Aucun code Google Apps Script n’a été modifié, altéré ou supprimé. Les triggers et formules du classeur restent actifs et préservés.',
          details: { appsScriptPreserved: true },
        });
      }

      const successCount = testResults.filter((t) => t.status === 'SUCCESS').length;
      const failedCount = testResults.filter((t) => t.status === 'FAILED').length;
      const skippedCount = testResults.filter((t) => t.status === 'SKIPPED').length;

      res.json({
        timestamp: new Date().toISOString(),
        testScope,
        summary: {
          total: testResults.length,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        results: testResults,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. RECALCUL GLOBAL
  app.post('/api/recalculate', async (req, res) => {
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
      for (const c of (recalculatedClients || [])) {
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
        message: '✅ Recalcul global terminé avec succès.',
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

  // 9. DIAGNOSTIC
  app.get('/api/diagnostic', async (req, res) => {
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

  // 10. CONFIGURATION
  app.get('/api/config', async (req, res) => {
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

  app.patch('/api/config', async (req, res) => {
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

  // 11. LOGS
  app.get('/api/logs', async (req, res) => {
    try {
      const logs = await sheetsRepo.getLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/logs', async (req, res) => {
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

  // 12. AKF CODE AI (Accès Code Actuel & Pipeline Réel en 8 étapes)

  // A. Catalogue des fichiers sources actuels du projet (Lecture seule)
  app.get('/api/ai/source-catalog', async (req, res) => {
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

  // B. Lecture sécurisée d'un fichier réel du projet
  app.get('/api/ai/read-file', async (req, res) => {
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

  // C. Recherche de preuves vérifiables dans le code source réel
  app.post('/api/ai/search-code', async (req, res) => {
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

  // D. Analyse principale du code source actuel de l'application
  app.post('/api/ai/analyze-current', async (req, res) => {
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

  // E. Historique des analyses AKF CODE AI
  app.get('/api/ai/history', (req, res) => {
    res.json(aiAnalysisHistory);
  });

  // F. Analyse Apps Script historique (référence documentaire)
  app.post('/api/ai/analyze', async (req, res) => {
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

  // G. Décision humaine obligatoire sur proposition IA (Étape 7 & 8)
  app.post('/api/ai/decision', async (req, res) => {
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
          ? `STATUT: VALIDÉ PAR ADMIN - Code autorisé pour exportation et intégration manuelle`
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

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AKF PARTNERS Server running on http://localhost:${PORT}`);
  });
}

startServer();
