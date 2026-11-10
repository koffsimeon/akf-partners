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
  // Si Vercel retire le préfixe /api lors de la réécriture, on le réinjecte
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/api')) {
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

  return app;
}

export const app = createExpressApp();
