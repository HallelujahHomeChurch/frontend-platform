export type AccountRequestEndpoint = 'csrf' | 'access_token' | 'refresh' | 'session' | 'logout' | 'logout_all' | 'oauth_token' | 'unknown';
export type AccountDecodeStage = 'content_type' | 'json' | 'schema';
export type AccountRequestMetadata = {
  requestId?: string;
  retryAt?: number;
  retryAfter?: string;
  serverTime?: string;
  endpoint?: AccountRequestEndpoint;
  method?: string;
  decodeStage?: AccountDecodeStage;
};

export class AccountSessionError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryAt?: number;
  readonly retryAfter?: string;
  readonly serverTime?: string;
  readonly endpoint?: AccountRequestEndpoint;
  readonly method?: string;
  readonly decodeStage?: AccountDecodeStage;

  constructor(
    status: number,
    code?: string,
    message = 'Account session request failed',
    metadata: AccountRequestMetadata = {}
  ) {
    super(message);
    this.name = 'AccountSessionError';
    this.status = status;
    this.code = code;
    this.requestId = metadata.requestId;
    this.retryAt = metadata.retryAt;
    this.retryAfter = metadata.retryAfter;
    this.serverTime = metadata.serverTime;
    this.endpoint = metadata.endpoint;
    this.method = metadata.method;
    this.decodeStage = metadata.decodeStage;
  }
}

export function accountResponseMetadata(response: Response, currentTime = Date.now()) {
  return {
    requestId: safeRequestId(response.headers.get('x-hhc-request-id') ?? response.headers.get('x-request-id')),
    retryAfter: response.headers.get('retry-after') ?? undefined,
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

function safeRequestId(value: string | null): string | undefined {
  return value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : undefined;
}
