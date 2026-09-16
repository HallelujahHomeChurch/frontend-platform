export interface AccountSessionUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export type PermissionAvailabilityWire =
  | {status: 'available'}
  | {
      status: 'unavailable';
      code: 'permission_unavailable';
      request_id?: string;
      retry_at?: number;
    };

export type AccountSession =
  | {authenticated: false}
  | {
      authenticated: true;
      user: AccountSessionUser;
      permissions: string[];
      permission_availability: PermissionAvailabilityWire;
    };

export interface AccountSessionReader {
  getSession(): Promise<AccountSession>;
}

export interface AccountSessionClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  now?: () => number;
}

export interface AccountAccessToken {
  accessToken: string;
  expiresIn: number;
}

export class AccountSessionError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryAt?: number;

  constructor(
    status: number,
    code?: string,
    message = 'Account session request failed',
    metadata: {requestId?: string; retryAt?: number} = {}
  ) {
    super(message);
    this.name = 'AccountSessionError';
    this.status = status;
    this.code = code;
    this.requestId = metadata.requestId;
    this.retryAt = metadata.retryAt;
  }
}

export function authActionForStatus(status: number): 'refresh-once' | 'forbidden' | 'cooldown' | 'fail' {
  if (status === 401) return 'refresh-once';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'cooldown';
  return 'fail';
}

export function createAccountSessionClient({
  baseUrl = '/api/account/v1',
  fetcher = fetch,
  now = Date.now
}: AccountSessionClientOptions = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  let csrfValue: string | undefined;
  let csrfInFlight: Promise<string> | undefined;

  async function request(path: string, init: RequestInit) {
    const response = await fetcher(`${normalizedBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {'accept': 'application/json', ...init.headers}
    });
    const body = await readJson(response, now());
    if (!response.ok) throw responseError(response, body, now());
    return body;
  }

  function csrfToken(): Promise<string> {
    if (csrfValue) return Promise.resolve(csrfValue);
    if (csrfInFlight) return csrfInFlight;
    csrfInFlight = request('/csrf-token', {method: 'GET', cache: 'no-store'})
      .then((body) => {
        const token = isRecord(body) && typeof body.csrf_token === 'string' ? body.csrf_token : '';
        if (!token) throw new AccountSessionError(200, 'CSRF_TOKEN_REQUIRED');
        csrfValue = token;
        return token;
      })
      .finally(() => { csrfInFlight = undefined; });
    return csrfInFlight;
  }

  async function protectedRequest(path: string, init: RequestInit = {}, retried = false): Promise<unknown> {
    const token = await csrfToken();
    try {
      return await request(path, {
        ...init,
        method: init.method ?? 'POST',
        headers: {...init.headers, 'x-csrf-token': token}
      });
    } catch (error) {
      if (retried || !isCsrfRejection(error)) throw error;
      csrfValue = undefined;
      return protectedRequest(path, init, true);
    }
  }

  function readAccessToken(body: unknown): AccountAccessToken {
    if (!isRecord(body) || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      throw new AccountSessionError(200, 'INVALID_RESPONSE');
    }
    return {accessToken: body.access_token, expiresIn: body.expires_in};
  }

  return {
    async getSession(): Promise<AccountSession> {
      const body = await request('/session', {method: 'GET', cache: 'no-store'});
      if (!isAccountSession(body)) throw new AccountSessionError(200, 'INVALID_RESPONSE');
      return body;
    },

    async issueAccessToken(): Promise<AccountAccessToken> {
      return readAccessToken(await protectedRequest('/session/access-token'));
    },

    async refreshAccessToken(): Promise<AccountAccessToken> {
      return readAccessToken(await protectedRequest('/refresh', {
        headers: {'content-type': 'application/json'},
        body: '{}'
      }));
    },

    async logout(): Promise<void> {
      await protectedRequest('/session/logout');
    },

    async logoutAll(): Promise<void> {
      await protectedRequest('/session/logout-all');
    }
  };
}

export type AccountSessionClient = ReturnType<typeof createAccountSessionClient>;

async function readJson(response: Response, currentTime: number): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    throw new AccountSessionError(response.status, 'INVALID_RESPONSE', undefined, responseMetadata(response, currentTime));
  }
}

function responseError(response: Response, body: unknown, currentTime: number): AccountSessionError {
  const error = isRecord(body) ? body : {};
  return new AccountSessionError(
    response.status,
    typeof error.error_code === 'string' ? error.error_code : undefined,
    typeof error.message === 'string' ? error.message : undefined,
    responseMetadata(response, currentTime)
  );
}

function responseMetadata(response: Response, currentTime: number) {
  return {
    requestId: response.headers.get('x-request-id') ?? undefined,
    retryAt: response.status === 429
      ? retryAtFrom(response.headers.get('retry-after'), currentTime)
      : undefined
  };
}

function retryAtFrom(value: string | null, currentTime: number): number {
  if (value && /^\d+$/.test(value.trim())) return currentTime + Number(value) * 1_000;
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > currentTime ? timestamp : currentTime + 60_000;
}

function isAccountSession(value: unknown): value is AccountSession {
  if (!isRecord(value) || typeof value.authenticated !== 'boolean') return false;
  if (!value.authenticated) return Object.keys(value).length === 1;
  return isSessionUser(value.user)
    && isPermissionList(value.permissions)
    && isPermissionAvailability(value.permission_availability);
}

function isSessionUser(value: unknown): value is AccountSessionUser {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.display_name === 'string'
    && (typeof value.avatar_url === 'string' || value.avatar_url === null);
}

function isPermissionAvailability(value: unknown): value is PermissionAvailabilityWire {
  if (!isRecord(value)) return false;
  if (value.status === 'available') return true;
  return value.status === 'unavailable'
    && value.code === 'permission_unavailable'
    && (value.request_id === undefined || typeof value.request_id === 'string')
    && (value.retry_at === undefined || typeof value.retry_at === 'number');
}

function isPermissionList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(permission => typeof permission === 'string' && permission.length > 0);
}

function isCsrfRejection(error: unknown): boolean {
  return error instanceof AccountSessionError
    && error.status === 403
    && ['ACC_AUTH_CSRF_INVALID', 'ACC_CSRF_TOKEN_MISSING', 'ACC_CSRF_TOKEN_INVALID'].includes(error.code ?? '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
