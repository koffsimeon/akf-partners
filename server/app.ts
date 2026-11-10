import express from 'express';
import {
  partnersRouter,
  clientsRouter,
  ordersRouter,
  paymentsRouter,
  productsRouter,
  wavesRouter,
  sheetsRouter,
  systemRouter,
} from './routes';

export function createExpressApp() {
  const app = express();

  app.use(express.json());

  // Normalisation d'URL pour compatibilité Vercel Serverless
  // Sur Vercel, x-matched-path contient le chemin réel de la requête d'origine (ex: /api/partners)
  app.use((req, _res, next) => {
    const matchedPath = (req.headers['x-matched-path'] as string) || '';
    if (matchedPath && matchedPath.startsWith('/api')) {
      req.url = matchedPath;
    } else if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  // --- API ROUTERS ---
  app.use('/api/partners', partnersRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/waves', wavesRouter);
  app.use(sheetsRouter);
  app.use(systemRouter);

  // Fallback 404 pour l'API
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `Point d'accès API introuvable : ${req.method} ${req.originalUrl || req.url}` });
  });

  // Gestionnaire d'erreurs global (évite tout crash de la fonction Serverless)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Erreur API Express :', err);
    res.status(500).json({ error: err.message || 'Erreur interne du serveur backend' });
  });

  return app;
}

export const app = createExpressApp();
