import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import { generateNextId } from '../../src/engine/akfEngine';
import { Payment } from '../../src/types';

export const paymentsRouter = Router();

// GET /api/payments
paymentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const payments = await sheetsRepo.getPayments();
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments
paymentsRouter.post('/', async (req: Request, res: Response) => {
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
      message: `Paiement ${newPaymentId} enregistré avec succès. Nouveau solde disponible : ${newBalance.toLocaleString()} FCFA.`,
      payment: newPayment,
      id: newPayment.id,
      amount: newPayment.amount,
      newBalance,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible d'enregistrer le paiement. Raison : ${err.message}` });
  }
});

// Protection stricte de l'intangibilité
paymentsRouter.delete('/:id', (_req: Request, res: Response) => {
  res.status(403).json({
    error: 'Règle d\'or AKF : Les règlements enregistrés dans "PAIEMENTS" sont intangibles et ne peuvent être supprimés ni modifiés rétroactivement.',
  });
});

paymentsRouter.patch('/:id', (_req: Request, res: Response) => {
  res.status(403).json({
    error: 'Règle d\'or AKF : Les règlements enregistrés dans "PAIEMENTS" sont intangibles et ne peuvent être supprimés ni modifiés rétroactivement.',
  });
});
