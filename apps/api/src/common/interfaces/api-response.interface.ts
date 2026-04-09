export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: Record<string, never>;
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  error: ApiError;
}
