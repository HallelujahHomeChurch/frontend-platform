export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  returnTo: string;
  createdAt: number;
}

export interface OAuthClientConfig {
  authorizeBaseUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export interface OAuthTransactionOptions {
  randomBytes?: (size: number) => Uint8Array;
  now?: () => number;
}

const defaultTransactionMaxAge = 10 * 60 * 1_000;

export async function createOAuthTransaction(
  returnTo: string,
  options: OAuthTransactionOptions = {}
): Promise<OAuthTransaction> {
  const getRandomBytes = options.randomBytes ?? randomBytes;
  const codeVerifier = base64UrlEncode(getRandomBytes(32));
  return {
    state: base64UrlEncode(getRandomBytes(24)),
    codeVerifier,
    codeChallenge: await createCodeChallenge(codeVerifier),
    returnTo: safeReturnTo(returnTo),
    createdAt: options.now?.() ?? Date.now()
  };
}

export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildAuthorizeUrl(
  config: OAuthClientConfig,
  transaction: OAuthTransaction,
  options: {prompt?: 'none'} = {}
): URL {
  const url = new URL(`${config.authorizeBaseUrl.replace(/\/$/, '')}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('code_challenge', transaction.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (options.prompt) url.searchParams.set('prompt', options.prompt);
  return url;
}

export function saveOAuthTransaction(
  transaction: OAuthTransaction,
  {storage, storageKey}: {storage: Storage; storageKey: string}
): void {
  storage.setItem(storageKey, JSON.stringify(transaction));
}

export function readOAuthTransaction({
  storage,
  storageKey,
  now = Date.now,
  maxAgeMs = defaultTransactionMaxAge
}: {
  storage: Storage;
  storageKey: string;
  now?: () => number;
  maxAgeMs?: number;
}): OAuthTransaction | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    const currentTime = now();
    if (!isOAuthTransaction(value) || currentTime - value.createdAt > maxAgeMs || value.createdAt > currentTime) {
      storage.removeItem(storageKey);
      return null;
    }
    return value;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

export function clearOAuthTransaction({storage, storageKey}: {storage: Storage; storageKey: string}): void {
  storage.removeItem(storageKey);
}

export function validateOAuthState(transaction: OAuthTransaction | null, state: string): transaction is OAuthTransaction {
  return transaction !== null && transaction.state.length > 0 && transaction.state === state;
}

export function currentReturnTo(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return safeReturnTo(`${location.pathname}${location.search}${location.hash}`);
}

export function safeReturnTo(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function isOAuthTransaction(value: unknown): value is OAuthTransaction {
  if (!isRecord(value)) return false;
  return typeof value.state === 'string'
    && typeof value.codeVerifier === 'string'
    && typeof value.codeChallenge === 'string'
    && typeof value.returnTo === 'string'
    && typeof value.createdAt === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
