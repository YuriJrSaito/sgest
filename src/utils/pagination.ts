import type { PaginatedResponse, PaginationParams } from '../types';

interface PaginationDefaults {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

// Evita cargas excessivas por pagina.
const DEFAULT_MAX_LIMIT = 100;

export function normalizePagination(
  params: PaginationParams = {},
  defaults: PaginationDefaults = {}
) {
  const pageDefault = defaults.page ?? 1;
  const limitDefault = defaults.limit ?? 10;
  const maxLimit = defaults.maxLimit ?? DEFAULT_MAX_LIMIT;

  const rawPage = params.page ?? pageDefault;
  const rawLimit = params.limit ?? limitDefault;

  const page = Math.max(1, Math.floor(rawPage));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(rawLimit)));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
