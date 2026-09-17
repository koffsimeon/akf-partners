import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import { generateNextId, normalizePhone } from '../../src/engine/akfEngine';
import { Client, Partner } from '../../src/types';

export const clientsRouter = Router();

// GET /api/clients
clientsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const clients = await sheetsRepo.getClients();
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id
clientsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const clients = await sheetsRepo.getClients();
    const client = clients.find((c) => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    res.json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
clientsRouter.post('/', async (req: Request, res: Response) => {
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
        error: `Ce numéro de téléphone (${norm.canonical}) est déjà associé au client ${duplicate.id} (${duplicate.fullName}).`,
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
      message: `Client ${newId} (${fullName}) enregistré avec succès.`,
      client: newClient,
      id: newClient.id,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible d'enregistrer le client. Raison : ${err.message}` });
  }
});

// PATCH /api/clients/:id
clientsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { partnerId, fullName, phone, whatsapp, city, address, notes } = req.body;
    const client = (await sheetsRepo.getClients()).find((c) => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });

    // Règle métier : limitation si le client a déjà des commandes
    if (partnerId !== undefined && partnerId !== client.partnerId && (client.orderCount || 0) > 0) {
      return res.status(400).json({
        error: `Règle métier AKF : Le client ${client.fullName} (${client.id}) possède déjà ${client.orderCount} commande(s). La réattribution de partenaire est restreinte pour préserver l'historique des commissions et des ventes.`,
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

// DELETE /api/clients/:id
clientsRouter.delete('/:id', async (req: Request, res: Response) => {
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
        error: `Suppression interdite : Le client "${client.fullName}" (${client.id}) est rattaché à ${effectiveOrderCount} commande(s) dans l'historique commercial. La suppression briserait l'intégrité de la base de données et l'historique des commissions.`,
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
      message: `Le client "${client.fullName}" (${client.id}) a été supprimé définitivement.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible de supprimer le client : ${err.message}` });
  }
});
