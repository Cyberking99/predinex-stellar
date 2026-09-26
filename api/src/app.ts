import express, { Express, Request, Response } from 'express';
import { corsMiddleware } from './config/cors.js';
import budgetRouter from './routes/budget.js';
import referralRouter from './routes/referral.js';

/**
 * Creates and configures the Express application instance.
 * Installs CORS ahead of routes with explicit configuration.
 */
export function createApp(): Express {
  const app = express();

  // 1. Install CORS middleware ahead of all routes
  app.use(corsMiddleware);

  // 2. Request body parsing
  app.use(express.json());

  // 3. Basic health check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 4. Mount routes
  app.use('/api/budget', budgetRouter);
  app.use('/api/referral', referralRouter);
  app.use('/api', referralRouter);

  return app;
}

export const app = createApp();
export default app;
