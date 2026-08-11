export const adminUiLocales = ['zh-Hant', 'zh-Hans', 'en'] as const;
export const productLocales = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'] as const;
export const contentLocales = productLocales;
export const bulletinEditions = ['zh-Hant', 'zh-Hans', 'en'] as const;

/** @deprecated Use adminUiLocales, productLocales, or contentLocales. */
export const locales = adminUiLocales;
export const themes = ['light', 'dark'] as const;

export type AdminUiLocale = (typeof adminUiLocales)[number];
export type ProductLocale = (typeof productLocales)[number];
export type ContentLocale = ProductLocale;
export type BulletinEdition = (typeof bulletinEditions)[number];
/** @deprecated Use AdminUiLocale, ProductLocale, or ContentLocale. */
export type Locale = (typeof locales)[number];
export type Theme = (typeof themes)[number];

export const localeMetadata: readonly {
  code: ProductLocale;
  shortLabel: string;
  nativeLabel: string;
}[] = [
  {code: 'zh-Hant', shortLabel: '繁中', nativeLabel: '繁體中文'},
  {code: 'zh-Hans', shortLabel: '简中', nativeLabel: '简体中文'},
  {code: 'en', shortLabel: 'EN', nativeLabel: 'English'},
  {code: 'ja', shortLabel: '日本語', nativeLabel: '日本語'},
  {code: 'ko', shortLabel: '한국어', nativeLabel: '한국어'}
];

export const localeCookieName = 'hhc_locale';
export const adminLocaleCookieName = 'hhc_admin_locale';
export const themeCookieName = 'hhc_theme';

const cookieMaxAge = 31_536_000;
const productionCookieDomain = '.alive.org.tw';

export interface CookieContext {
  hostname?: string;
  protocol?: string;
}

export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
  classList: {
    toggle(name: string, force: boolean): boolean;
  };
  style: {
    colorScheme: string;
  };
}

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function isAdminUiLocale(value: string): value is AdminUiLocale {
  return adminUiLocales.includes(value as AdminUiLocale);
}

export function isProductLocale(value: string): value is ProductLocale {
  return productLocales.includes(value as ProductLocale);
}

export function isBulletinEdition(value: string): value is BulletinEdition {
  return bulletinEditions.includes(value as BulletinEdition);
}

export function isTheme(value: string): value is Theme {
  return themes.includes(value as Theme);
}

export function detectLocale(languages: readonly string[]): Locale {
  return detectAdminUiLocale(languages);
}

export function detectProductLocale(languages: readonly string[]): ProductLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();

    if (normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
      return 'zh-Hans';
    }

    if (normalized.startsWith('zh')) return 'zh-Hant';
    if (normalized.startsWith('ja')) return 'ja';
    if (normalized.startsWith('ko')) return 'ko';
    if (normalized.startsWith('en')) return 'en';
  }

  return 'en';
}

export function detectAdminUiLocale(languages: readonly string[]): AdminUiLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();

    if (normalized.startsWith('zh-hans') || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) {
      return 'zh-Hans';
    }

    if (normalized.startsWith('zh')) return 'zh-Hant';
    if (normalized.startsWith('en')) return 'en';
  }

  return 'en';
}

export function getStoredLocale(cookie: string): Locale | undefined {
  const value = getCookieValue(cookie, localeCookieName);
  return value !== undefined && isLocale(value) ? value : undefined;
}

export function getStoredProductLocale(cookie: string): ProductLocale | undefined {
  const value = getCookieValue(cookie, localeCookieName);
  return value !== undefined && isProductLocale(value) ? value : undefined;
}

export function getStoredAdminUiLocale(cookie: string): AdminUiLocale | undefined {
  const value = getCookieValue(cookie, adminLocaleCookieName);
  return value !== undefined && isAdminUiLocale(value) ? value : undefined;
}

export function getStoredTheme(cookie: string): Theme | undefined {
  const value = getCookieValue(cookie, themeCookieName);
  return value !== undefined && isTheme(value) ? value : undefined;
}

export function getInitialLocale(cookie: string, languages: readonly string[]): Locale {
  return getStoredLocale(cookie) ?? detectLocale(languages);
}

export function getInitialProductLocale(cookie: string, languages: readonly string[]): ProductLocale {
  return getStoredProductLocale(cookie) ?? detectProductLocale(languages);
}

export function getInitialAdminUiLocale(cookie: string, languages: readonly string[]): AdminUiLocale {
  return getStoredAdminUiLocale(cookie) ?? detectAdminUiLocale(languages);
}

export function getInitialTheme(cookie: string, _prefersDark: boolean): Theme {
  return getStoredTheme(cookie) ?? 'light';
}

export function getLocaleCookie(locale: Locale, context?: CookieContext): string {
  return serializeCookie(localeCookieName, locale, context);
}

export function getProductLocaleCookie(locale: ProductLocale, context?: CookieContext): string {
  return serializeCookie(localeCookieName, locale, context);
}

export function getAdminLocaleCookie(locale: AdminUiLocale, context?: CookieContext): string {
  return serializeCookie(adminLocaleCookieName, locale, context, false);
}

export function getThemeCookie(theme: Theme, context?: CookieContext): string {
  return serializeCookie(themeCookieName, theme, context);
}

export function applyTheme(theme: Theme, root: ThemeRoot = document.documentElement): void {
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function replaceLocale(pathname: string, locale: Locale): string {
  return replaceProductLocale(pathname, locale);
}

export function replaceProductLocale(pathname: string, locale: ProductLocale): string {
  const [, path = '', suffix = ''] = /^([^?#]*)(.*)$/.exec(pathname) ?? [];
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/^\/(?:zh-Hant|zh-Hans|en|ja|ko)(?=\/|$)/.test(normalizedPath)) {
    return normalizedPath.replace(/^\/(?:zh-Hant|zh-Hans|en|ja|ko)(?=\/|$)/, `/${locale}`) + suffix;
  }

  return normalizedPath === '/' ? `/${locale}${suffix}` : `/${locale}${normalizedPath}${suffix}`;
}

export function getThemeBootstrapScript(): string {
  return `(()=>{const m=document.cookie.match(/(?:^|;\\s*)${themeCookieName}=(light|dark)(?:;|$)/);const t=m?.[1]??'light';const r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t})()`;
}

function getCookieValue(cookie: string, name: string): string | undefined {
  const part = cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  if (!part) return undefined;

  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function serializeCookie(name: string, value: string, context?: CookieContext, includeProductionDomain = true): string {
  const browserContext = typeof location === 'undefined' ? undefined : location;
  const hostname = context?.hostname ?? browserContext?.hostname;
  const protocol = context?.protocol ?? browserContext?.protocol;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${cookieMaxAge}`,
    'Path=/',
    'SameSite=Lax'
  ];

  if (includeProductionDomain && (hostname === 'alive.org.tw' || hostname?.endsWith(productionCookieDomain))) {
    parts.push(`Domain=${productionCookieDomain}`);
  }
  if (protocol === 'https:') parts.push('Secure');

  return parts.join('; ');
}
