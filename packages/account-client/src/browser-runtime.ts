import {
  buildAuthorizeUrl,
  clearOAuthTransaction,
  createOAuthTransactionOnce,
  exchangeAuthorizationCode,
  readOAuthTransaction,
  validateOAuthState
} from './oauth.js';
import {
  AccountSessionError,
  type AccountAccessToken,
  type AccountIdentitySession,
  resolveAccountAuth,
  type AccountSessionClient
} from './session-client.js';

export type AccountAuthState =
  | {status: 'checking'}
  | {status: 'anonymous'}
  | {status: 'authenticated'; session: AccountIdentitySession}
  | {status: 'unavailable'; error: AccountSessionError; retryAt?: number};

export type AccountAuthEvent = {
  stage: 'session' | 'authorize' | 'callback' | 'access_token' | 'refresh' | 'logout';
  outcome: 'started' | 'succeeded' | 'anonymous' | 'rejected' | 'rate_limited' | 'failed';
  status?: number;
  errorCode?: string;
  requestId?: string;
  retryAt?: number;
};

export type BrowserOAuthConfig = {
  /** Account authorization-server API base. Defaults to the callback origin. */
  authorizeBaseUrl?: string;
  clientId: string;
  redirectUri: string;
  scope: string;
};

type RuntimeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type BrowserAccountAuthRuntimeOptions = {
  client: AccountSessionClient;
  oauth?: BrowserOAuthConfig;
  now?: () => number;
  storage?: RuntimeStorage;
  onEvent?: (event: AccountAuthEvent) => void;
};

export interface BrowserAccountAuthRuntime {
  start(): Promise<AccountAuthState>;
  getSnapshot(): AccountAuthState;
  subscribe(listener: () => void): () => void;
  beginSignIn(returnTo?: string): Promise<void>;
  completeSignIn(callbackUrl?: string): Promise<AccountAuthState>;
  revalidate(): Promise<AccountAuthState>;
  getAccessToken(): Promise<string | null>;
  refreshAfterUnauthorized(rejectedToken: string): Promise<string | null>;
  clear(): void;
  dispose(): void;
}

const cooldownStorageKey = 'hhc:account-access-token-retry-at';

