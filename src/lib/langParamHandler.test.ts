import { describe, expect, it, vi } from 'vitest';

import { handleLanguageParameter, resolveDocsLandingRoute } from './langParamHandler';

function route(
  href: string,
  storedRouteValue: string | null = null,
  clientLanguages: Array<string | null | undefined> = [],
  landingTargetPath: string | null = null,
) {
  return resolveDocsLandingRoute(
    new URL(href),
    storedRouteValue,
    clientLanguages,
    landingTargetPath,
  );
}

function createMockWindow(options: {
  href: string;
  storedRouteValue?: string | null;
  storageThrows?: boolean;
  languages?: string[];
  language?: string;
}) {
  const redirects: string[] = [];
  const store = new Map<string, string>();
  let currentUrl = new URL(options.href);

  if (options.storedRouteValue !== undefined && options.storedRouteValue !== null) {
    store.set('starlight-route', options.storedRouteValue);
  }

  const win = {
    location: {
      get href() {
        return currentUrl.toString();
      },
      set href(value: string) {
        currentUrl = new URL(value, currentUrl);
        redirects.push(currentUrl.toString());
      },
      replace: vi.fn((value: string) => {
        currentUrl = new URL(value, currentUrl);
        redirects.push(currentUrl.toString());
      }),
    },
    localStorage: {
      getItem(key: string) {
        if (options.storageThrows) {
          throw new Error('storage unavailable');
        }

        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (options.storageThrows) {
          throw new Error('storage unavailable');
        }

        store.set(key, value);
      },
    },
    navigator: {
      languages: options.languages ?? [options.language ?? 'en-US'],
      language: options.language ?? 'en-US',
    },
    document: {
      querySelector() {
        return null;
      },
    },
  } as unknown as Window;

  return { redirects, store, win };
}

