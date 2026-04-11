export interface PaginationQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  search: string | null;
}
