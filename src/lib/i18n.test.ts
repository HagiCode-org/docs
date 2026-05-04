import { describe, expect, it } from 'vitest';

import {
  BLOG_ROUTE_LOCALES,
  DOCS_LOCALE_METADATA,
  DOCS_ROUTE_LOCALE_LABELS,
  DOCS_ROUTE_TO_SOURCE_LOCALE,
  buildDocsCounterpartPath,
  buildDocsRoutePath,
  getCanonicalDocsSourceLocale,
  getDocsContentLayoutToggleCopy,
  getDocsFooterCopy,
  getStoredDocsLocale,
  normalizeDocsRoutePath,
  parseDocsLocale,
  resolveClientDocsLocale,
  serializeStoredDocsLocale,
  stripDocsLocalePrefix,
} from './i18n';

describe('docs locale helpers', () => {
  it('exposes generated route locale metadata for Starlight and hagi18n locale names', () => {
    expect(DOCS_LOCALE_METADATA).toHaveLength(29);
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE.root).toBe('zh-CN');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['it-IT']).toBe('it-IT');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['es-419']).toBe('es-419');
    expect(DOCS_ROUTE_TO_SOURCE_LOCALE['vi-VN']).toBe('vi-VN');
    expect(DOCS_ROUTE_LOCALE_LABELS.root).toBe('简体中文');
    expect(DOCS_ROUTE_LOCALE_LABELS['en-US']).toBe('English');
    expect(DOCS_ROUTE_LOCALE_LABELS['es-ES']).toBe('Español (España)');
    expect(DOCS_ROUTE_LOCALE_LABELS['es-419']).toBe('Español (Latinoamérica)');
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
    ['it', 'it-IT'],
    ['sv-SE', 'sv-SE'],
    ['tr-TR', 'tr-TR'],
    ['es-419', 'es-419'],
    ['es-latam', 'es-419'],
    ['ja', 'ja-JP'],
    ['ko-KR', 'ko-KR'],
    ['de', 'de-DE'],
    ['fr', 'fr-FR'],
    ['es-ES', 'es-ES'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-PT'],
    ['nb', 'nb-NO'],
    ['ru_RU', 'ru-RU'],
    ['', null],
  ] as const)('parses %s as %s', (input, expected) => {
    expect(parseDocsLocale(input)).toBe(expected);
  });

  it.each([
    ['en', 'en-US'],
    ['zh-CN', 'zh-CN'],
    ['zh-HK', 'zh-Hant'],
    ['it-IT', 'it-IT'],
    ['es-latam', 'es-419'],
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
    expect(resolveClientDocsLocale(['it-IT'])).toBe('it-IT');
    expect(resolveClientDocsLocale(['pt-MZ'])).toBe('pt-BR');
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
    ['it-IT', '/product-overview/', '/it-IT/product-overview/'],
    ['es-419', '/product-overview/', '/es-419/product-overview/'],
  ] as const)('builds %s route for %s', (locale, originalPath, expected) => {
    expect(buildDocsRoutePath(locale, originalPath)).toBe(expected);
  });

  it.each([
    ['en-US', '/en/ja-JP/product-overview/', '/en-US/product-overview/'],
    ['root', '/en-US/product-overview/', '/product-overview/'],
    ['ja-JP', '/en/product-overview/', '/ja-JP/product-overview/'],
    ['pt-PT', '/pt-BR/product-overview/', '/pt-PT/product-overview/'],
  ] as const)('builds counterpart %s route for %s', (locale, originalPath, expected) => {
    expect(buildDocsCounterpartPath(locale, originalPath)).toBe(expected);
  });

  it.each([
    ['/en-US/product-overview/', '/product-overview/'],
    ['/en-US/ja-JP/product-overview/', '/product-overview/'],
    ['/zh-CN/release-notes/', '/release-notes/'],
    ['/ja-JP/product-overview/', '/product-overview/'],
    ['/it-IT/product-overview/', '/product-overview/'],
    ['/es-419/product-overview/', '/product-overview/'],
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
    ['/it/product-overview/', '/it-IT/product-overview/'],
    ['/es-latam/product-overview/', '/es-419/product-overview/'],
    ['/product-overview/', '/product-overview/'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeDocsRoutePath(input)).toBe(expected);
  });

  it('provides localized docs content layout toggle copy for every supported locale', () => {
    for (const locale of DOCS_LOCALE_METADATA.map((entry) => entry.code)) {
      const copy = getDocsContentLayoutToggleCopy(locale);

      expect(copy.label.trim().length).toBeGreaterThan(0);
      expect(copy.wide.trim().length).toBeGreaterThan(0);
      expect(copy.narrow.trim().length).toBeGreaterThan(0);
    }
  });

  it('provides localized footer copy for every supported locale', () => {
    for (const locale of DOCS_LOCALE_METADATA.map((entry) => entry.code)) {
      const copy = getDocsFooterCopy(locale);

      expect(copy.copyright.trim().length).toBeGreaterThan(0);
      expect(copy.sections.ecosystemSites.trim().length).toBeGreaterThan(0);
      expect(copy.sections.quickLinks.trim().length).toBeGreaterThan(0);
      expect(copy.sections.community.trim().length).toBeGreaterThan(0);
      expect(copy.navigation.ecosystemSites.trim().length).toBeGreaterThan(0);
      expect(copy.navigation.quickLinks.trim().length).toBeGreaterThan(0);
      expect(copy.navigation.community.trim().length).toBeGreaterThan(0);
      expect(copy.filings.icpAriaLabel.trim().length).toBeGreaterThan(0);
      expect(copy.filings.publicSecurityAriaLabel.trim().length).toBeGreaterThan(0);
    }
  });
});
