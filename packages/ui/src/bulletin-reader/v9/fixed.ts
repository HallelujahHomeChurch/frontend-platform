import {bulletinFixedText as legacyText, type BulletinFixedSlot, type BulletinCanonicalMetadata} from '../v6/fixed.js';
import type {components} from '../generated.js';

export type BulletinTemplateSnapshot = components['schemas']['BulletinTemplateSettings'];

export function readBulletinTemplateSnapshot(value: unknown): BulletinTemplateSnapshot {
  const fields = ['visionMission', 'visionFellowship', 'visionCommitment'] as const;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 4 || Object.keys(value).some(key => key !== 'version' && !fields.some(field => field === key))) throw new Error('invalid_template_snapshot');
  const snapshot = value as Partial<BulletinTemplateSnapshot>;
  if (typeof snapshot.version !== 'number' || !Number.isSafeInteger(snapshot.version) || snapshot.version < 1 || fields.some(field => {
    const text = snapshot[field];
    return typeof text !== 'string' || !text.length || text !== text.trim() || Array.from(text).length > 64 || /[\p{Cc}\p{Cf}\u2028\u2029\uD800-\uDFFF]/u.test(text);
  })) throw new Error('invalid_template_snapshot');
  return snapshot as BulletinTemplateSnapshot;
}

export function bulletinFixedText(element: BulletinFixedSlot['element'], metadata: BulletinCanonicalMetadata | undefined, pageNumber: number, snapshot: BulletinTemplateSnapshot, sourcePageCount?: number, locale: 'zh-Hant' | 'zh-Hans' = 'zh-Hant') {
  const value = legacyText(element, metadata, pageNumber, sourcePageCount, locale);
  if (element === 'visionMission' || element === 'visionFellowship' || element === 'visionCommitment') {
    const labels = {visionMission: ['異象使命', '异象使命'], visionFellowship: ['團契行動', '团契行动'], visionCommitment: ['堅持理想', '坚持理想']};
    return {...value, text: `${labels[element][locale === 'zh-Hans' ? 1 : 0]}：${snapshot[element]}`};
  }
  return value;
}

export {bulletinFixedGraphic, bulletinFixedDecoration} from '../v6/fixed.js';
