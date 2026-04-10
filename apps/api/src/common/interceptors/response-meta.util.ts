export interface ResponseWithMeta<T> {
  __responseMeta: true;
  payload: T;
  meta: Record<string, unknown>;
}

export function withResponseMeta<T>(
  payload: T,
  meta: Record<string, unknown>,
): ResponseWithMeta<T> {
  return {
    __responseMeta: true,
    payload,
    meta,
  };
}

export function isResponseWithMeta<T>(value: unknown): value is ResponseWithMeta<T> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    '__responseMeta' in value &&
    (value as { __responseMeta?: unknown }).__responseMeta === true &&
    'payload' in value &&
    'meta' in value
  );
}
