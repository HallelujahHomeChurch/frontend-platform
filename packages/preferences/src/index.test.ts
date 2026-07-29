import {describe, expect, it} from 'vitest';

import {
  applyTheme,
  getInitialLocale,
  getInitialTheme,
  getLocaleCookie,
  getStoredLocale,
  getStoredTheme,
  getThemeBootstrapScript,
  getThemeCookie,
  isLocale,
  isTheme,
  locales,
  replaceLocale,
  themes,
  type ThemeRoot
} from './index';

describe('supported preferences', () => {
  it('exports the supported locale and theme values', () => {
    expect(locales).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(themes).toEqual(['light', 'dark']);
    expect(isLocale('zh-Hant')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
  });
});

describe('locale preference', () => {
  it('reads only supported locale cookie values', () => {
    expect(getStoredLocale('foo=bar; hhc_locale=zh-Hans')).toBe('zh-Hans');
    expect(getStoredLocale('hhc_locale=fr')).toBeUndefined();
    expect(getStoredLocale('hhc_locale=%E0%A4%A')).toBeUndefined();
  });

  it('uses the first supported browser language and otherwise falls back to English', () => {
    expect(getInitialLocale('', ['zh-Hant-HK', 'en-US'])).toBe('zh-Hant');
    expect(getInitialLocale('', ['zh-CN', 'en-US'])).toBe('zh-Hans');
    expect(getInitialLocale('', ['zh-SG'])).toBe('zh-Hans');
    expect(getInitialLocale('', ['fr-FR', 'zh-TW'])).toBe('zh-Hant');
    expect(getInitialLocale('', ['fr-FR'])).toBe('en');
  });

  it('prefers a valid locale cookie over browser languages', () => {
    expect(getInitialLocale('hhc_locale=en', ['zh-TW'])).toBe('en');
  });
});

describe('theme preference', () => {
  it('reads only supported theme cookie values', () => {
    expect(getStoredTheme('foo=bar; hhc_theme=dark')).toBe('dark');
    expect(getStoredTheme('hhc_theme=system')).toBeUndefined();
  });

  it('falls back to prefers-color-scheme', () => {
    expect(getInitialTheme('', true)).toBe('dark');
    expect(getInitialTheme('', false)).toBe('light');
    expect(getInitialTheme('hhc_theme=light', true)).toBe('light');
  });
});

describe('preference cookies', () => {
  it('serializes production cookies across alive.org.tw subdomains', () => {
    expect(getLocaleCookie('zh-Hant', {hostname: 'account.alive.org.tw', protocol: 'http:'})).toBe(
      'hhc_locale=zh-Hant; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw'
    );
    expect(getThemeCookie('dark', {hostname: 'www.alive.org.tw', protocol: 'https:'})).toBe(
      'hhc_theme=dark; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw; Secure'
    );
  });

  it('omits production-only attributes during local HTTP development', () => {
    expect(getLocaleCookie('en')).toBe('hhc_locale=en; Max-Age=31536000; Path=/; SameSite=Lax');
  });
});

describe('theme application', () => {
  it('keeps data-theme, dark class, and colorScheme in sync', () => {
    const classes = new Set<string>();
    const root: ThemeRoot = {
      dataset: {},
      classList: {
        toggle(name, force) {
          if (force) classes.add(name);
          else classes.delete(name);
          return classes.has(name);
        }
      },
      style: {colorScheme: ''}
    };

    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');

    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    expect(classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('locale paths', () => {
  it('replaces a supported leading locale and preserves the remaining URL', () => {
    expect(replaceLocale('/zh-Hant/privacy-policy?from=footer#rights', 'en')).toBe(
      '/en/privacy-policy?from=footer#rights'
    );
    expect(replaceLocale('/en', 'zh-Hans')).toBe('/zh-Hans');
  });

  it('prefixes paths without a supported locale', () => {
    expect(replaceLocale('/privacy-policy', 'zh-Hant')).toBe('/zh-Hant/privacy-policy');
    expect(replaceLocale('/', 'en')).toBe('/en');
  });
});

describe('before-paint bootstrap', () => {
  it('returns a standalone script that applies a stored theme', () => {
    const root = createBootstrapRoot('hhc_theme=dark');

    runBootstrap(getThemeBootstrapScript(), root, false);

    expect(root.documentElement.dataset.theme).toBe('dark');
    expect(root.classes.has('dark')).toBe(true);
    expect(root.documentElement.style.colorScheme).toBe('dark');
  });

  it('falls back to prefers-color-scheme without a valid cookie', () => {
    const root = createBootstrapRoot('hhc_theme=system');

    runBootstrap(getThemeBootstrapScript(), root, true);

    expect(root.documentElement.dataset.theme).toBe('dark');
  });
});

function createBootstrapRoot(cookie: string) {
  const classes = new Set<string>();

  return {
    cookie,
    classes,
    documentElement: {
      dataset: {} as Record<string, string>,
      classList: {
        toggle(name: string, force: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        }
      },
      style: {colorScheme: ''}
    }
  };
}

function runBootstrap(script: string, document: ReturnType<typeof createBootstrapRoot>, prefersDark: boolean) {
  Function('document', 'matchMedia', script)(document, () => ({matches: prefersDark}));
}
