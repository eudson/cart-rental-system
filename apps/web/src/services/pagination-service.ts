import type { PaginationMeta } from 'shared';

const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  search: null,
};

export function getPaginationMeta(meta: Record<string, unknown>): PaginationMeta {
  const pagination = meta.pagination as Partial<PaginationMeta> | undefined;

  if (
    !pagination ||
    typeof pagination.page !== 'number' ||
    typeof pagination.pageSize !== 'number' ||
    typeof pagination.totalItems !== 'number' ||
    typeof pagination.totalPages !== 'number'
  ) {
    return DEFAULT_PAGINATION_META;
  }

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    search:
      typeof pagination.search === 'string' || pagination.search === null
        ? pagination.search
        : null,
  };
}
