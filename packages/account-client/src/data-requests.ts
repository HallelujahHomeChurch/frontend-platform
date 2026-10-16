import {AccountSessionError} from './session-client.js';

export type EmailCorrectionErrorCode =
  | 'ACC_CORRECTION_DISABLED' | 'ACC_CORRECTION_INVALID' | 'ACC_CORRECTION_INELIGIBLE'
  | 'ACC_CORRECTION_TARGET_UNAVAILABLE' | 'ACC_CORRECTION_REVIEWER_UNAVAILABLE'
  | 'ACC_CORRECTION_NOT_FOUND' | 'ACC_CORRECTION_CONFLICT' | 'ACC_CORRECTION_FORBIDDEN'
  | 'ACC_CORRECTION_VERIFICATION_INVALID' | 'ACC_REAUTH_EXPIRED' | 'ACC_REAUTH_CONFLICT'
  | 'ACC_REAUTH_FACTOR_INVALID' | 'ACC_REAUTH_MFA_REQUIRED' | 'ACC_AUTH_TOKEN_INVALID'
  | 'ACC_AUTH_RATE_LIMITED' | 'ACC_SERVICE_UNAVAILABLE';
export interface EmailCorrectionError {
  status: 'error';
  errorCode: EmailCorrectionErrorCode;
  serverTime: string;
}
export interface EmailCorrectionDiscovery {
  dataRequests: {emailCorrection: {enabled: boolean}};
}
export interface CorrectionField {
  key: 'currentEmail' | 'newEmail';
  type: 'email';
  labelKey: string;
  readOnly: boolean;
  required: boolean;
}
export interface CorrectionCatalog {
  items: {kind: 'email_change'; fields: [CorrectionField, CorrectionField]}[];
  currentEmail: string;
  serverTime: string;
  eligibility: {status: 'eligible'} | {status: 'ineligible'; errorCode: 'ACC_CORRECTION_DISABLED' | 'ACC_CORRECTION_EMAIL_UNVERIFIED' | 'ACC_CORRECTION_INELIGIBLE' | 'ACC_CORRECTION_REVIEWER_UNAVAILABLE'};
  allowedActions: 'reauth'[];
}
export interface CreateEmailReauth {kind: 'email_change'; newEmail: string}
export type EmailReauthProvider = 'google' | 'line' | 'microsoft';
interface EmailReauthBase {
  kind: 'email_change';
  intentId: string;
  requestVersion: number;
  currentEmail: string;
  newEmail: string;
  methods: ('password' | EmailReauthProvider)[];
  mfaRequired: boolean;
  expiresAt: string;
  serverTime: string;
  allowedActions: ('password' | 'oauth' | 'mfa' | 'submit' | 'cancel')[];
  errorCode?: 'ACC_REAUTH_FACTOR_INVALID' | 'ACC_REAUTH_PROVIDER_CANCELLED' | 'ACC_SERVICE_UNAVAILABLE' | 'ACC_CORRECTION_DISABLED';
}
export type EmailReauthView = EmailReauthBase & (
  | {status: 'ready'; proof: string; submissionNonce: string}
  | {status: 'factor_required' | 'mfa_required' | 'disabled'; proof?: never; submissionNonce?: never}
);
export interface EmailReauthOAuthStart {authorizationUrl: string; expiresAt: string; requestVersion: number}
export interface EmailCorrectionSubmitInput extends CreateEmailReauth {proof: string; submissionNonce: string}
export interface EmailCorrectionVersionInput {requestVersion: number}
export type EmailCorrectionStatus = 'pending_verification' | 'pending_approval' | 'completed' | 'cancelled' | 'superseded' | 'expired' | 'invalidated';
export interface EmailCorrectionRequest {
  id: string;
  kind: 'email_change';
  status: EmailCorrectionStatus;
  requestVersion: number;
  expiresAt: string;
  serverTime: string;
  allowedActions: ('cancel' | 'reapply' | 'resend_verification' | 'approve')[];
  currentEmail?: string;
  newEmail?: string;
  applicantId?: string;
  applicantName?: string;
  verifiedAt?: string;
  approvedBy?: string;
  completedAt?: string;
  verificationExpiresAt?: string;
}
export interface EmailCorrectionCurrent {request: EmailCorrectionRequest | null; serverTime: string}
export interface EmailCorrectionList {items: EmailCorrectionRequest[]; nextCursor?: string; serverTime: string}
export interface EmailCorrectionVerification {status: 'verified'; serverTime: string}

