import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimitMiddleware, RateLimiter } from '../src/middleware/rate-limit.js';

function request(ip: string, apiKey: string, forwardedFor: string): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: { 'x-api-key': apiKey, 'x-forwarded-for': forwardedFor },
  } as unknown as Request;
}

function response() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & typeof res;
}

describe('rate limit identity', () => {
  it('keeps changing API keys and forwarded headers in the same socket IP bucket', () => {
    const middleware = createRateLimitMiddleware(new RateLimiter({ windowMs: 60_000, maxRequests: 1 }));
    const next = vi.fn() as unknown as NextFunction;

    const firstResponse = response();
    middleware(request('192.0.2.10', 'unregistered-one', '198.51.100.1'), firstResponse, next);
    expect(next).toHaveBeenCalledTimes(1);

    const secondResponse = response();
    const secondNext = vi.fn() as unknown as NextFunction;
    middleware(request('192.0.2.10', 'unregistered-two', '203.0.113.9'), secondResponse, secondNext);

    expect(secondNext).not.toHaveBeenCalled();
    expect(secondResponse.status).toHaveBeenCalledWith(429);
  });
});