describe('docs language route resolution', () => {
  it('redirects a saved English preference from a Chinese root path', () => {
    const result = route(
      'https://docs.hagicode.com/installation/',
      JSON.stringify({ lang: 'en-US' }),
      ['zh-CN'],
    );

    expect(result.resolvedLocale).toBe('en-US');
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en-US/installation/');
    expect(result.shouldRedirect).toBe(true);
  });

  it('redirects a saved Chinese preference from an English path', () => {
    const result = route(
      'https://docs.hagicode.com/en-US/installation/',
      JSON.stringify({ lang: 'root' }),
      ['en-US'],
    );

    expect(result.resolvedLocale).toBe('root');
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/');
    expect(result.shouldRedirect).toBe(true);
  });

  it('does not redirect when the current path matches the saved locale', () => {
    const result = route(
      'https://docs.hagicode.com/en-US/installation/',
      JSON.stringify({ lang: 'en-US' }),
      ['zh-CN'],
    );

    expect(result.targetUrl).toBe('https://docs.hagicode.com/en-US/installation/');
    expect(result.shouldRedirect).toBe(false);
  });

  it('uses explicit lang before saved preference and preserves query/hash context', () => {
    const result = route(
      'https://docs.hagicode.com/installation/?lang=en-US&tab=cli#download',
      JSON.stringify({ lang: 'root' }),
      ['zh-CN'],
    );

    expect(result.resolvedLocale).toBe('en-US');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en-US/installation/?tab=cli#download');
  });

  it('does not persist an unsupported lang value and falls back to stored preference', () => {
    const result = route(
      'https://docs.hagicode.com/installation/?lang=xx&tab=cli#download',
      JSON.stringify({ lang: 'root' }),
      ['en-US'],
    );

    expect(result.resolvedLocale).toBe('root');
    expect(result.shouldPersist).toBe(false);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/?tab=cli#download');
  });

  it('uses browser language when no saved preference exists', () => {
    const result = route('https://docs.hagicode.com/en-US/installation/', null, ['zh-CN']);

    expect(result.resolvedLocale).toBe('root');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/');
  });

  it('falls back to configured default locale for unsupported browser languages', () => {
    const result = route('https://docs.hagicode.com/installation/', null, ['xx-XX']);

    expect(result.resolvedLocale).toBe('en-US');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en-US/installation/');
  });

  it('resolves supported locales from query and browser preferences', () => {
    const queryDriven = route(
      'https://docs.hagicode.com/product-overview/?lang=pt',
      null,
      ['en-US'],
    );
    expect(queryDriven.resolvedLocale).toBe('pt-BR');
    expect(queryDriven.targetUrl).toBe('https://docs.hagicode.com/pt-BR/product-overview/');

    const browserDriven = route('https://docs.hagicode.com/installation/', null, ['ru-RU']);
    expect(browserDriven.resolvedLocale).toBe('ru-RU');
    expect(browserDriven.targetUrl).toBe('https://docs.hagicode.com/ru-RU/installation/');
  });

  it('treats removed locale inputs as unsupported and falls back to the configured default path', () => {
    const queryDriven = route(
      'https://docs.hagicode.com/product-overview/?lang=xx-XX',
      null,
      ['en-US'],
    );
    expect(queryDriven.resolvedLocale).toBe('en-US');
    expect(queryDriven.targetUrl).toBe('https://docs.hagicode.com/en-US/product-overview/');

    const browserDriven = route('https://docs.hagicode.com/installation/', null, ['xx-XX']);
    expect(browserDriven.resolvedLocale).toBe('en-US');
    expect(browserDriven.targetUrl).toBe('https://docs.hagicode.com/en-US/installation/');
  });

  it('uses landing metadata when resolving root and English landing pages', () => {
    expect(route('https://docs.hagicode.com/', null, ['en-US'], '/product-overview/').targetUrl).toBe(
      'https://docs.hagicode.com/en-US/product-overview/',
    );
    expect(route('https://docs.hagicode.com/en-US/', null, ['zh-CN'], '/product-overview/').targetUrl).toBe(
      'https://docs.hagicode.com/product-overview/',
    );
  });

  it('canonicalizes stacked supported locale paths even without an explicit lang parameter', () => {
    expect(route('https://docs.hagicode.com/en-US/product-overview/', null, ['en-US']).targetUrl).toBe(
      'https://docs.hagicode.com/en-US/product-overview/',
    );
    expect(route('https://docs.hagicode.com/en-US/product-overview/', null, ['en-US']).shouldRedirect).toBe(
      false,
    );

    expect(
      route('https://docs.hagicode.com/en-US/ja-JP/product-overview/', JSON.stringify({ lang: 'en-US' }), ['en-US'])
        .targetUrl,
    ).toBe('https://docs.hagicode.com/ja-JP/product-overview/');
    expect(
      route('https://docs.hagicode.com/en-US/ja-JP/product-overview/', JSON.stringify({ lang: 'en-US' }), ['en-US'])
        .shouldRedirect,
    ).toBe(true);
  });

  it('redirects legacy /en docs paths to canonical /en-US targets while preserving query and hash', () => {
    const result = route(
      'https://docs.hagicode.com/en/product-overview/?tab=cli#install',
      null,
      ['en-US'],
    );

    expect(result.resolvedLocale).toBe('en-US');
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en-US/product-overview/?tab=cli#install');
    expect(result.shouldRedirect).toBe(true);
  });
});

describe('handleLanguageParameter', () => {
  it('persists detected locale and redirects with location.replace', () => {
    const { redirects, store, win } = createMockWindow({
      href: 'https://docs.hagicode.com/installation/',
      languages: ['en-US'],
    });

    const result = handleLanguageParameter(win);

    expect(result?.resolvedLocale).toBe('en-US');
    expect(win.location.replace).toHaveBeenCalledWith('https://docs.hagicode.com/en-US/installation/');
    expect(redirects).toEqual(['https://docs.hagicode.com/en-US/installation/']);
    expect(JSON.parse(store.get('starlight-route') ?? '{}')).toEqual({ lang: 'en-US' });
  });

  it('continues navigation when localStorage throws', () => {
    const { redirects, win } = createMockWindow({
      href: 'https://docs.hagicode.com/en-US/installation/',
      languages: ['zh-CN'],
      storageThrows: true,
    });

    const result = handleLanguageParameter(win);

    expect(result?.resolvedLocale).toBe('root');
    expect(redirects).toEqual(['https://docs.hagicode.com/installation/']);
  });
});
