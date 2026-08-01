export interface AccountSessionUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export * from './oauth.js';

export type AccountSession =
  | {authenticated: false}
  | {authenticated: true; user: AccountSessionUser};

export type AccountAuthResult =
  | {status: 'authenticated'; user: AccountSessionUser}
  | {status: 'anonymous'}
  | {status: 'unavailable'; error: unknown};

export interface AccountSessionReader {
  getSession(): Promise<AccountSession>;
}

export interface AccountSessionClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export class AccountSessionError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code?: string, message = 'Account session request failed') {
    super(message);
    this.name = 'AccountSessionError';
    this.status = status;
    this.code = code;
  }
}

export function createAccountSessionClient({
  baseUrl = '/api/account/v1',
  fetcher = fetch
}: AccountSessionClientOptions = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  async function request(path: string, init: RequestInit) {
    const response = await fetcher(`${normalizedBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {'accept': 'application/json', ...init.headers}
    });
    const body = await readJson(response);
    if (!response.ok) {
      const error = body as {error_code?: unknown; message?: unknown};
      throw new AccountSessionError(
        response.status,
        typeof error.error_code === 'string' ? error.error_code : undefined,
        typeof error.message === 'string' ? error.message : undefined
      );
    }
    return body;
  }

  return {
    async getSession(): Promise<AccountSession> {
      const body = await request('/session', {method: 'GET', cache: 'no-store'});
      if (!isAccountSession(body)) throw new AccountSessionError(200, 'INVALID_RESPONSE');
      return body;
    },

    async logout(): Promise<void> {
      const csrf = await request('/csrf-token', {method: 'GET', cache: 'no-store'});
      const token = isRecord(csrf) && typeof csrf.csrf_token === 'string' ? csrf.csrf_token : '';
      if (!token) throw new AccountSessionError(200, 'CSRF_TOKEN_REQUIRED');
      await request('/session/logout', {
        method: 'POST',
        headers: {'x-csrf-token': token}
      });
    },

    async logoutAll(): Promise<void> {
      const csrf = await request('/csrf-token', {method: 'GET', cache: 'no-store'});
      const token = isRecord(csrf) && typeof csrf.csrf_token === 'string' ? csrf.csrf_token : '';
      if (!token) throw new AccountSessionError(200, 'CSRF_TOKEN_REQUIRED');
      await request('/session/logout-all', {
        method: 'POST',
        headers: {'x-csrf-token': token}
      });
    }
  };
}

export type AccountSessionClient = ReturnType<typeof createAccountSessionClient>;

export async function resolveAccountAuth(client: AccountSessionReader): Promise<AccountAuthResult> {
  try {
    const session = await client.getSession();
    return session.authenticated
      ? {status: 'authenticated', user: session.user}
      : {status: 'anonymous'};
  } catch (error) {
    if (error instanceof AccountSessionError && (error.status === 400 || error.status === 401)) {
      return {status: 'anonymous'};
    }
    return {status: 'unavailable', error};
  }
}

export interface RefreshLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export function createRefreshCoordinator({locks = browserLockManager()}: {locks?: RefreshLockManager} = {}) {
  const requests = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, request: () => Promise<T>): Promise<T> {
      const pending = requests.get(key);
      if (pending) return pending as Promise<T>;

      const next = Promise.resolve()
        .then(() => locks ? locks.request(`hhc:refresh:${key}`, request) : request())
        .finally(() => requests.delete(key));
      requests.set(key, next);
      return next;
    }
  };
}

export async function retrySupersededRefresh<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isRefreshSuperseded(error)) throw error;
    return request();
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  return response.json();
}

function isAccountSession(value: unknown): value is AccountSession {
  if (!isRecord(value) || typeof value.authenticated !== 'boolean') return false;
  if (!value.authenticated) return true;
  const user = value.user;
  return isRecord(user)
    && typeof user.id === 'string'
    && typeof user.email === 'string'
    && typeof user.display_name === 'string'
    && (typeof user.avatar_url === 'string' || user.avatar_url === null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRefreshSuperseded(error: unknown): boolean {
  return isRecord(error)
    && error.status === 409
    && error.code === 'ACC_AUTH_REFRESH_SUPERSEDED';
}

function browserLockManager(): RefreshLockManager | undefined {
  if (typeof navigator === 'undefined' || !navigator.locks) return undefined;
  return navigator.locks as unknown as RefreshLockManager;
}
