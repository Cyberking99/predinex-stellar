/**
 * Predinex API — Express application factory.
 *
 * Builds the HTTP server that mounts all eight route modules under `/api/*`
 * (see #1194, #1197) with authentication and rate limiting applied to every
 * route (see #1196):
 *
 *   /api/budget       budget planner (plan, portfolio, liquidity, fees, risk)
 *   /api/compliance   compliance checks + officer-gated registration
 *   /api/emergency    emergency controls (admin-gated mutations, real txs)
 *   /api/gas-estimate gas estimation + optimization suggestions
 *   /api/insurance    insurance pools, quotes, purchases, claims
 *   /api/referral     referral stub (explicit 501 until on-chain wiring)
 *   /api/reputation   reputation profiles, simulation, leaderboard
 *   /api/simulation   position-health simulation
 *
 * Health:
 *   GET /health      liveness probe (200 when the process is up)
 *   GET /api/health  same payload under the API prefix
 *   GET /api/openapi.json  OpenAPI document served from config/swagger
 */

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { budgetRouter } from './routes/budget.js';
import { complianceRouter } from './routes/compliance.js';
import { emergencyRouter } from './routes/emergency.js';
import { gasEstimateRouter } from './routes/gasEstimate.js';
import { insuranceRouter } from './routes/insurance.js';
import { referralRouter } from './routes/referral.js';
import { reputationRouter } from './routes/reputation.js';
import { simulationRouter } from './routes/simulation.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { openApiDoc } from './config/swagger.js';

export const API_VERSION = '1.0.0';

function healthPayload() {
  return {
    success: true,
    service: 'predinex-api',
    version: API_VERSION,
    uptimeSecs: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  // Global rate limiting; routers add auth + stricter per-route limits.
  app.use(rateLimitMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json(healthPayload());
  });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json(healthPayload());
  });
  app.get('/api/openapi.json', (_req: Request, res: Response) => {
    res.json(openApiDoc);
  });

  app.use('/api/budget', budgetRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/emergency', emergencyRouter);
  app.use('/api/gas-estimate', gasEstimateRouter);
  app.use('/api/insurance', insuranceRouter);
  app.use('/api/referral', referralRouter);
  app.use('/api/reputation', reputationRouter);
  app.use('/api/simulation', simulationRouter);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Unknown API route' },
      timestamp: new Date().toISOString(),
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled API error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err?.message || 'Internal server error',
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export default createApp;
