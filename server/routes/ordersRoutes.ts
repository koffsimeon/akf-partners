import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import {
  computeOrderCommission,
  generateNextId,
  getRankProgression,
  isCommissionAcquiredOrderStatus,
  isCompletedOrderStatus,
} from '../../src/engine/akfEngine';
import { CommissionStatus, Order, Partner } from '../../src/types';

export const ordersRouter = Router();

// GET /api/products
ordersRouter.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await sheetsRepo.getProducts();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders
ordersRouter.get('/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await sheetsRepo.getOrders();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
ordersRouter.post('/orders', async (req: Request, res: Response) => {
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
      message: `Commande ${newOrderId} créée avec succès. Montant : ${totalAmount.toLocaleString()} FCFA. Commission : ${commissionCalc.commissionAmount.toLocaleString()} FCFA.`,
      order: newOrder,
      id: newOrder.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible d'enregistrer la commande. Raison : ${err.message}` });
  }
});

// PATCH /api/orders/:id
ordersRouter.patch('/orders/:id', async (req: Request, res: Response) => {
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
      message: `Commande ${id} mise à jour avec le statut "${orderStatus}". Commission : ${finalCommissionStatus}.`,
      order: updatedOrder,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur lors de la mise à jour de la commande : ${err.message}` });
  }
});

// DELETE /api/orders/:id
ordersRouter.delete('/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = await sheetsRepo.getOrders();
    const order = orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ error: `Commande ${id} introuvable.` });

    // 1. Règle métier : Annulée -> conserver l'historique pour la piste d'audit
    if (order.orderStatus === 'Annulée') {
      return res.status(400).json({
        error: `Suppression interdite : Une commande au statut "Annulée" (${order.id}) fait partie intégrante de la piste d'audit obligatoire AKF et ne peut être supprimée définitivement.`,
      });
    }

    // 2. Règle métier : "Terminée" avec commission acquise ou payée -> suppression interdite
    if (order.orderStatus === 'Terminée' || order.orderStatus === 'Livrée') {
      if (order.commissionStatus === 'Payée') {
        return res.status(403).json({
          error: `Suppression strictement interdite : Cette commande est "Terminée" et sa commission (${order.commissionAmount.toLocaleString()} FCFA) a déjà été payée ou incluse dans un règlement.`,
        });
      }
      return res.status(403).json({
        error: `Suppression interdite : Cette commande est "Terminée" avec commission acquise (${order.commissionAmount.toLocaleString()} FCFA). Une commande ayant un historique financier validé ne peut jamais disparaître simplement pour modifier le solde d'un partenaire.`,
      });
    }

    // 3. Règle métier : "Confirmée" -> suppression autorisée TANT QU'aucune commission n'est acquise ou payée
    if (order.orderStatus === 'Confirmée') {
      if (order.commissionStatus === 'Payée') {
        return res.status(403).json({
          error: `Suppression strictement interdite : Cette commande confirmée possède une commission déjà payée (${order.commissionAmount.toLocaleString()} FCFA).`,
        });
      }
      if (order.commissionStatus === 'Validée') {
        return res.status(403).json({
          error: `Suppression interdite : Cette commande confirmée possède une commission déjà validée (${order.commissionAmount.toLocaleString()} FCFA).`,
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
          error: `Suppression strictement interdite : Le partenaire ${order.partnerCode || order.partnerId} a déjà perçu des règlements enregistrés dans "PAIEMENTS". La suppression de cette commande impacterait illégalement l'équilibre comptable.`,
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
      message: `La commande ${order.id} a été supprimée avec succès. Le CA, les commandes, les commissions et le solde du partenaire ainsi que les données du client ont été recalculés.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur lors de la suppression de la commande : ${err.message}` });
  }
});