export function createBrowserAccountAuthRuntime({
  client,
  oauth,
  now = Date.now,
  storage = browserStorage(),
  onEvent
}: BrowserAccountAuthRuntimeOptions): BrowserAccountAuthRuntime {
  let state: AccountAuthState = {status: 'checking'};
  let token: string | undefined;
  let tokenExpiresAt = 0;
  let tokenInFlight: Promise<string | null> | undefined;
  let refreshInFlight: Promise<string | null> | undefined;
  let revalidationInFlight: Promise<AccountAuthState> | undefined;
  let generation = 0;
  let started = false;
  const listeners = new Set<() => void>();

  function emit(stage: AccountAuthEvent['stage'], outcome: AccountAuthEvent['outcome'], error?: unknown) {
    const metadata = error instanceof AccountSessionError ? {
      status: error.status,
      errorCode: error.code,
      requestId: error.requestId,
      retryAt: error.retryAt
    } : {};
    onEvent?.({stage, outcome, ...metadata});
  }

  function update(next: AccountAuthState) {
    state = next;
    for (const listener of listeners) listener();
    return state;
  }

  function install(next: AccountAccessToken, requestGeneration: number): string | null {
    if (requestGeneration !== generation) return null;
    token = next.accessToken;
    tokenExpiresAt = now() + next.expiresIn * 1_000;
    storage?.removeItem(cooldownStorageKey);
    return token;
  }

  function cooldownError(): AccountSessionError | undefined {
    const raw = storage?.getItem(cooldownStorageKey);
    if (!raw) return undefined;
    const retryAt = Number(raw);
    if (!Number.isFinite(retryAt) || retryAt <= now()) {
      storage?.removeItem(cooldownStorageKey);
      return undefined;
    }
    return new AccountSessionError(429, 'ACC_AUTH_RATE_LIMITED', 'Account access token is cooling down', {retryAt});
  }

  function rememberCooldown(error: unknown) {
    if (error instanceof AccountSessionError && error.status === 429 && error.retryAt) {
      storage?.setItem(cooldownStorageKey, String(error.retryAt));
    }
  }

  async function issueToken(): Promise<string | null> {
    const coolingDown = cooldownError();
    if (coolingDown) throw coolingDown;
    if (token && tokenExpiresAt - now() >= 30_000) return token;
    if (tokenInFlight) return tokenInFlight;

    const requestGeneration = generation;
    emit('access_token', 'started');
    const pending = client.issueAccessToken()
      .then((next) => {
        const installed = install(next, requestGeneration);
        emit('access_token', 'succeeded');
        return installed;
      })
      .catch((error: unknown) => {
        rememberCooldown(error);
        emit('access_token', error instanceof AccountSessionError && error.status === 429 ? 'rate_limited' : 'failed', error);
        throw error;
      })
      .finally(() => {
        if (tokenInFlight === pending) tokenInFlight = undefined;
      });
    tokenInFlight = pending;
    return pending;
  }

  async function refresh(rejectedToken: string): Promise<string | null> {
    if (token && token !== rejectedToken) return token;
    const coolingDown = cooldownError();
    if (coolingDown) throw coolingDown;
    if (refreshInFlight) return refreshInFlight;

    const requestGeneration = generation;
    emit('refresh', 'started');
    const pending = client.refreshAccessToken()
      .then((next) => {
        const installed = install(next, requestGeneration);
        emit('refresh', 'succeeded');
        return installed;
      })
      .catch((error: unknown) => {
        rememberCooldown(error);
        emit('refresh', error instanceof AccountSessionError && error.status === 429 ? 'rate_limited' : 'failed', error);
        throw error;
      })
      .finally(() => {
        if (refreshInFlight === pending) refreshInFlight = undefined;
      });
    refreshInFlight = pending;
    return pending;
  }

  function revalidate(): Promise<AccountAuthState> {
    if (revalidationInFlight) return revalidationInFlight;
    emit('session', 'started');
    const pending = resolveAccountAuth(client)
      .then((result): AccountAuthState => {
        if (result.status === 'authenticated') {
          emit('session', 'succeeded');
          return update(result);
        }
        if (result.status === 'anonymous') {
          emit('session', 'anonymous');
          return update(result);
        }
        const error = result.error instanceof AccountSessionError
          ? result.error
          : new AccountSessionError(0, 'ACCOUNT_SESSION_UNAVAILABLE');
        emit('session', 'failed', error);
        return update({status: 'unavailable', error, retryAt: error.retryAt});
      })
      .finally(() => {
        if (revalidationInFlight === pending) revalidationInFlight = undefined;
      });
    revalidationInFlight = pending;
    return pending;
  }

  const onActivity = () => { void revalidate(); };
  const onVisibility = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void revalidate();
  };

  function attachLifecycle() {
    if (started || typeof window === 'undefined') return;
    started = true;
    window.addEventListener('focus', onActivity);
    window.addEventListener('pageshow', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function detachLifecycle() {
    if (!started || typeof window === 'undefined') return;
    started = false;
    window.removeEventListener('focus', onActivity);
    window.removeEventListener('pageshow', onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  return {
    async start() {
      attachLifecycle();
      return revalidate();
    },
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async beginSignIn(returnTo = '/') {
      if (!oauth || !storage || typeof location === 'undefined') {
        throw new Error('Browser OAuth is not configured');
      }
      emit('authorize', 'started');
      const storageKey = oauthStorageKey(oauth.clientId);
      const transaction = await createOAuthTransactionOnce(returnTo, {
        storage: storage as Storage,
        storageKey,
        transactionOptions: {now}
      });
      const authorizeBaseUrl = oauthAuthorizeBaseUrl(oauth, location.href);
      location.assign(buildAuthorizeUrl({authorizeBaseUrl, ...oauth}, transaction).toString());
    },
    async completeSignIn(callbackUrl) {
      if (!oauth || !storage || typeof location === 'undefined') {
        throw new Error('Browser OAuth is not configured');
      }
      emit('callback', 'started');
      const url = new URL(callbackUrl ?? location.href, location.href);
      const redirect = new URL(oauth.redirectUri);
      const storageKey = oauthStorageKey(oauth.clientId);
      const transaction = readOAuthTransaction({storage: storage as Storage, storageKey, now});
      try {
        if (url.origin !== redirect.origin || url.pathname !== redirect.pathname) {
          throw new AccountSessionError(400, 'OAUTH_CALLBACK_MISMATCH');
        }
        const code = url.searchParams.get('code') ?? '';
        const callbackState = url.searchParams.get('state') ?? '';
        if (!code || !validateOAuthState(transaction, callbackState)) {
          throw new AccountSessionError(400, 'OAUTH_CALLBACK_INVALID');
        }
        const authorizeBaseUrl = oauthAuthorizeBaseUrl(oauth, redirect.href);
        const response = await exchangeAuthorizationCode({authorizeBaseUrl, ...oauth}, transaction, code);
        if (typeof response.expires_in === 'number') {
          install({accessToken: response.access_token, expiresIn: response.expires_in}, generation);
        }
        emit('callback', 'succeeded');
        return revalidate();
      } catch (error) {
        emit('callback', 'rejected', error);
        throw error;
      } finally {
        clearOAuthTransaction({storage: storage as Storage, storageKey});
      }
    },
    revalidate,
    getAccessToken: issueToken,
    refreshAfterUnauthorized: refresh,
    clear() {
      generation += 1;
      token = undefined;
      tokenExpiresAt = 0;
      storage?.removeItem(cooldownStorageKey);
      update({status: 'anonymous'});
    },
    dispose() {
      detachLifecycle();
      listeners.clear();
    }
  };
}

function browserStorage(): RuntimeStorage | undefined {
  return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
}

function oauthStorageKey(clientId: string): string {
  return `hhc:oauth:${clientId}`;
}

function oauthAuthorizeBaseUrl(oauth: BrowserOAuthConfig, base: string): string {
  return new URL(oauth.authorizeBaseUrl ?? '/api/account/v1', base).toString();
}
