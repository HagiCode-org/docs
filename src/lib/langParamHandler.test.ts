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
      JSON.stringify({ lang: 'en' }),
      ['zh-CN'],
    );

    expect(result.resolvedLocale).toBe('en');
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en/installation/');
    expect(result.shouldRedirect).toBe(true);
  });

  it('redirects a saved Chinese preference from an English path', () => {
    const result = route(
      'https://docs.hagicode.com/en/installation/',
      JSON.stringify({ lang: 'root' }),
      ['en-US'],
    );

    expect(result.resolvedLocale).toBe('root');
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/');
    expect(result.shouldRedirect).toBe(true);
  });

  it('does not redirect when the current path matches the saved locale', () => {
    const result = route(
      'https://docs.hagicode.com/en/installation/',
      JSON.stringify({ lang: 'en' }),
      ['zh-CN'],
    );

    expect(result.targetUrl).toBe('https://docs.hagicode.com/en/installation/');
    expect(result.shouldRedirect).toBe(false);
  });

  it('uses explicit lang before saved preference and preserves query/hash context', () => {
    const result = route(
      'https://docs.hagicode.com/installation/?lang=en&tab=cli#download',
      JSON.stringify({ lang: 'root' }),
      ['zh-CN'],
    );

    expect(result.resolvedLocale).toBe('en');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en/installation/?tab=cli#download');
  });

  it('does not persist an unsupported lang value and falls back to stored preference', () => {
    const result = route(
      'https://docs.hagicode.com/installation/?lang=fr&tab=cli#download',
      JSON.stringify({ lang: 'root' }),
      ['en-US'],
    );

    expect(result.resolvedLocale).toBe('root');
    expect(result.shouldPersist).toBe(false);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/?tab=cli#download');
  });

  it('uses browser language when no saved preference exists', () => {
    const result = route('https://docs.hagicode.com/en/installation/', null, ['zh-CN']);

    expect(result.resolvedLocale).toBe('root');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/installation/');
  });

  it('falls back to configured default locale for unsupported browser languages', () => {
    const result = route('https://docs.hagicode.com/installation/', null, ['fr-FR']);

    expect(result.resolvedLocale).toBe('en');
    expect(result.shouldPersist).toBe(true);
    expect(result.targetUrl).toBe('https://docs.hagicode.com/en/installation/');
  });

  it('uses landing metadata when resolving root and English landing pages', () => {
    expect(route('https://docs.hagicode.com/', null, ['en-US'], '/product-overview/').targetUrl).toBe(
      'https://docs.hagicode.com/en/product-overview/',
    );
    expect(route('https://docs.hagicode.com/en/', null, ['zh-CN'], '/product-overview/').targetUrl).toBe(
      'https://docs.hagicode.com/product-overview/',
    );
  });
});

describe('handleLanguageParameter', () => {
  it('persists detected locale and redirects with location.replace', () => {
    const { redirects, store, win } = createMockWindow({
      href: 'https://docs.hagicode.com/installation/',
      languages: ['en-US'],
    });

    const result = handleLanguageParameter(win);

    expect(result?.resolvedLocale).toBe('en');
    expect(win.location.replace).toHaveBeenCalledWith('https://docs.hagicode.com/en/installation/');
    expect(redirects).toEqual(['https://docs.hagicode.com/en/installation/']);
    expect(JSON.parse(store.get('starlight-route') ?? '{}')).toEqual({ lang: 'en' });
  });

  it('continues navigation when localStorage throws', () => {
    const { redirects, win } = createMockWindow({
      href: 'https://docs.hagicode.com/en/installation/',
      languages: ['zh-CN'],
      storageThrows: true,
    });

    const result = handleLanguageParameter(win);

    expect(result?.resolvedLocale).toBe('root');
    expect(redirects).toEqual(['https://docs.hagicode.com/installation/']);
  });
});
