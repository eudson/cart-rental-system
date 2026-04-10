import type { PaginationMeta } from './pagination-meta.interface';

interface PaginationMetaInput {
  page: number;
  pageSize: number;
  totalItems: number;
  search?: string;
}

export function buildPaginationMeta(input: PaginationMetaInput): PaginationMeta {
  const totalPages =
    input.totalItems === 0 ? 0 : Math.ceil(input.totalItems / input.pageSize);

  return {
    page: input.page,
    pageSize: input.pageSize,
    totalItems: input.totalItems,
    totalPages,
    search: input.search ?? null,
  };
}

export function calculatePaginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
