/**
 * Referral API routes.
 *
 * The referral program is an explicit stub: it is exported and mounted on the
 * HTTP server (see #1197) with authentication, rate limiting and input
 * validation applied (see #1196), but the on-chain referral contract is not
 * yet wired. Mutations therefore return an explicit 501 NOT_IMPLEMENTED
 * instead of a fabricated success payload.
 */
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { SecuritySanitizer } from '../middleware/security.js';

const router = Router();
export const referralRouter = router;

router.use(authMiddleware);
router.use(rateLimitMiddleware);

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Referral API',
    version: '1.0.0',
    status: 'stub',
    timestamp: new Date().toISOString(),
  });
});

router.post(
  '/',
  [
    body('referrer')
      .optional()
      .isString()
      .custom((value) => {
        if (value === undefined) return true;
        return SecuritySanitizer.isValidStellarAddress(value);
      })
      .withMessage('Invalid referrer Stellar address'),
    body('referee')
      .optional()
      .isString()
      .custom((value) => {
        if (value === undefined) return true;
        return SecuritySanitizer.isValidStellarAddress(value);
      })
      .withMessage('Invalid referee Stellar address'),
    body('code')
      .optional()
      .isString()
      .isLength({ min: 1, max: 64 })
      .withMessage('Referral code must be 1-64 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid referral payload',
          details: errors.array(),
        },
        timestamp: new Date().toISOString(),
      });
    }
    if (!SecuritySanitizer.isSafeJson(req.body)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MALFORMED_INPUT',
          message: 'Invalid payload structure detected',
        },
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message:
          'Referral program is not yet wired to an on-chain contract. No referral was created.',
      },
      timestamp: new Date().toISOString(),
    });
  }
);

export default router;
