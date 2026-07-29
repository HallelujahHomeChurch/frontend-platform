export const locales = ['zh-Hant', 'zh-Hans', 'en'] as const;
export const themes = ['light', 'dark'] as const;

export type Locale = (typeof locales)[number];
export type Theme = (typeof themes)[number];

export const localeCookieName = 'hhc_locale';
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

export function isTheme(value: string): value is Theme {
  return themes.includes(value as Theme);
}

export function detectLocale(languages: readonly string[]): Locale {
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

export function getStoredTheme(cookie: string): Theme | undefined {
  const value = getCookieValue(cookie, themeCookieName);
  return value !== undefined && isTheme(value) ? value : undefined;
}

export function getInitialLocale(cookie: string, languages: readonly string[]): Locale {
  return getStoredLocale(cookie) ?? detectLocale(languages);
}

export function getInitialTheme(cookie: string, prefersDark: boolean): Theme {
  return getStoredTheme(cookie) ?? (prefersDark ? 'dark' : 'light');
}

export function getLocaleCookie(locale: Locale, context?: CookieContext): string {
  return serializeCookie(localeCookieName, locale, context);
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
  const [, path = '', suffix = ''] = /^([^?#]*)(.*)$/.exec(pathname) ?? [];
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/^\/(?:zh-Hant|zh-Hans|en)(?=\/|$)/.test(normalizedPath)) {
    return normalizedPath.replace(/^\/(?:zh-Hant|zh-Hans|en)(?=\/|$)/, `/${locale}`) + suffix;
  }

  return normalizedPath === '/' ? `/${locale}${suffix}` : `/${locale}${normalizedPath}${suffix}`;
}

export function getThemeBootstrapScript(): string {
  return `(()=>{const m=document.cookie.match(/(?:^|;\\s*)${themeCookieName}=(light|dark)(?:;|$)/);const t=m?.[1]??(typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');const r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t})()`;
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

function serializeCookie(name: string, value: string, context?: CookieContext): string {
  const browserContext = typeof location === 'undefined' ? undefined : location;
  const hostname = context?.hostname ?? browserContext?.hostname;
  const protocol = context?.protocol ?? browserContext?.protocol;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${cookieMaxAge}`,
    'Path=/',
    'SameSite=Lax'
  ];

  if (hostname === 'alive.org.tw' || hostname?.endsWith(productionCookieDomain)) {
    parts.push(`Domain=${productionCookieDomain}`);
  }
  if (protocol === 'https:') parts.push('Secure');

  return parts.join('; ');
}
