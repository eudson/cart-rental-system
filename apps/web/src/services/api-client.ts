import { useAuthStore } from '@/store/auth-store';

const DEFAULT_API_BASE_URL = 'http://localhost:3000/v1';

export class ApiClientError extends Error {
  statusCode: number;
  code: string | null;

  constructor(message: string, statusCode: number, code: string | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
  } | null;
}

interface ApiSuccessEnvelope<TData> {
  data: TData;
  meta?: Record<string, unknown>;
  error: null;
}

export interface ApiResponseWithMeta<TData> {
  data: TData;
  meta: Record<string, unknown>;
}

interface ApiRequestOptions<TBody> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

function buildFetchHeaders<TBody>(options: ApiRequestOptions<TBody>): Headers {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

async function executeApiRequest<TResponse, TBody = undefined>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<ApiSuccessEnvelope<TResponse>> {
  const method = options.method ?? 'GET';
  const headers = buildFetchHeaders(options);

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    let envelope: ApiErrorEnvelope | null = null;

    try {
      envelope = (await response.json()) as ApiErrorEnvelope;
    } catch {
      envelope = null;
    }

    const message = envelope?.error?.message ?? 'Request failed';
    const code = envelope?.error?.code ?? null;

    throw new ApiClientError(message, response.status, code);
  }

  if (response.status === 204) {
    return {
      data: undefined as TResponse,
      meta: {},
      error: null,
    };
  }

  return (await response.json()) as ApiSuccessEnvelope<TResponse>;
}

export function buildQueryString(query: object): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      value !== undefined &&
      value !== null
    ) {
      continue;
    }

    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0)
    ) {
      continue;
    }

    params.set(key, String(value));
  }

  const encodedQuery = params.toString();
  return encodedQuery ? `?${encodedQuery}` : '';
}

export async function apiRequestWithMeta<TResponse, TBody = undefined>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<ApiResponseWithMeta<TResponse>> {
  const envelope = await executeApiRequest<TResponse, TBody>(path, options);

  return {
    data: envelope.data,
    meta: envelope.meta ?? {},
  };
}

export async function apiRequest<TResponse, TBody = undefined>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
  const envelope = await executeApiRequest<TResponse, TBody>(path, options);
  return envelope.data;
}
