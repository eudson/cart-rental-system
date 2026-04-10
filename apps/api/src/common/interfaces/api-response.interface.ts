export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: Record<string, unknown>;
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  error: ApiError;
}