// Existing application transports own bearer-token recovery and CSRF; public verification bypasses both.
export interface DataRequestsOptions {
  method: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  cache: 'no-store';
  redirect: 'error';
  auth?: false;
  csrf?: false;
  retry?: false;
  credentials?: 'omit';
}
export type DataRequestsTransport = (path: string, options: DataRequestsOptions) => Promise<unknown>;

function record(v: unknown): v is Record<string, unknown> {return typeof v === 'object' && v !== null && !Array.isArray(v);}
function shape(v: unknown, required: readonly string[], optional: readonly string[] = []): v is Record<string, unknown> {
  return record(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}
function text(v: unknown): v is string {return typeof v === 'string' && v.length > 0;}
function timestamp(v: unknown): boolean {return text(v) && Number.isFinite(Date.parse(v));}
function version(v: unknown): boolean {return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;}
function choices(v: unknown, values: readonly string[]): boolean {return Array.isArray(v) && v.every(x => typeof x === 'string' && values.includes(x));}
function optional(v: Record<string, unknown>, keys: readonly string[], check: (x: unknown) => boolean): boolean {return keys.every(k => v[k] === undefined || check(v[k]));}
function catalog(v: unknown): boolean {
  return shape(v, ['items', 'currentEmail', 'serverTime', 'eligibility', 'allowedActions'])
    && text(v.currentEmail) && timestamp(v.serverTime) && choices(v.allowedActions, ['reauth'])
    && Array.isArray(v.items) && v.items.length <= 1 && v.items.every(item =>
      shape(item, ['kind', 'fields']) && item.kind === 'email_change'
      && Array.isArray(item.fields) && item.fields.length === 2 && item.fields.every(field =>
        shape(field, ['key', 'type', 'labelKey', 'readOnly', 'required'])
        && ['currentEmail', 'newEmail'].includes(String(field.key)) && field.type === 'email'
        && text(field.labelKey) && typeof field.readOnly === 'boolean' && typeof field.required === 'boolean'))
    && (shape(v.eligibility, ['status']) && v.eligibility.status === 'eligible'
      || shape(v.eligibility, ['status', 'errorCode']) && v.eligibility.status === 'ineligible'
      && typeof v.eligibility.errorCode === 'string'
      && ['ACC_CORRECTION_DISABLED', 'ACC_CORRECTION_EMAIL_UNVERIFIED', 'ACC_CORRECTION_INELIGIBLE', 'ACC_CORRECTION_REVIEWER_UNAVAILABLE'].includes(v.eligibility.errorCode));
}
function intent(v: unknown): boolean {
  return shape(v, ['kind', 'intentId', 'status', 'requestVersion', 'currentEmail', 'newEmail', 'methods', 'mfaRequired', 'expiresAt', 'serverTime', 'allowedActions'], ['errorCode', 'proof', 'submissionNonce'])
    && v.kind === 'email_change' && text(v.intentId) && /^[A-Za-z0-9_-]{43}=$/.test(v.intentId)
    && ['factor_required', 'mfa_required', 'ready', 'disabled'].includes(String(v.status))
    && version(v.requestVersion) && text(v.currentEmail) && text(v.newEmail)
    && choices(v.methods, ['password', 'google', 'line', 'microsoft']) && typeof v.mfaRequired === 'boolean'
    && timestamp(v.expiresAt) && timestamp(v.serverTime) && choices(v.allowedActions, ['password', 'oauth', 'mfa', 'submit', 'cancel'])
    && (v.errorCode === undefined || ['ACC_REAUTH_FACTOR_INVALID', 'ACC_REAUTH_PROVIDER_CANCELLED', 'ACC_SERVICE_UNAVAILABLE', 'ACC_CORRECTION_DISABLED'].includes(String(v.errorCode)))
    && (v.status === 'ready' ? text(v.proof) && text(v.submissionNonce) : !Object.hasOwn(v, 'proof') && !Object.hasOwn(v, 'submissionNonce'));
}
function requestView(v: unknown): boolean {
  return shape(v, ['id', 'kind', 'status', 'requestVersion', 'expiresAt', 'serverTime', 'allowedActions'], ['currentEmail', 'newEmail', 'applicantId', 'applicantName', 'verifiedAt', 'approvedBy', 'completedAt', 'verificationExpiresAt'])
    && text(v.id) && v.kind === 'email_change'
    && ['pending_verification', 'pending_approval', 'completed', 'cancelled', 'superseded', 'expired', 'invalidated'].includes(String(v.status))
    && version(v.requestVersion) && timestamp(v.expiresAt) && timestamp(v.serverTime)
    && choices(v.allowedActions, ['cancel', 'reapply', 'resend_verification', 'approve'])
    && optional(v, ['currentEmail', 'newEmail', 'applicantId', 'approvedBy'], text)
    && (v.applicantName === undefined || typeof v.applicantName === 'string')
    && optional(v, ['verifiedAt', 'completedAt', 'verificationExpiresAt'], timestamp);
}

export function createAccountDataRequestsClient(transport: DataRequestsTransport) {
  async function checked<T>(path: string, method: DataRequestsOptions['method'], validate: (v: unknown) => boolean, body?: unknown, publicRequest = false): Promise<T> {
    const value = await transport(path, {method, ...(body === undefined ? {} : {body}), cache: 'no-store', redirect: 'error',
      ...(publicRequest ? {auth: false as const, csrf: false as const, retry: false as const, credentials: 'omit' as const} : {})});
    if (!validate(value)) throw new AccountSessionError(200, 'INVALID_RESPONSE', 'Data request response is unavailable', {decodeStage: 'schema'});
    return value as T;
  }
  const reauth = (id: string) => `/data-requests/reauth/${encodeURIComponent(id)}`;
  const request = (id: string) => `/data-requests/requests/${encodeURIComponent(id)}`;
  const admin = '/admin/data-requests/requests';
  return {
    capability: () => checked<EmailCorrectionDiscovery>('/oauth-providers', 'GET', v => record(v)
      && shape(v.dataRequests, ['emailCorrection']) && shape(v.dataRequests.emailCorrection, ['enabled']) && typeof v.dataRequests.emailCorrection.enabled === 'boolean'),
    catalog: () => checked<CorrectionCatalog>('/data-requests/items', 'GET', catalog),
    createReauth: (input: CreateEmailReauth) => checked<EmailReauthView>('/data-requests/reauth', 'POST', intent, input),
    restoreReauth: (id: string) => checked<EmailReauthView>(reauth(id), 'GET', intent),
    cancelReauth: (id: string) => checked<void>(reauth(id), 'DELETE', v => v === undefined),
    password: (id: string, input: {password: string}) => checked<EmailReauthView>(`${reauth(id)}/password`, 'POST', intent, input),
    mfa: (id: string, input: {code: string}) => checked<EmailReauthView>(`${reauth(id)}/mfa`, 'POST', intent, input),
    oauth: (id: string, input: {provider: EmailReauthProvider}) => checked<EmailReauthOAuthStart>(`${reauth(id)}/oauth`, 'POST', v =>
      shape(v, ['authorizationUrl', 'expiresAt', 'requestVersion']) && text(v.authorizationUrl) && timestamp(v.expiresAt) && version(v.requestVersion), input),
    submit: (input: EmailCorrectionSubmitInput) => checked<EmailCorrectionRequest>('/data-requests/requests', 'POST', requestView, input),
    current: () => checked<EmailCorrectionCurrent>('/data-requests/requests/current', 'GET', v => shape(v, ['request', 'serverTime']) && timestamp(v.serverTime) && (v.request === null || requestView(v.request))),
    submission: (nonce: string) => checked<EmailCorrectionRequest>(`/data-requests/submissions/${encodeURIComponent(nonce)}`, 'GET', requestView),
    request: (id: string) => checked<EmailCorrectionRequest>(request(id), 'GET', requestView),
    cancel: (id: string, input: EmailCorrectionVersionInput) => checked<EmailCorrectionRequest>(`${request(id)}/cancel`, 'POST', requestView, input),
    resendVerification: (id: string, input: EmailCorrectionVersionInput) => checked<EmailCorrectionRequest>(`${request(id)}/resend-verification`, 'POST', requestView, input),
    verifyEmail: (input: {token: string}) => checked<EmailCorrectionVerification>('/data-requests/email-verification', 'POST', v => shape(v, ['status', 'serverTime']) && v.status === 'verified' && timestamp(v.serverTime), input, true),
    adminList: (input: {cursor?: string; limit?: 20} = {}) => {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set('cursor', input.cursor);
      if (input.limit !== undefined) query.set('limit', String(input.limit));
      return checked<EmailCorrectionList>(`${admin}${query.size ? `?${query}` : ''}`, 'GET', v => shape(v, ['items', 'serverTime'], ['nextCursor'])
        && Array.isArray(v.items) && v.items.every(requestView) && timestamp(v.serverTime) && (v.nextCursor === undefined || typeof v.nextCursor === 'string'));
    },
    adminRequest: (id: string) => checked<EmailCorrectionRequest>(`${admin}/${encodeURIComponent(id)}`, 'GET', requestView),
    approve: (id: string, input: EmailCorrectionVersionInput) => checked<EmailCorrectionRequest>(`${admin}/${encodeURIComponent(id)}/approve`, 'POST', requestView, input)
  };
}
export type AccountDataRequestsClient = ReturnType<typeof createAccountDataRequestsClient>;
