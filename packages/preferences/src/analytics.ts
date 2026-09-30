import type { AnalyticsChoice } from './index.js';

const publicRoutes = [
  'home',
  'about',
  'news',
  'news_detail',
  'literature',
  'privacy',
  'terms',
] as const;
const accountRoutes = ['login', 'profile'] as const;
export type SafeAnalyticsRoute =
  | (typeof publicRoutes)[number]
  | (typeof accountRoutes)[number];
export type SafeAnalyticsEvent = 'login_completed' | 'profile_saved';
export type AnalyticsSink = (...args: unknown[]) => void;

interface AnalyticsWindow extends Window {
  dataLayer?: unknown[];
  gtag?: AnalyticsSink;
  [key: `ga-disable-${string}`]: boolean;
}
const residentSinks = new Map<string, AnalyticsSink>();
function browserWindow(): AnalyticsWindow | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as unknown as AnalyticsWindow);
}
function removeScript(id: string): void {
  if (typeof document !== 'undefined')
    document
      .querySelectorAll<HTMLScriptElement>('script[data-hhc-analytics]')
      .forEach((script) => {
        if (script.dataset.hhcAnalytics === id) script.remove();
      });
}
function clearAnalyticsCookies(host: string): void {
  if (typeof document === 'undefined') return;
  for (const part of document.cookie.split(';')) {
    const name = part.trim().split('=')[0];
    if (!name || !/^_ga(?:_[A-Za-z0-9]+)?$/.test(name)) continue;
    for (const domain of ['', host, `.${host}`, '.alive.org.tw']) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}${location.protocol === 'https:' ? '; Secure' : ''}`;
    }
  }
}
function loadGoogleAnalytics(id: string): Promise<AnalyticsSink> {
  const resident = residentSinks.get(id);
  if (resident) return Promise.resolve(resident);
  const root = browserWindow();
  if (!root || typeof document === 'undefined')
    return Promise.reject(new Error('Browser analytics unavailable'));
  root.dataLayer ??= [];
  root.gtag ??= function () {
    root.dataLayer?.push(arguments);
  };
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.dataset.hhcAnalytics = id;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    script.onload = () => {
      residentSinks.set(id, root.gtag!);
      resolve(root.gtag!);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Analytics unavailable'));
    };
    document.head.append(script);
  });
}

export function createAnalyticsController(options: {
  measurementId: string;
  host: string;
  readChoice: () => AnalyticsChoice;
  loadScript?: (id: string) => Promise<AnalyticsSink>;
}) {
  const { measurementId: id, host, readChoice } = options;
  const routes: readonly string[] =
    host === 'www.alive.org.tw'
      ? publicRoutes
      : host === 'account.alive.org.tw'
        ? accountRoutes
        : [];
  const configuredId = /^G-[A-Z0-9]{5,20}$/.test(id);
  let route: SafeAnalyticsRoute | null = null;
  let previousRoute: SafeAnalyticsRoute | null = null;
  let sink: AnalyticsSink | undefined;
  let loading = false;
  let started = false;
  let disposed = false;
  let generation = 0;
  let queue: SafeAnalyticsEvent[] = [];
  const locationFor = (value: SafeAnalyticsRoute) =>
    `https://${host}/analytics/${value}`;
  const parameters = (value: SafeAnalyticsRoute) => ({
    page_location: locationFor(value),
    page_referrer: '',
    page_title: 'HHC',
  });
  const permitted = () =>
    !disposed &&
    configuredId &&
    route !== null &&
    routes.includes(route) &&
    readChoice() === 'granted';
  const disable = () => {
    const root = browserWindow();
    if (root && configuredId) root[`ga-disable-${id}`] = true;
    generation++;
    loading = false;
    sink = undefined;
    previousRoute = null;
    queue = [];
    removeScript(id);
    if (readChoice() !== 'granted') clearAnalyticsCookies(host);
  };
  const pageview = () => {
    if (sink && route && permitted() && previousRoute !== route) {
      sink('set', parameters(route));
      sink('event', 'page_view', parameters(route));
      previousRoute = route;
    }
  };
  return {
    sync(next: SafeAnalyticsRoute | null): void {
      route = next;
      if (!permitted()) {
        disable();
        return;
      }
      if (sink) {
        pageview();
        return;
      }
      if (loading) return;
      loading = true;
      started = true;
      const current = ++generation;
      (options.loadScript ?? loadGoogleAnalytics)(id)
        .then((loaded) => {
          if (current !== generation || !permitted() || !route) return;
          loading = false;
          sink = loaded;
          const root = browserWindow();
          if (root) root[`ga-disable-${id}`] = false;
          sink('js', new Date());
          sink('config', id, {
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            ...parameters(route),
          });
          pageview();
          const pending = queue;
          queue = [];
          for (const event of pending)
            if (permitted() && route) sink('event', event, parameters(route));
        })
        .catch(() => {
          if (current === generation) disable();
        });
    },
    track(event: SafeAnalyticsEvent): void {
      if (!permitted() || !route || host !== 'account.alive.org.tw') {
        if (readChoice() !== 'granted') disable();
        return;
      }
      if (event !== 'login_completed' && event !== 'profile_saved') return;
      if (event === 'profile_saved' && route !== 'profile') return;
      if (sink) sink('event', event, parameters(route));
      // ponytail: keep at most eight fixed events while loading; analytics is best effort.
      else if (queue.length < 8) queue.push(event);
    },
    requiresDocumentNavigation(): boolean {
      return started || residentSinks.has(id);
    },
    dispose(): void {
      disposed = true;
      disable();
    },
  };
}
