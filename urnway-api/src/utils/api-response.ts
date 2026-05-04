type ApiMeta = Record<string, unknown> | null;

export function ok<T>(data: T, meta: ApiMeta = null) {
  return {
    data,
    error: null,
    meta,
  };
}

export function fail(message: string, details?: unknown) {
  return {
    data: null,
    error: {
      message,
      details: details ?? null,
    },
    meta: null,
  };
}
