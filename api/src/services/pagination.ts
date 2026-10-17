/**
 * Offset/limit pagination helpers (Issue #1420).
 *
 * `parsePagination` validates raw query values; `buildPageMeta` produces the
 * metadata block returned alongside every paginated list response.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export interface PageParams {
  limit: number;
  offset: number;
}

export interface PageMeta {
  /** Total number of items across all pages. */
  total: number;
  /** Effective page size (after capping at MAX_PAGE_LIMIT). */
  limit: number;
  /** Zero-based index of the first item on this page. */
  offset: number;
  /** Number of items actually returned on this page. */
  count: number;
  /** True when another page exists after this one. */
  hasMore: boolean;
  /** Offset for the next page, or null on the last (or an out-of-range) page. */
  nextOffset: number | null;
  /** Offset for the previous page, or null on the first page. */
  prevOffset: number | null;
}

export type PaginationResult =
  | { ok: true; params: PageParams }
  | { ok: false; errors: string[] };

function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Validates `limit` and `offset` query values.
 *
 * - Both are optional; defaults are `limit = DEFAULT_PAGE_LIMIT`, `offset = 0`.
 * - Both must be base-10 non-negative integers; `limit` must be at least 1.
 * - A `limit` above `MAX_PAGE_LIMIT` is capped rather than rejected so
 *   clients asking for "everything" still get a bounded response.
 */
export function parsePagination(
  query: Record<string, unknown>,
  defaults: { limit?: number; maxLimit?: number } = {}
): PaginationResult {
  const defaultLimit = defaults.limit ?? DEFAULT_PAGE_LIMIT;
  const maxLimit = defaults.maxLimit ?? MAX_PAGE_LIMIT;
  const errors: string[] = [];

  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseNonNegativeInt(query.limit);
    if (parsed === null || parsed < 1) {
      errors.push('limit must be a positive integer');
    } else {
      limit = Math.min(parsed, maxLimit);
    }
  }

  let offset = 0;
  if (query.offset !== undefined) {
    const parsed = parseNonNegativeInt(query.offset);
    if (parsed === null) {
      errors.push('offset must be a non-negative integer');
    } else {
      offset = parsed;
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, params: { limit, offset } };
}

export function buildPageMeta(total: number, params: PageParams, count: number): PageMeta {
  const { limit, offset } = params;
  const end = offset + count;
  const hasMore = end < total;
  return {
    total,
    limit,
    offset,
    count,
    hasMore,
    nextOffset: hasMore ? end : null,
    prevOffset: offset > 0 ? Math.max(0, Math.min(offset, total) - limit) : null,
  };
}
