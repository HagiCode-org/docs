import { describe, expect, it } from 'vitest';

import {
  buildDocsRoutePath,
  getStoredDocsLocale,
  parseDocsLocale,
  resolveClientDocsLocale,
  serializeStoredDocsLocale,
} from './i18n';

describe('docs locale helpers', () => {
  it.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['en-gb', 'en'],
    ['root', 'root'],
    ['zh', 'root'],
    ['zh-CN', 'root'],
    ['zh-Hant', 'root'],
    ['fr', null],
    ['', null],
  ] as const)('parses %s as %s', (input, expected) => {
    expect(parseDocsLocale(input)).toBe(expected);
  });

  it('preserves unrelated Starlight route fields when serializing a locale', () => {
    const serialized = serializeStoredDocsLocale(
      JSON.stringify({ path: '/en/install/', lang: 'en', version: 'latest' }),
      'root',
    );

    expect(JSON.parse(serialized)).toEqual({
      path: '/en/install/',
      lang: 'root',
      version: 'latest',
    });
  });

  it('ignores invalid stored lang values without discarding valid JSON fields', () => {
    const storedValue = JSON.stringify({ lang: 'fr', path: '/fr/install/' });

    expect(getStoredDocsLocale(storedValue)).toBeNull();
    expect(JSON.parse(serializeStoredDocsLocale(storedValue, 'en'))).toEqual({
      lang: 'en',
      path: '/fr/install/',
    });
  });

  it('resolves browser languages to the first supported docs locale', () => {
    expect(resolveClientDocsLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('en');
    expect(resolveClientDocsLocale(['ja-JP', 'zh-Hant'])).toBe('root');
    expect(resolveClientDocsLocale(['de-DE'])).toBeNull();
  });

  it.each([
    ['en', '/', '/en/'],
    ['en', '/install/', '/en/install/'],
    ['en', '/en/install/', '/en/install/'],
    ['en', '/install', '/en/install'],
    ['root', '/en/', '/'],
    ['root', '/en/install/', '/install/'],
    ['root', '/install/', '/install/'],
    ['root', '/en/install', '/install'],
  ] as const)('builds %s route for %s', (locale, originalPath, expected) => {
    expect(buildDocsRoutePath(locale, originalPath)).toBe(expected);
  });
});
