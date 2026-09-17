import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  partnersRouter,
  clientsRouter,
  ordersRouter,
  paymentsRouter,
  sheetsRouter,
  systemRouter,
} from './server/routes';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // --- API ROUTERS ---
  app.use('/api/partners', partnersRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use(sheetsRouter);
  app.use(systemRouter);

  // --- VITE & STATIC SPA SERVE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AKF PARTNERS Server running on http://localhost:${PORT}`);
  });
}

startServer();
