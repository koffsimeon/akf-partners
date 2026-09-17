import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import {
  generateNextId,
  getRankProgression,
  normalizePhone,
  partnerIdToCode,
} from '../../src/engine/akfEngine';
import { Partner } from '../../src/types';

export const partnersRouter = Router();

// GET /api/partners
partnersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const partners = await sheetsRepo.getPartners();
    res.json(partners);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/partners/:id
partnersRouter.get('/:id', async (req: Request, res: Response) => {
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

// POST /api/partners
partnersRouter.post('/', async (req: Request, res: Response) => {
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
        error: `Ce numéro de téléphone (${norm.canonical}) est déjà associé au partenaire ${existingDuplicate.code} (${existingDuplicate.fullName}).`,
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
      message: `Partenaire ${newCode} (${fullName}) créé avec succès.`,
      partner: newPartner,
      id: newPartner.id,
      code: newPartner.code,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible d'enregistrer le partenaire. Raison : ${err.message}` });
  }
});

// Update handler logic
const handleUpdatePartner = async (req: Request, res: Response) => {
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
          error: `Le numéro ${norm.canonical} est déjà attribué à un autre partenaire (${duplicate.code} - ${duplicate.fullName}).`,
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
      message: `Partenaire ${partner.code} mis à jour avec succès.`,
      partner: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT & PATCH /api/partners/:id
partnersRouter.put('/:id', handleUpdatePartner);
partnersRouter.patch('/:id', handleUpdatePartner);

// POST /api/partners/:id/promote
partnersRouter.post('/:id/promote', async (req: Request, res: Response) => {
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
      message: `Le partenaire ${partner.fullName} (${partner.code}) est officiellement promu au grade ${newRank}.`,
      partner: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erreur lors de la promotion du partenaire : ${err.message}` });
  }
});
