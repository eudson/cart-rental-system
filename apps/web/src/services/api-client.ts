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

interface ApiRequestOptions<TBody> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

export async function apiRequest<TResponse, TBody = undefined>(
  path: string,
  options: ApiRequestOptions<TBody> = {},
): Promise<TResponse> {
  const { accessToken } = useAuthStore.getState();
  const method = options.method ?? 'GET';

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

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
    return undefined as TResponse;
  }

  const envelope = (await response.json()) as ApiSuccessEnvelope<TResponse>;
  return envelope.data;
}
