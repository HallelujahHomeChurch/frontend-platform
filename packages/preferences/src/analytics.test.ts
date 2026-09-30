import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsController, type AnalyticsSink } from './analytics.js';

describe('consented analytics controller', () => {
  it('does not load for unknown, denied, excluded or unapproved host states', () => {
    const loadScript = vi.fn();
    for (const choice of ['unknown', 'denied'] as const)
      createAnalyticsController({
        measurementId: 'G-YWFT404HYG',
        host: 'www.alive.org.tw',
        readChoice: () => choice,
        loadScript,
      }).sync('home');
    createAnalyticsController({
      measurementId: 'G-YWFT404HYG',
      host: 'www.alive.org.tw',
      readChoice: () => 'granted',
      loadScript,
    }).sync(null);
    createAnalyticsController({
      measurementId: 'G-YWFT404HYG',
      host: 'admin.alive.org.tw',
      readChoice: () => 'granted',
      loadScript,
    }).sync('home');
    expect(loadScript).not.toHaveBeenCalled();
  });
  it('sends only fixed synthetic locations and manually approved events', async () => {
    const sink = vi.fn<AnalyticsSink>();
    const loadScript = vi.fn(async () => sink);
    const controller = createAnalyticsController({
      measurementId: 'G-YWFT404HYG',
      host: 'account.alive.org.tw',
      readChoice: () => 'granted',
      loadScript,
    });
    controller.sync('profile');
    await Promise.resolve();
    controller.sync('profile');
    controller.track('profile_saved');
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(
      sink.mock.calls.filter(
        ([command, event]) => command === 'event' && event === 'page_view',
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(sink.mock.calls)).toContain(
      'https://account.alive.org.tw/analytics/profile',
    );
    expect(sink.mock.calls).toContainEqual([
      'config',
      'G-YWFT404HYG',
      expect.objectContaining({
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_referrer: '',
      }),
    ]);
    expect(controller.requiresDocumentNavigation()).toBe(true);
  });
  it('cancels late configuration after withdrawal or disposal', async () => {
    let choice: 'granted' | 'denied' = 'granted';
    let resolve!: (sink: AnalyticsSink) => void;
    const promise = new Promise<AnalyticsSink>((r) => {
      resolve = r;
    });
    const sink = vi.fn<AnalyticsSink>();
    const controller = createAnalyticsController({
      measurementId: 'G-YWFT404HYG',
      host: 'www.alive.org.tw',
      readChoice: () => choice,
      loadScript: () => promise,
    });
    controller.sync('home');
    choice = 'denied';
    controller.sync('home');
    resolve(sink);
    await Promise.resolve();
    controller.track('login_completed');
    expect(sink).not.toHaveBeenCalled();
    controller.dispose();
    controller.sync('home');
    expect(sink).not.toHaveBeenCalled();
  });
});
