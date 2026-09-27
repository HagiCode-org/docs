import { describe, expect, it } from 'vitest';

import {
  BLOG_ROUTE_LOCALES,
  DOCS_LOCALE_METADATA,
  DOCS_ROUTE_LOCALE_LABELS,
  DOCS_ROUTE_TO_SOURCE_LOCALE,
  buildDocsCounterpartPath,
  buildDocsRoutePath,
  getCanonicalDocsSourceLocale,
  getStoredDocsLocale,
  normalizeDocsRoutePath,
  parseDocsLocale,
  resolveClientDocsLocale,
  serializeStoredDocsLocale,
  stripDocsLocalePrefix,
} from './i18n';

describe('docs locale helpers', () => {
  it('exposes generated route locale metadata for Starlight and hagi18n locale names', () => {
    expect(DOCS_LOCALE_METADATA).toHaveLength(10);
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE.root).toBe('zh-CN');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['ja-JP']).toBe('ja-JP');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['pt-BR']).toBe('pt-BR');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['ru-RU']).toBe('ru-RU');
    expect(DOCS_ROUTE_LOCALE_LABELS.root).toBe('简体中文');
    expect(DOCS_ROUTE_LOCALE_LABELS['en-US']).toBe('English');
    expect(DOCS_ROUTE_LOCALE_LABELS['es-ES']).toBe('Español');
    expect(DOCS_ROUTE_LOCALE_LABELS['pt-BR']).toBe('Português (Brasil)');
    expect(DOCS_LOCALE_METADATA.map((locale) => locale.code)).toEqual(BLOG_ROUTE_LOCALES);
  });

  it.each([
    ['en-US', 'en-US'],
    ['en', 'en-US'],
    ['en-gb', 'en-US'],
    ['root', 'root'],
    ['zh', 'root'],
    ['zh-CN', 'root'],
    ['zh-Hant', 'zh-Hant'],
    ['zh-TW', 'zh-Hant'],
    ['zh-MO', 'zh-Hant'],
    ['ja', 'ja-JP'],
    ['ko-KR', 'ko-KR'],
    ['de', 'de-DE'],
    ['fr', 'fr-FR'],
    ['es-ES', 'es-ES'],
    ['pt', 'pt-BR'],
    ['ru_RU', 'ru-RU'],
    ['xx-XX', null],
    ['unsupported', null],
    ['invalid', null],
    ['', null],
  ] as const)('parses %s as %s', (input, expected) => {
    expect(parseDocsLocale(input)).toBe(expected);
  });

  it.each([
    ['en', 'en-US'],
    ['zh-CN', 'zh-CN'],
    ['zh-HK', 'zh-Hant'],
    ['ja-JP', 'ja-JP'],
    ['pt', 'pt-BR'],
  ] as const)('maps %s to canonical source locale %s', (input, expected) => {
    expect(getCanonicalDocsSourceLocale(input)).toBe(expected);
  });

  it('preserves unrelated Starlight route fields when serializing a locale', () => {
    const serialized = serializeStoredDocsLocale(
      JSON.stringify({ path: '/en-US/install/', lang: 'en-US', version: 'latest' }),
      'root',
    );

    expect(JSON.parse(serialized)).toEqual({
      path: '/en-US/install/',
      lang: 'root',
      version: 'latest',
    });
  });

  it('normalizes stored lang aliases without discarding valid JSON fields', () => {
    const storedValue = JSON.stringify({ lang: 'fr', path: '/fr/install/' });

    expect(getStoredDocsLocale(storedValue)).toBe('fr-FR');
    expect(JSON.parse(serializeStoredDocsLocale(storedValue, 'en-US'))).toEqual({
      lang: 'en-US',
      path: '/fr/install/',
    });
  });

  it('resolves browser languages to the first supported docs locale', () => {
    expect(resolveClientDocsLocale(['fr-FR', 'en-GB', 'zh-CN'])).toBe('fr-FR');
    expect(resolveClientDocsLocale(['ja-JP', 'zh-Hant'])).toBe('ja-JP');
    expect(resolveClientDocsLocale(['pt'])).toBe('pt-BR');
    expect(resolveClientDocsLocale(['xx-XX'])).toBeNull();
    expect(resolveClientDocsLocale(['xx-XX'])).toBeNull();
  });

  it.each([
    ['en-US', '/', '/en-US/'],
    ['en-US', '/install/', '/en-US/install/'],
    ['en-US', '/en-US/install/', '/en-US/install/'],
    ['en-US', '/en-US/install/', '/en-US/install/'],
    ['en-US', '/install', '/en-US/install'],
    ['root', '/en-US/', '/'],
    ['root', '/zh-CN/install/', '/install/'],
    ['root', '/en-US/install/', '/install/'],
    ['root', '/install/', '/install/'],
    ['root', '/en-US/install', '/install'],
    ['ja-JP', '/en-US/product-overview/', '/ja-JP/product-overview/'],
    ['ja-JP', '/en-US/ja-JP/product-overview/', '/ja-JP/product-overview/'],
    ['ja-JP', '/blog/example/', '/ja-JP/blog/example/'],
    ['fr-FR', '/en-US/blog/example/', '/fr-FR/blog/example/'],
    ['de-DE', '/product-overview/', '/de-DE/product-overview/'],
    ['pt-BR', '/product-overview/', '/pt-BR/product-overview/'],
  ] as const)('builds %s route for %s', (locale, originalPath, expected) => {
    expect(buildDocsRoutePath(locale, originalPath)).toBe(expected);
  });

  it.each([
    ['en-US', '/en/ja-JP/product-overview/', '/en-US/product-overview/'],
    ['root', '/en-US/product-overview/', '/product-overview/'],
    ['ja-JP', '/en/product-overview/', '/ja-JP/product-overview/'],
    ['pt-BR', '/en-US/product-overview/', '/pt-BR/product-overview/'],
  ] as const)('builds counterpart %s route for %s', (locale, originalPath, expected) => {
    expect(buildDocsCounterpartPath(locale, originalPath)).toBe(expected);
  });

  it.each([
    ['/en-US/product-overview/', '/product-overview/'],
    ['/en-US/ja-JP/product-overview/', '/product-overview/'],
    ['/zh-CN/release-notes/', '/release-notes/'],
    ['/ja-JP/product-overview/', '/product-overview/'],
    ['/de-DE/product-overview/', '/product-overview/'],
    ['/pt-BR/product-overview/', '/product-overview/'],
  ] as const)('strips locale prefixes from %s', (input, expected) => {
    expect(stripDocsLocalePrefix(input)).toBe(expected);
  });

  it.each([
    ['/en-US/product-overview/', '/en-US/product-overview/'],
    ['/en/product-overview/', '/en-US/product-overview/'],
    ['/en/en-US/product-overview/', '/en-US/product-overview/'],
    ['/en-US/ja-JP/product-overview/', '/ja-JP/product-overview/'],
    ['/zh-CN/product-overview/', '/product-overview/'],
    ['/ja/product-overview/', '/ja-JP/product-overview/'],
    ['/de/product-overview/', '/de-DE/product-overview/'],
    ['/unsupported/product-overview/', '/unsupported/product-overview/'],
    ['/product-overview/', '/product-overview/'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeDocsRoutePath(input)).toBe(expected);
  });

});
