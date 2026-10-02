import { AccountSessionError } from './session-client.js';

export type LegalScope = 'common' | 'verified-member';
export type LegalLocale = 'zh-Hant' | 'zh-Hans' | 'en' | 'ja' | 'ko';
export interface LegalDocument {
  schemaVersion: 1;
  template: 'legal.v1';
  data: {
    heroTitle: string;
    heroSubtitle?: string;
    updatedAtLabel: string;
    updatedAt: string;
    intro: string;
    sections: { title: string; body: string[] }[];
  };
}
export interface LegalManifest {
  scope: LegalScope;
  locale: LegalLocale;
  termsVersion: string;
  privacyNoticeVersion: string;
  termsSHA256: string;
  privacySHA256: string;
  commonTermsVersion?: string;
  commonPrivacyNoticeVersion?: string;
}
export interface LegalSnapshot {
  snapshotId: string;
  manifest: LegalManifest;
  documents: { terms: LegalDocument; privacy: LegalDocument };
}
export interface LegalStatus {
  required: boolean;
  manifest?: LegalManifest;
}
export interface LegalChallenge {
  challenge: string;
  snapshot: LegalSnapshot;
}
export interface LegalAcceptanceEvidence {
  id: string;
  user_id: string;
  scope: LegalScope;
  terms_version: string;
  privacy_notice_version: string;
  channel: string;
  locale: LegalLocale;
  accepted_at: string;
  snapshot_id: string | null;
  terms_sha256: string | null;
  privacy_sha256: string | null;
}
export interface LegalHistoryEntry {
  acceptance: LegalAcceptanceEvidence;
  evidenceAvailable: boolean;
  snapshot?: LegalSnapshot;
}
export type LegalRequest = (
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown },
) => Promise<unknown>;
const locales: readonly string[] = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}
function version(value: unknown): value is string {
  return typeof value === 'string' && versionPattern.test(value);
}
function locale(value: unknown): value is LegalLocale {
  return typeof value === 'string' && locales.includes(value);
}
function manifest(value: unknown): value is LegalManifest {
  if (
    !record(value) ||
    (value.scope !== 'common' && value.scope !== 'verified-member') ||
    !locale(value.locale) ||
    !version(value.termsVersion) ||
    !version(value.privacyNoticeVersion) ||
    !text(value.termsSHA256) ||
    !hashPattern.test(value.termsSHA256) ||
    !text(value.privacySHA256) ||
    !hashPattern.test(value.privacySHA256)
  )
    return false;
  return value.scope === 'common'
    ? value.commonTermsVersion === undefined &&
        value.commonPrivacyNoticeVersion === undefined
    : version(value.commonTermsVersion) &&
        version(value.commonPrivacyNoticeVersion);
}
function document(value: unknown): value is LegalDocument {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.template !== 'legal.v1' ||
    !record(value.data)
  )
    return false;
  const data = value.data;
  return (
    text(data.heroTitle) &&
    text(data.updatedAtLabel) &&
    text(data.updatedAt) &&
    text(data.intro) &&
    (data.heroSubtitle === undefined ||
      typeof data.heroSubtitle === 'string') &&
    Array.isArray(data.sections) &&
    data.sections.length > 0 &&
    data.sections.every(
      (section) =>
        record(section) &&
        text(section.title) &&
        Array.isArray(section.body) &&
        section.body.length > 0 &&
        section.body.every(text),
    )
  );
}
export function isLegalSnapshot(value: unknown): value is LegalSnapshot {
  return (
    record(value) &&
    uuid(value.snapshotId) &&
    manifest(value.manifest) &&
    record(value.documents) &&
    document(value.documents.terms) &&
    document(value.documents.privacy)
  );
}
function evidence(value: unknown): value is LegalAcceptanceEvidence {
  if (
    !record(value) ||
    !uuid(value.id) ||
    !uuid(value.user_id) ||
    (value.scope !== 'common' && value.scope !== 'verified-member') ||
    !version(value.terms_version) ||
    !version(value.privacy_notice_version) ||
    !text(value.channel) ||
    !locale(value.locale) ||
    !text(value.accepted_at) ||
    !Number.isFinite(Date.parse(value.accepted_at))
  )
    return false;
  if (value.snapshot_id === null)
    return (
      value.scope === 'common' &&
      value.terms_sha256 === null &&
      value.privacy_sha256 === null
    );
  return (
    uuid(value.snapshot_id) &&
    text(value.terms_sha256) &&
    hashPattern.test(value.terms_sha256) &&
    text(value.privacy_sha256) &&
    hashPattern.test(value.privacy_sha256)
  );
}
function invalid(): never {
  throw new AccountSessionError(
    200,
    'INVALID_RESPONSE',
    'Legal response is unavailable',
  );
}
function requireLocale(value: LegalLocale): void {
  if (!locale(value)) throw new Error('Unsupported legal language');
}

