import { useCallback, useEffect, useState } from 'react';
import { ERRORS, type ApiError, type ErrorCode } from '@bg/contracts';

export class ApiFailure extends Error {
  readonly body: ApiError;
  readonly status: number;
  constructor(status: number, body: ApiError) {
    super(body.errorCode);
    this.status = status;
    this.body = body;
  }
  get messageFa(): string { return this.body.messageFa; }
}

const networkFailure = (code: ErrorCode = 'SERVICE_UNAVAILABLE') =>
  new ApiFailure(0, { errorCode: code, messageFa: navigator.onLine ? ERRORS[code] : 'اتصال اینترنت برقرار نیست.', requestId: '-' });

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'content-type': 'application/json' } : {},
      body: init.body !== undefined ? JSON.stringify(init.body) : null,
      signal: init.signal ?? null
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw networkFailure();
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw json && typeof json === 'object' && 'errorCode' in json
      ? new ApiFailure(res.status, json as ApiError)
      : new ApiFailure(res.status, { errorCode: 'INTERNAL_ERROR', messageFa: ERRORS.INTERNAL_ERROR, requestId: '-' });
  }
  return json as T;
}

export interface Resource<T> { data: T | undefined; error: ApiFailure | undefined; loading: boolean; reload: () => void }

/** GET with honest loading/error state. `path === null` skips the request. */
export function useApi<T>(path: string | null): Resource<T> {
  const [state, setState] = useState<{ data?: T; error?: ApiFailure; loading: boolean }>({ loading: path !== null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (path === null) return;
    const ctrl = new AbortController();
    setState((s) => ({ data: s.data, loading: true }));
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ data, loading: false }))
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') return;
        setState({ error: error instanceof ApiFailure ? error : networkFailure('INTERNAL_ERROR'), loading: false });
      });
    return () => ctrl.abort();
  }, [path, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
