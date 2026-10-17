/**
 * Sliding-Window Rate Limiting Middleware.
 * Prevents denial-of-service and brute-force attacks on simulation & transaction endpoints.
 *
 * The `RateLimiter` class below is the counting primitive; the Express
 * wrappers at the bottom of this file apply it to HTTP routes (see #1196).
 * Previously the limiter was exported from the barrel but never mounted.
 */

import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface ClientTracker {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private clients = new Map<string, ClientTracker>();
  private windowMs: number;
  private maxRequests: number;
  private nextCleanupAt = 0;

  constructor(options?: Partial<RateLimitOptions>) {
    this.windowMs = options?.windowMs ?? 60_000; // 1 minute
    this.maxRequests = options?.maxRequests ?? 100; // 100 req/min
  }

  public checkLimit(clientId: string, now: number = Date.now()): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetMs: number;
  } {
    this.removeExpiredClients(now);
    const existing = this.clients.get(clientId);

    if (!existing || now >= existing.resetTime) {
      const tracker: ClientTracker = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.clients.set(clientId, tracker);
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetMs: this.windowMs,
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs: Math.max(0, existing.resetTime - now),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - existing.count,
      resetMs: Math.max(0, existing.resetTime - now),
    };
  }

  /** Periodically remove idle buckets so expired clients do not accumulate. */
  private removeExpiredClients(now: number): void {
    if (now < this.nextCleanupAt) return;
    for (const [clientId, tracker] of this.clients) {
      if (now >= tracker.resetTime) this.clients.delete(clientId);
    }
    this.nextCleanupAt = now + this.windowMs;
  }

  public reset(clientId?: string): void {
    if (clientId) {
      this.clients.delete(clientId);
    } else {
      this.clients.clear();
    }
  }
}

/** Shared limiter for general API traffic (100 req/min per client). */
export const sharedRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
});

/** Stricter limiter for state-changing / emergency endpoints (20 req/min). */
export const strictRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
});

function clientIdFor(req: Request): string {
  // Request headers are supplied by the caller and are not verified identities.
  // Express only trusts proxy headers when the app explicitly configures trusted
  // proxy hops; with the default configuration req.ip resolves to the socket.
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/**
 * Create Express middleware backed by a `RateLimiter`.
 * Sets `RateLimit-*` headers and returns 429 when the window is exhausted.
 */
export function createRateLimitMiddleware(limiter?: RateLimiter) {
  const active = limiter || sharedRateLimiter;
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = clientIdFor(req);
    const result = active.checkLimit(clientId);
    res.setHeader('RateLimit-Limit', String(result.limit));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please retry later',
          retryAfter: Math.ceil(result.resetMs / 1000),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  };
}

/** Default per-route limiter — `app.use(rateLimitMiddleware)` or per-router. */
export const rateLimitMiddleware = createRateLimitMiddleware(sharedRateLimiter);

/** Stricter limiter for emergency / mutating routes. */
export const strictRateLimitMiddleware =
  createRateLimitMiddleware(strictRateLimiter);
