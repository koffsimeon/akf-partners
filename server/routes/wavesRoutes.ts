import { Router, Request, Response } from 'express';
import { sheetsRepo } from '../sheetsRepository';
import { WaveConfig } from '../../src/types';

export const wavesRouter = Router();

// GET /api/waves : Liste des vagues configurées
wavesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const waves = await sheetsRepo.getWaves();
    res.json(waves);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waves : Créer ou mettre à jour une vague
wavesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      wave,
      ambassadorCmd = 8,
      ambassadorCa = 100000,
      excellenceCmd = 20,
      excellenceCa = 300000,
      signatureCmd = 50,
      signatureCa = 800000,
      active = false,
    } = req.body;

    if (!wave || !wave.trim()) {
      return res.status(400).json({ error: 'Le nom de la vague est obligatoire.' });
    }

    const newWave: WaveConfig = {
      wave: wave.trim(),
      ambassadorCmd: Number(ambassadorCmd) || 0,
      ambassadorCa: Number(ambassadorCa) || 0,
      excellenceCmd: Number(excellenceCmd) || 0,
      excellenceCa: Number(excellenceCa) || 0,
      signatureCmd: Number(signatureCmd) || 0,
      signatureCa: Number(signatureCa) || 0,
      active: Boolean(active),
    };

    const saved = await sheetsRepo.saveWave(newWave);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/waves/:name/activate : Déclarer une vague comme active
wavesRouter.post('/:name/activate', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const waves = await sheetsRepo.setActiveWave(name);
    res.json({
      message: `Vague "${name}" activée avec succès.`,
      waves,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
