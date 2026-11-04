import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import { Product } from '../../src/types';

export const productsRouter = Router();

// GET /api/products : Récupérer tous les produits
productsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const products = await sheetsRepo.getProducts();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products : Créer un nouveau produit
productsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      price,
      category = 'PREMIUM',
      commissionType = 'Pourcentage',
      commissionNeo = 0,
      commissionAmbassador = 0,
      commissionExcellence = 0,
      commissionSignature = 0,
      conditions = '',
      isPremium = category === 'PREMIUM',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
    }
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Le prix de vente doit être un nombre positif.' });
    }

    const productId = id && id.trim()
      ? id.trim()
      : `PRD-${Date.now().toString(36).toUpperCase()}`;

    const newProduct: Product = {
      id: productId,
      name: name.trim(),
      price: Number(price),
      category: category.toUpperCase() === 'RÉCURRENT' || category.toUpperCase() === 'RECURRENT' ? 'RÉCURRENT' : 'PREMIUM',
      commissionType: commissionType === 'Forfaitaire' ? 'Forfaitaire' : 'Pourcentage',
      commissionNeo: Number(commissionNeo) || 0,
      commissionAmbassador: Number(commissionAmbassador) || 0,
      commissionExcellence: Number(commissionExcellence) || 0,
      commissionSignature: Number(commissionSignature) || 0,
      conditions: conditions || '',
      isPremium: isPremium ?? (category.toUpperCase() === 'PREMIUM'),
    };

    const saved = await sheetsRepo.saveProduct(newProduct);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id : Modifier un produit
productsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.price !== undefined && (isNaN(Number(updates.price)) || Number(updates.price) < 0)) {
      return res.status(400).json({ error: 'Le prix de vente doit être positif.' });
    }

    const updated = await sheetsRepo.updateProduct(id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id : Supprimer un produit
productsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await sheetsRepo.deleteProduct(id);
    if (!success) {
      return res.status(404).json({ error: `Produit introuvable : ${id}` });
    }
    res.json({ success: true, message: `Produit ${id} supprimé avec succès.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
