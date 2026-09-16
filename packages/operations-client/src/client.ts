import createClient from 'openapi-fetch';
import type {paths} from './generated.js';
import type {OperationsAccessSnapshot} from './access.js';

export class OperationsApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string, message = 'Operations request failed') {
    super(message);
    this.name = 'OperationsApiError';
    this.status = status;
    this.code = code;
  }
}

export function createOperationsClient(options: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  const authenticatedFetch: typeof fetch = async (input, init) => {
    const token = await options.getAccessToken();
    const request = withToken(new Request(input, init), token);
    const response = await fetcher(request.clone());
    if (response.status !== 401 || !token) return response;

    const refreshed = await options.refreshAfterUnauthorized(token);
    if (!refreshed) return response;
    return fetcher(withToken(request, refreshed));
  };
  const raw = createClient<paths>({
    baseUrl: absoluteBaseUrl(options.baseUrl),
    fetch: authenticatedFetch
  });

  async function unwrap<T>(request: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
    const result = await request;
    if (result.error !== undefined || !result.response.ok) throw await apiError(result.response, result.error);
    if (result.data === undefined) throw new OperationsApiError(result.response.status, 'invalid_response');
    return result.data;
  }

  return {
    raw,
    getMyAccess(signal?: AbortSignal): Promise<OperationsAccessSnapshot> {
      // Gateway derives X-HHC-Scopes from the verified token; browsers must not synthesize it.
      return unwrap(raw.GET('/api/operations/me/access', {signal, cache: 'no-store'} as never));
    }
  };
}

function withToken(request: Request, token: string | null): Request {
  const headers = new Headers(request.headers);
  headers.set('accept', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  else headers.delete('authorization');
  return new Request(request, {headers});
}

async function apiError(response: Response, body: unknown): Promise<OperationsApiError> {
  let value = body;
  if (value === undefined) {
    try { value = await response.clone().json(); } catch { value = undefined; }
  }
  const record = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return new OperationsApiError(
    response.status,
    typeof record.error_code === 'string' ? record.error_code : undefined,
    typeof record.message === 'string' ? record.message : undefined
  );
}

function absoluteBaseUrl(value: string): string {
  const base = value.replace(/\/$/, '');
  if (/^https?:\/\//.test(base)) return base;
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL(base || '/', origin).toString().replace(/\/$/, '');
}
