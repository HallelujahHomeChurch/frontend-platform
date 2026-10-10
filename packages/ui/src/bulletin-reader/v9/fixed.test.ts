import {describe, expect, it} from 'vitest';
import {bulletinFixedText, readBulletinTemplateSnapshot, type BulletinTemplateSnapshot} from './fixed.js';

const snapshot: BulletinTemplateSnapshot = {version: 2, visionMission: '新的異象文字', visionFellowship: '新的團契文字', visionCommitment: '新的堅持文字'};

describe('V9 immutable church-value resolution', () => {
  it('uses the issue snapshot without mutating it or consulting current settings', () => {
    const original = structuredClone(snapshot);
    expect(bulletinFixedText('visionMission', undefined, 0, snapshot).text).toBe('異象使命：新的異象文字');
    expect(bulletinFixedText('visionFellowship', undefined, 0, snapshot).text).toBe('團契行動：新的團契文字');
    expect(bulletinFixedText('visionCommitment', undefined, 0, snapshot).text).toBe('堅持理想：新的堅持文字');
    expect(bulletinFixedText('visionMission', undefined, 0, {...snapshot, version: 3, visionMission: '另一版'}).text).toBe('異象使命：另一版');
    expect(snapshot).toEqual(original);
  });

  it('uses Simplified labels and already-converted values, never browser conversion', () => {
    const simplified = {...snapshot, visionMission: '新的异象文字', visionFellowship: '新的团契文字', visionCommitment: '新的坚持文字'};
    expect(bulletinFixedText('visionMission', undefined, 0, simplified, 16, 'zh-Hans')).toEqual({text: '异象使命：新的异象文字', fontRole: 'emphasis', annotatable: false});
    expect(bulletinFixedText('visionFellowship', undefined, 0, simplified, 16, 'zh-Hans').text).toBe('团契行动：新的团契文字');
    expect(bulletinFixedText('visionCommitment', undefined, 0, simplified, 16, 'zh-Hans').text).toBe('坚持理想：新的坚持文字');
  });

  it('preserves non-setting canonical labels', () => {
    expect(bulletinFixedText('title', {title: 'Canonical', subtitle: '', issueNumber: 1741, date: '2026-10-04'}, 0, snapshot).text).toBe('Canonical');
    expect(bulletinFixedText('welcomeLabel', undefined, 0, snapshot).text).toBe('一、Welcome：');
  });

  it.each([undefined, null, [], {}, {...snapshot, version: 0}, {...snapshot, version: 1.5}, {...snapshot, version: Number.MAX_SAFE_INTEGER + 1}, {...snapshot, sourceAssetId: 'private'}, {...snapshot, visionMission: ''}, {...snapshot, visionMission: ' x '}, {...snapshot, visionMission: 'x\ny'}, {...snapshot, visionMission: 'x\u202ey'}, {...snapshot, visionMission: 'x\u2028y'}, {...snapshot, visionMission: '\ud800'}, {...snapshot, visionMission: '文'.repeat(65)}])('rejects malformed or unsafe immutable inputs %#', value => {
    expect(() => readBulletinTemplateSnapshot(value)).toThrow('invalid_template_snapshot');
  });

  it('accepts a bounded normalized snapshot', () => {
    expect(readBulletinTemplateSnapshot(snapshot)).toBe(snapshot);
  });
});
