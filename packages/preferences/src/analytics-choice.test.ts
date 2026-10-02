import { describe, expect, it } from 'vitest';
import { getAnalyticsChoiceCookie, readAnalyticsChoice } from './index.js';

describe('optional analytics choice', () => {
  it('treats absent, malformed, unknown and conflicting values as unchosen', () => {
    for (const cookie of [
      '',
      'hhc_analytics=granted',
      'hhc_analytics=v2.granted',
      'hhc_analytics=%ZZ',
      'hhc_analytics=v1.granted; hhc_analytics=v1.denied',
    ])
      expect(readAnalyticsChoice(cookie)).toBe('unknown');
    expect(readAnalyticsChoice('hhc_analytics=v1.granted')).toBe('granted');
    expect(readAnalyticsChoice('hhc_analytics=v1.denied')).toBe('denied');
  });
  it('shares a six-month choice only between the approved hosts', () => {
    expect(
      getAnalyticsChoiceCookie('granted', {
        hostname: 'www.alive.org.tw',
        protocol: 'https:',
      }),
    ).toBe(
      'hhc_analytics=v1.granted; Max-Age=15552000; Path=/; SameSite=Lax; Domain=.alive.org.tw; Secure',
    );
    for (const hostname of [
      'admin.alive.org.tw',
      'evilalive.org.tw',
      'preview.alive.org.tw',
      'localhost',
    ])
      expect(
        getAnalyticsChoiceCookie('denied', { hostname, protocol: 'http:' }),
      ).not.toContain('Domain=');
  });
});
