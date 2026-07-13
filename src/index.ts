export interface AccountSessionUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export type AccountSession =
  | {authenticated: false}
  | {authenticated: true; user: AccountSessionUser};

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
    }
  };
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