export function createAccountLegalClient(request: LegalRequest) {
  return {
    async status(language: LegalLocale): Promise<LegalStatus> {
      requireLocale(language);
      const value = await request(`/me/legal/status?locale=${language}`, {
        method: 'GET',
      });
      if (
        !record(value) ||
        typeof value.required !== 'boolean' ||
        (value.manifest !== undefined &&
          (!manifest(value.manifest) ||
            value.manifest.scope !== 'verified-member' ||
            value.manifest.locale !== language)) ||
        (value.required && value.manifest === undefined)
      )
        return invalid();
      return {
        required: value.required,
        ...(manifest(value.manifest) ? { manifest: value.manifest } : {}),
      };
    },
    async challenge(language: LegalLocale): Promise<LegalChallenge> {
      requireLocale(language);
      const value = await request('/me/legal/challenges', {
        method: 'POST',
        body: { locale: language },
      });
      if (
        !record(value) ||
        !text(value.challenge) ||
        !isLegalSnapshot(value.snapshot) ||
        value.snapshot.manifest.scope !== 'verified-member' ||
        value.snapshot.manifest.locale !== language
      )
        return invalid();
      return { challenge: value.challenge, snapshot: value.snapshot };
    },
    async confirm(
      challenge: string,
      accepted: boolean,
    ): Promise<LegalAcceptanceEvidence> {
      if (!challenge || accepted !== true)
        throw new Error('Explicit consent is required');
      const value = await request('/me/legal/confirm', {
        method: 'POST',
        body: { challenge, accepted: true },
      });
      if (!evidence(value) || value.scope !== 'verified-member')
        return invalid();
      return value;
    },
    async history(): Promise<LegalAcceptanceEvidence[]> {
      const value = await request('/me/legal/history', { method: 'GET' });
      if (!Array.isArray(value) || !value.every(evidence)) return invalid();
      return value;
    },
    async historyEntry(acceptanceId: string): Promise<LegalHistoryEntry> {
      if (!uuid(acceptanceId)) throw new Error('Invalid acceptance ID');
      const value = await request(`/me/legal/history/${acceptanceId}`, {
        method: 'GET',
      });
      if (
        !record(value) ||
        !evidence(value.acceptance) ||
        value.acceptance.id !== acceptanceId ||
        typeof value.evidenceAvailable !== 'boolean'
      )
        return invalid();
      if (
        value.evidenceAvailable &&
        (!isLegalSnapshot(value.snapshot) ||
          value.snapshot.snapshotId !== value.acceptance.snapshot_id ||
          value.snapshot.manifest.scope !== value.acceptance.scope ||
          value.snapshot.manifest.locale !== value.acceptance.locale ||
          value.snapshot.manifest.termsSHA256 !==
            value.acceptance.terms_sha256 ||
          value.snapshot.manifest.privacySHA256 !==
            value.acceptance.privacy_sha256 ||
          value.snapshot.manifest.termsVersion !==
            value.acceptance.terms_version ||
          value.snapshot.manifest.privacyNoticeVersion !==
            value.acceptance.privacy_notice_version)
      )
        return invalid();
      if (!value.evidenceAvailable && value.snapshot !== undefined)
        return invalid();
      return {
        acceptance: value.acceptance,
        evidenceAvailable: value.evidenceAvailable,
        ...(isLegalSnapshot(value.snapshot)
          ? { snapshot: value.snapshot }
          : {}),
      };
    },
  };
}
